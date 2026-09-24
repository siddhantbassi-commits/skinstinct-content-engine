# Components Map — Case 1 · Meera / Content Engine

| Actor | Trigger | Input | Context | Processing | AI | Output | Code |
|---|---|---|---|---|---|---|---|
| **Meera** | Drops a note into Telegram | — | — | — | — | — | Telegram app |
| **Telegram** | — | Receives the note as text | — | Delivers it to the webhook | — | — | `api/webhook.ts` |
| **Gemini Flash** | — | — | — | Scores the note 0–10; rejects anything below the threshold | Triage judgment (no authorship) | Score + one-line reason | `lib/gemini.ts` → `scoreNote` |
| **Gemini Flash** | — | — | — | Pulls 3–5 keywords into a search phrase | Keyword extraction | Search phrase | `lib/gemini.ts` → `extractSearchPhrase` |
| **Google News (free)** | — | — | Fetches a relevant, recent article for the search phrase | — | — | Headline, source, date, summary, link | `lib/news.ts` |
| **Claude** (or Gemini via `DRAFT_MODEL`) | — | — | Reads the voice profile (`voice-skill.txt` / `voice_skill` table) and the news item | Writes the post in Meera's voice; uses the news item only if it fits naturally | Drafting — holds voice across a full post | Full LinkedIn post draft | `lib/claude.ts`, `lib/gemini.ts` → `draftWithClaude` / `draftWithGemini` |
| **Pipeline** | — | — | — | Appends the verify flag if a news item was used | — | Final draft text | `lib/format.ts` → `appendVerifyFlag` |
| **Supabase** | — | — | — | Persists note + draft, status `pending` | — | Row in `notes`, row in `drafts` | `lib/db.ts`, `supabase/schema.sql` |
| **Review Gate — Meera** | Replies APPROVE / REJECT in Telegram | — | — | Updates draft status | — | `approved` / `rejected`, kept either way | `api/webhook.ts` → `handleDecision` |

## Flow (left to right)

```
Meera --note--> Telegram --webhook--> Gemini Flash (score)
                                          |
                                    score < threshold?
                                    yes -> reject message, stop
                                    no  -> Gemini Flash (keywords)
                                             -> Google News (top article)
                                             -> Claude/Gemini (draft in voice + news)
                                             -> append verify flag if news used
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
