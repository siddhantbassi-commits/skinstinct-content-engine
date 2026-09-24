import { GoogleGenerativeAI } from "@google/generative-ai";

function client() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

// Model names use Google's stable aliases (gemini-flash-latest / gemini-pro-latest)
// rather than a pinned version, so this keeps working as Google revs the underlying
// model without a code change.

// Gemini Flash: fast, cheap, no judgment needed — used for triage, not authorship.
function flash() {
  return client().getGenerativeModel({ model: "gemini-flash-latest" });
}

// Gemini Pro: slower, holds a voice better across a full post — used for drafting.
// This project uses only Gemini (no Anthropic), so Pro stands in for the "stronger
// model" role B1 assigns to Claude, including the final Flash-vs-Pro comparison.
// This model line only runs in thinking mode (thinkingBudget: 0 is rejected outright)
// — a small budget keeps it well under Vercel's function timeout instead of the
// ~12s+ it takes with the model's own default budget.
function pro() {
  return client().getGenerativeModel({
    model: "gemini-pro-latest",
    generationConfig: { thinkingConfig: { thinkingBudget: 256 } } as any,
  });
}

export interface TriageResult {
  score: number;
  reason: string;
  searchPhrase: string;
}

// One Flash call doing both triage jobs (score + keyword extraction) instead of two
// sequential round trips — this pipeline is latency-constrained by Vercel's function
// timeout, and the keyword extraction is wasted work anyway when the note is going to
// be rejected, so folding it in only costs anything on the passing path.
export async function triageNote(noteText: string): Promise<TriageResult> {
  const prompt = `You are triaging raw notes from a skincare founder's personal Telegram
channel to decide which are worth turning into a LinkedIn post.

1. Score the note from 0 to 10 on whether it has a clear point and enough substance to
become a publishable, specific post (not a generic observation, not a logistics
reminder, not an abandoned half-thought).

Score high (7-10): a specific incident, a specific data point, or a specific technical
explanation with a clear angle.
Score low (0-5): task reminders, one-line fragments with no developed point, notes that
just restate something already said elsewhere without a new angle.

Be strict. If everything you score passes, you are being too lenient.

2. Regardless of score, pull 3-5 keywords from the note into a single short phrase
suitable for a news search — the kind of phrase you'd type into Google News to find a
recent, relevant article. Focus on the underlying topic/industry, not the founder's
specific anecdote.

Note:
"""
${noteText}
"""

Respond with ONLY valid JSON, no markdown fences, in this exact shape:
{"score": <integer 0-10>, "reason": "<one line, under 20 words>", "searchPhrase": "<the search phrase>"}`;

  const result = await flash().generateContent(prompt);
  const raw = result.response.text().trim();
  return parseTriageJson(raw);
}

function parseTriageJson(raw: string): TriageResult {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  const score = Math.max(0, Math.min(10, Math.round(Number(parsed.score))));
  const reason = String(parsed.reason ?? "").slice(0, 200);
  const searchPhrase = String(parsed.searchPhrase ?? "").slice(0, 200);
  if (Number.isNaN(score)) throw new Error(`Could not parse score from: ${raw}`);
  return { score, reason, searchPhrase };
}

export type DraftParams = {
  noteText: string;
  voiceSkill: string;
  newsItem: { headline: string; summary: string } | null;
};

export interface DraftResult {
  text: string;
  // True only when the model actually wove the news item into the post — a fetched
  // article the draft never mentions must NOT carry the verify flag (see B1.2: the
  // flag exists so Meera checks claims she's actually making, not to flag noise).
  usedNews: boolean;
}

// Primary drafting path for the pipeline — Gemini Pro.
export async function draftWithGemini(params: DraftParams): Promise<DraftResult> {
  return draftWithGeminiPro(params);
}

export async function draftWithGeminiPro(params: DraftParams): Promise<DraftResult> {
  const prompt = buildDraftPrompt(params);
  const result = await pro().generateContent(prompt);
  return parseDraftResponse(result.response.text().trim(), params.newsItem !== null);
}

export async function draftWithGeminiFlash(params: DraftParams): Promise<DraftResult> {
  const prompt = buildDraftPrompt(params);
  const result = await flash().generateContent(prompt);
  return parseDraftResponse(result.response.text().trim(), params.newsItem !== null);
}

function parseDraftResponse(raw: string, expectJson: boolean): DraftResult {
  if (!expectJson) return { text: raw, usedNews: false };

  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return { text: String(parsed.post ?? "").trim(), usedNews: Boolean(parsed.usedNews) };
  } catch {
    // Model didn't follow the JSON instruction — fall back to treating the whole
    // response as the post text and assume the news item wasn't used, since we can't
    // confirm it was without the flag the model was supposed to set.
    return { text: raw, usedNews: false };
  }
}

export function buildDraftPrompt(params: {
  noteText: string;
  voiceSkill: string;
  newsItem: { headline: string; summary: string } | null;
}): string {
  const { noteText, voiceSkill, newsItem } = params;
  return `You are drafting a LinkedIn post for Meera Pillai, founder of the skincare brand
Skinstinct. Write ONLY the post text — no preamble, no explanation, no hashtags unless
her established voice uses them (it doesn't, based on the profile below).

VOICE PROFILE (this is how she writes — match it exactly, don't write generic LinkedIn
content):
"""
${voiceSkill}
"""

RAW NOTE she captured (this is the seed for the post — develop it, don't just restate
it):
"""
${noteText}
"""
${
  newsItem
    ? `\nRELEVANT NEWS ITEM (use this to make the post timely ONLY if it is genuinely
relevant to the note's point; if it doesn't fit naturally, ignore it completely and
don't mention it):
Headline: ${newsItem.headline}
Summary: ${newsItem.summary}

Respond with ONLY valid JSON, no markdown fences, in this exact shape:
{"post": "<the full post text>", "usedNews": <true if the post above references or is
built around the news item, false if you ignored it as not genuinely relevant>}\n`
    : `\nWrite the post now, in her voice, developing the note into a full, specific,
publishable LinkedIn post.`
}`;
}
