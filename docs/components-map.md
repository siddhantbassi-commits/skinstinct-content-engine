# Components Map — Case 1 · Meera / Content Engine

| Actor | Trigger | Input | Context | Processing | AI | Output | Code |
|---|---|---|---|---|---|---|---|
| **Meera** | Drops a note into Telegram | — | — | — | — | — | Telegram app |
| **Telegram** | — | Receives the note as text | — | Delivers it to the webhook | — | — | `api/webhook.ts` |
| **Gemini Flash** | — | — | — | Scores the note 0–10 and pulls 3–5 keywords into a search phrase, in one call | Triage judgment (no authorship) | Score + one-line reason + search phrase | `lib/gemini.ts` → `triageNote` |
| **Google News (free)** | — | — | Fetches a relevant, recent article for the search phrase | — | — | Headline, source, date, summary, link | `lib/news.ts` |
| **Gemini Pro** | — | — | Reads the voice profile (`voice-skill.txt` / `voice_skill` table) and the news item | Writes the post in Meera's voice; only cites the news item if it's genuinely relevant, and says so explicitly (`usedNews`) | Drafting — holds voice across a full post | Full LinkedIn post draft + usedNews flag | `lib/gemini.ts` → `draftWithGemini` / `draftWithGeminiPro` |
| **Pipeline** | — | — | — | Appends the verify flag only when `usedNews` is true — a fetched-but-unused article never gets flagged | — | Final draft text | `lib/format.ts` → `appendVerifyFlag` |
| **Supabase** | — | — | — | Persists note + draft, status `pending` | — | Row in `notes`, row in `drafts` | `lib/db.ts`, `supabase/schema.sql` |
| **Review Gate — Meera** | Replies APPROVE / REJECT in Telegram | — | — | Updates draft status | — | `approved` / `rejected`, kept either way | `api/webhook.ts` → `handleDecision` |

## Flow (left to right)

```
Meera --note--> Telegram --webhook--> Gemini Flash (score + search phrase)
                                          |
                                    score < threshold?
                                    yes -> reject message, stop
                                    no  -> Google News (top article)
                                             -> Gemini Pro (draft in voice + news, reports usedNews)
                                             -> append verify flag only if usedNews
                                             -> Supabase (save note + draft, pending)
                                             -> Telegram (send draft back)
                                                   |
                                          Meera: APPROVE / REJECT
                                                   |
                                          Supabase (update draft status)
```

The dashed line in the original answer-key diagram sits between the AI/Processing
columns and the Review Gate row — nothing below that line runs without Meera. In this
codebase that boundary is literal: `handleNewNote` never calls anything that posts to
LinkedIn, and `handleDecision` only ever changes a `status` column in Supabase.
