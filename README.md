# Skinstinct Content Engine

Case 1 / Meera — MESA AI-Native Track. Meera drops a note in Telegram; the pipeline
screens it, finds a news angle if one's relevant, drafts a LinkedIn post in her voice,
and sends it back for her to approve or reject. Nothing publishes without her.

Gemini-only build (no Anthropic/Claude), per course constraint — Gemini Flash handles
triage and keywords, Gemini Pro handles drafting.

## How it works

```
Meera (Telegram) --note--> webhook --> Gemini Flash: score 0-10
                                          |
                                score < 6 ?--yes--> rejection message, stop
                                          |
                                         no
                                          v
                              Gemini Flash: extract search phrase
                                          v
                              Google News RSS: top relevant article
                                          v
                          Gemini Pro: draft in Meera's voice + news angle
                                          v
                    news used? --yes--> append NEWS SOURCE / verify flag
                                          v
                         save note + draft to Supabase, status "pending"
                                          v
                              send draft back to Telegram
                                          v
                 Meera replies APPROVE / REJECT --> draft status updates
```

Nothing ever reaches LinkedIn automatically — see the case's Check 07 (Judgment
Protected). Publishing is Meera's step, done by hand after she reads the draft.

## Project layout

```
api/webhook.ts       Telegram webhook — the only HTTP entrypoint
lib/telegram.ts       send/receive helpers
lib/gemini.ts         scoring, keyword extraction, Gemini Flash + Pro drafting, shared prompt builder
lib/news.ts             Google News RSS fetch, no key needed
lib/voiceSkill.ts     loads the voice profile from Supabase, seeded from voice-skill.txt
lib/format.ts           verify-flag / rejection / delivery message formatting
lib/db.ts                 Supabase reads/writes for notes + drafts
voice-skill.txt        Meera's voice profile, built from the 4 LinkedIn posts + 11
                        newsletters in published/
supabase/schema.sql   the three tables: notes, drafts, voice_skill
```

## Setup — things only you can do

I can't create accounts or generate API keys on your behalf, so these steps are yours.
Everything else (the code) is already done.

### 1. Telegram bot

1. Open Telegram, message **@BotFather**, send `/newbot`, follow the prompts.
2. Copy the token it gives you (`TELEGRAM_BOT_TOKEN`).
3. Message your new bot once so it has a chat to reply into — you'll use that same
   chat to send notes and to read drafts.

### 2. Gemini API key

Go to [Google AI Studio](https://aistudio.google.com/apikey), create a key
(`GEMINI_API_KEY`). Free tier is enough for this.

### 3. Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. Project Settings → API → copy the **Project URL** (`SUPABASE_URL`) and a
   **secret** key (`SUPABASE_SERVICE_ROLE_KEY` — the privileged server-side key;
   on newer projects this is under "Secret keys", not the publishable key).
3. SQL Editor → New query → paste the contents of `supabase/schema.sql` → Run.
   This creates the three tables: `notes`, `drafts`, `voice_skill`.

### 4. Local env file

```bash
cp .env.example .env
```

Fill in the four values above. `.env` is gitignored — never commit it.

### 5. Push to GitHub

```bash
git add -A
git commit -m "Initial content engine build"
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

(If your default branch is `master`, use `git push -u origin master` or rename it
first with `git branch -M main`.)

### 6. Deploy on Vercel

1. [vercel.com](https://vercel.com) → New Project → import the GitHub repo.
2. **Before deploying**, go to the project's Settings → Environment Variables and add
   all four values from your `.env` (all as "Production" — add "Preview"/"Development"
   too if you'll test preview deployments).
3. Deploy. Copy the live URL (`https://your-project.vercel.app`).

### 7. Point Telegram at your deployment

In a browser, visit (with your real token and URL substituted):

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<VERCEL_URL>/api/webhook
```

You should see `"ok":true`. If not: check the token has no stray spaces/newlines, and
that the Vercel URL is a completed production deployment, not a preview.

## Testing

Send a substantive note (something with a specific incident or number, like the sample
notes in `notes/`) to your bot on Telegram. Within a few seconds you should get a draft
back. Reply `APPROVE` or `REJECT`.

Send a thin note (a logistics reminder, a one-line fragment) — you should get a
rejection message instead, no draft.

To compare Gemini Flash vs. Gemini Pro drafting quality on the same note (the case's
"final 15 min" model-comparison checkpoint, done Gemini-only), send:

```
/compare <paste a note here>
```

You'll get two replies, one per model, back to back.

To check persistence: after any run, open the Supabase Table Editor — the note and
draft should be there. Reply APPROVE, refresh the `drafts` table — status should now
read `approved`.

## Config knobs (`.env`)

- `SCORE_THRESHOLD` — minimum 0–10 score a note needs to pass triage (default `6`,
  per the case's B1.1 checkpoint).

## Editing the voice profile later

The voice profile isn't hardcoded into the drafting prompt — it's read from the
`voice_skill` table in Supabase on each cold start (falling back to the bundled
`voice-skill.txt` if the table is empty or unreachable). To refine it without a
redeploy, edit the `content` column of the latest row in `voice_skill` directly in the
Supabase Table Editor.
