import { getSupabase } from "./supabase";
import { NewsItem } from "./news";

export interface NoteRow {
  id: number;
  chat_id: string;
  telegram_message_id: number | null;
  content: string;
  score: number | null;
  score_reason: string | null;
  status: "received" | "passed" | "rejected";
  created_at: string;
}

export interface DraftRow {
  id: number;
  note_id: number;
  chat_id: string;
  content: string;
  model_used: string;
  news_headline: string | null;
  news_source: string | null;
  news_date: string | null;
  news_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
}

export async function insertNote(params: {
  chatId: string;
  telegramMessageId: number;
  content: string;
}): Promise<NoteRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notes")
    .insert({
      chat_id: params.chatId,
      telegram_message_id: params.telegramMessageId,
      content: params.content,
      status: "received",
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as NoteRow;
}

export async function updateNoteScore(
  noteId: number,
  score: number,
  reason: string,
  status: "passed" | "rejected"
) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("notes")
    .update({ score, score_reason: reason, status })
    .eq("id", noteId);
  if (error) throw error;
}

export async function insertDraft(params: {
  noteId: number;
  chatId: string;
  content: string;
  modelUsed: string;
  news: NewsItem | null;
}): Promise<DraftRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("drafts")
    .insert({
      note_id: params.noteId,
      chat_id: params.chatId,
      content: params.content,
      model_used: params.modelUsed,
      news_headline: params.news?.headline ?? null,
      news_source: params.news?.source ?? null,
      news_date: params.news?.date ?? null,
      news_url: params.news?.url ?? null,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as DraftRow;
}

export async function findLatestPendingDraft(
  chatId: string,
  draftId?: number
): Promise<DraftRow | null> {
  const supabase = getSupabase();
  let query = supabase
    .from("drafts")
    .select()
    .eq("chat_id", chatId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  if (draftId) {
    query = supabase
      .from("drafts")
      .select()
      .eq("chat_id", chatId)
      .eq("id", draftId)
      .limit(1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data?.[0] as unknown as DraftRow) ?? null;
}

export async function updateDraftStatus(draftId: number, status: "approved" | "rejected") {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("drafts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", draftId);
  if (error) throw error;
}
