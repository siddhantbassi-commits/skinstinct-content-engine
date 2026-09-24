import Anthropic from "@anthropic-ai/sdk";
import { buildDraftPrompt } from "./gemini";

function client() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey: key });
}

export async function draftWithClaude(params: {
  noteText: string;
  voiceSkill: string;
  newsItem: { headline: string; summary: string } | null;
}): Promise<string> {
  const prompt = buildDraftPrompt(params);
  const message = await client().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });
  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("No text response from Claude");
  return block.text.trim();
}
