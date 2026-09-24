import type { VercelRequest, VercelResponse } from "@vercel/node";
import { TelegramUpdate, sendTelegramMessage } from "../lib/telegram";
import { scoreNote, extractSearchPhrase, draftWithGemini } from "../lib/gemini";
import { draftWithClaude } from "../lib/claude";
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
const DRAFT_MODEL = (process.env.DRAFT_MODEL ?? "claude").toLowerCase();

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
  const note = await insertNote({ chatId, telegramMessageId, content: text });

  const { score, reason } = await scoreNote(text);

  if (score < SCORE_THRESHOLD) {
    await updateNoteScore(note.id, score, reason, "rejected");
    await sendTelegramMessage(chatId, rejectionMessage(reason, score));
    return;
  }

  await updateNoteScore(note.id, score, reason, "passed");

  const searchPhrase = await extractSearchPhrase(text);
  let newsItem: NewsItem | null = null;
  try {
    newsItem = await fetchTopNews(searchPhrase);
  } catch (err) {
    console.error("News fetch failed, continuing without a news angle:", err);
  }

  const voiceSkill = await getVoiceSkill();
  const draftParams = { noteText: text, voiceSkill, newsItem };

  let draftText =
    DRAFT_MODEL === "gemini"
      ? await draftWithGemini(draftParams)
      : await draftWithClaude(draftParams);

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
// Send "/compare <note text>" to run the same note through Gemini and Claude side by
// side. This does not touch the notes/drafts tables — it's a scratch comparison.
async function handleCompare(chatId: string, noteText: string) {
  const voiceSkill = await getVoiceSkill();
  const [geminiDraft, claudeDraft] = await Promise.all([
    draftWithGemini({ noteText, voiceSkill, newsItem: null }),
    draftWithClaude({ noteText, voiceSkill, newsItem: null }),
  ]);

  await sendTelegramMessage(chatId, `GEMINI:\n\n${geminiDraft}`);
  await sendTelegramMessage(chatId, `CLAUDE:\n\n${claudeDraft}`);
}
