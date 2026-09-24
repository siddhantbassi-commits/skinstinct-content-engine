-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- Three tables per the B1 memory checkpoint: notes, drafts, voice_skill.

create table if not exists voice_skill (
  id bigint generated always as identity primary key,
  content text not null,
  updated_at timestamptz not null default now()
);

create table if not exists notes (
  id bigint generated always as identity primary key,
  chat_id text not null,
  telegram_message_id bigint,
  content text not null,
  score int,
  score_reason text,
  -- status: 'received' -> 'passed' or 'rejected'
  status text not null default 'received',
  created_at timestamptz not null default now()
);

create table if not exists drafts (
  id bigint generated always as identity primary key,
  note_id bigint references notes (id),
  chat_id text not null,
  content text not null,
  model_used text not null,
  news_headline text,
  news_source text,
  news_date text,
  news_url text,
  -- status: 'pending' -> 'approved' or 'rejected'
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_drafts_chat_status on drafts (chat_id, status, created_at desc);
create index if not exists idx_notes_chat on notes (chat_id, created_at desc);

-- Rejected notes and rejected drafts are kept, not deleted (see execution plan B1.3) —
-- there is deliberately no delete path in the application code for either table.
