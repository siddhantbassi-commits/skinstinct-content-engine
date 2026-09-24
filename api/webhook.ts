import type { VercelRequest, VercelResponse } from "@vercel/node";
import { TelegramUpdate, sendTelegramMessage } from "../lib/telegram";
import {
  triageNote,
  draftWithGemini,
  draftWithGeminiFlash,
  draftWithGeminiPro,
} from "../lib/gemini";
import { fetchTopNews, NewsItem } from "../lib/news";
import { getVoiceSkill } from "../lib/voiceSkill";
import { appendVerifyFlag, rejectionMessage, draftDeliveryMessage } from "../lib/format";
import {
  insertNote,
  updateNoteScore,
  insertDraft,
  findLatestPendingDraft,
  updateDraftStatus,
} from "../lib/db";

const SCORE_THRESHOLD = Number(process.env.SCORE_THRESHOLD ?? 6);
// Gemini only, no Anthropic — course constraint. Gemini Pro drafts (holds voice
// better across a full post), Gemini Flash handles triage/keywords.
const DRAFT_MODEL = "gemini-pro";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(200).send("Skinstinct content engine webhook is alive.");
    return;
  }

  // Always 200 back to Telegram quickly-ish; Telegram retries aggressively on
  // non-2xx and we don't want duplicate processing. Errors are reported into the
  // chat itself instead of via HTTP status.
  try {
    const update = req.body as TelegramUpdate;
    const message = update.message;
    if (!message?.text) {
      res.status(200).json({ ok: true });
      return;
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();

    if (/^\/compare\s+/i.test(text)) {
      await handleCompare(chatId, text.replace(/^\/compare\s+/i, ""));
    } else if (/^(APPROVE|REJECT)(\s+\d+)?$/i.test(text)) {
      await handleDecision(chatId, text);
    } else {
      await handleNewNote(chatId, message.message_id, text);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    // Best-effort notify the chat so a failure is visible during testing.
    try {
      const chatId = (req.body as TelegramUpdate)?.message?.chat.id;
      if (chatId) {
        await sendTelegramMessage(
          chatId,
          `Something went wrong processing that: ${(err as Error).message}`
        );
      }
    } catch {
      // swallow — we still want to return 200 below
    }
    res.status(200).json({ ok: false });
  }
}

async function handleNewNote(chatId: string, telegramMessageId: number, text: string) {
  // Independent work run concurrently — this pipeline is latency-constrained by
  // Vercel's function timeout, so every sequential round trip we can avoid matters.
  // The voice profile doesn't depend on the note at all, so fetch it up front too.
  const [note, { score, reason, searchPhrase }, voiceSkill] = await Promise.all([
    insertNote({ chatId, telegramMessageId, content: text }),
    triageNote(text),
    getVoiceSkill(),
  ]);

  if (score < SCORE_THRESHOLD) {
    await updateNoteScore(note.id, score, reason, "rejected");
    await sendTelegramMessage(chatId, rejectionMessage(reason, score));
    return;
  }

  const [, newsItem] = await Promise.all([
    updateNoteScore(note.id, score, reason, "passed"),
    fetchTopNews(searchPhrase).catch((err) => {
      console.error("News fetch failed, continuing without a news angle:", err);
      return null as NewsItem | null;
    }),
  ]);

  const draftParams = { noteText: text, voiceSkill, newsItem };

  let draftText = await draftWithGemini(draftParams);

  if (newsItem) {
    draftText = appendVerifyFlag(draftText, newsItem);
  }

  const draft = await insertDraft({
    noteId: note.id,
    chatId,
    content: draftText,
    modelUsed: DRAFT_MODEL,
    news: newsItem,
  });

  await sendTelegramMessage(chatId, draftDeliveryMessage(draftText, draft.id, DRAFT_MODEL));
}

async function handleDecision(chatId: string, text: string) {
  const match = text.match(/^(APPROVE|REJECT)(?:\s+(\d+))?$/i);
  if (!match) return;
  const decision = match[1].toUpperCase() as "APPROVE" | "REJECT";
  const draftId = match[2] ? Number(match[2]) : undefined;

  const draft = await findLatestPendingDraft(chatId, draftId);
  if (!draft) {
    await sendTelegramMessage(chatId, "No pending draft found for that.");
    return;
  }

  await updateDraftStatus(draft.id, decision === "APPROVE" ? "approved" : "rejected");
  await sendTelegramMessage(
    chatId,
    decision === "APPROVE"
      ? `Draft #${draft.id} marked approved. Go ahead and publish it.`
      : `Draft #${draft.id} marked rejected and kept for reference.`
  );
}

// Final 15-min checkpoint: swap the drafting model and compare, without redeploying.
// This project is Gemini-only (no Anthropic), so the comparison is Gemini Flash vs.
// Gemini Pro on the same note, in place of the case's Gemini-vs-Claude exercise.
// Send "/compare <note text>". Does not touch the notes/drafts tables.
async function handleCompare(chatId: string, noteText: string) {
  const voiceSkill = await getVoiceSkill();
  const [flashDraft, proDraft] = await Promise.all([
    draftWithGeminiFlash({ noteText, voiceSkill, newsItem: null }),
    draftWithGeminiPro({ noteText, voiceSkill, newsItem: null }),
  ]);

  await sendTelegramMessage(chatId, `GEMINI FLASH:\n\n${flashDraft}`);
  await sendTelegramMessage(chatId, `GEMINI PRO:\n\n${proDraft}`);
}
