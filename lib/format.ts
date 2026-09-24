import { NewsItem } from "./news";

const RULE = "─".repeat(35);

// Not optional — see B1.2 in the execution plan. Any draft that uses a news item must
// carry this block so Meera checks the claim before it goes out under her name.
export function appendVerifyFlag(draft: string, news: NewsItem): string {
  return `${draft}\n\n${RULE}\nNEWS SOURCE: ${news.headline}\nFROM: ${news.source} · ${news.date}\nLINK: ${news.url}\n⚠ Check this before publishing — you are the author of this claim\n${RULE}`;
}

export function rejectionMessage(reason: string, score: number): string {
  return `No draft this time (score ${score}/10).\n\n${reason}\n\nSend another note when you have one with more to it.`;
}

export function draftDeliveryMessage(draft: string, draftId: number, modelUsed: string): string {
  return `Draft #${draftId} (${modelUsed}):\n\n${draft}\n\nReply APPROVE or REJECT.`;
}
