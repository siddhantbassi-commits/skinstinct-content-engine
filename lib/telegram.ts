const TELEGRAM_API = "https://api.telegram.org";

function token() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return t;
}

export async function sendTelegramMessage(chatId: string | number, text: string) {
  // Telegram messages are capped at 4096 chars; split long drafts rather than truncating.
  const chunks = splitForTelegram(text);
  for (const chunk of chunks) {
    const res = await fetch(`${TELEGRAM_API}/bot${token()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Telegram sendMessage failed: ${res.status} ${body}`);
    }
  }
}

function splitForTelegram(text: string, limit = 4000): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf("\n", limit);
    if (cut <= 0) cut = limit;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  if (remaining.length) chunks.push(remaining);
  return chunks;
}

export interface TelegramUpdate {
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number };
  };
}
