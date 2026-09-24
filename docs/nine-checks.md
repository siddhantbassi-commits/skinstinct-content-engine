# Nine Checks — Case 1 / Meera

## Kill Switches — any No = do not build

| # | Check | Evidence | Pass/Fail |
|---|-------|----------|-----------|
| 01 | **Problem Real** — documented, ongoing pain? | 60 unused voice notes over 8 months, 40 abandoned drafts, 11 weeks without a post. Last post drove 340 profile visits and 3 wholesale enquiries. | YES |
| 02 | **Workflow Repeated** — recurs regularly? | 2–3 notes dropped per week, sustained over 8 months. The same abandon-loop repeats across 40 drafts. Not a one-off. | YES |
| 03 | **Input Available** — do inputs exist now? | Telegram channel is active. `notes/` has 60 fragments. `published/` has 15 pieces for voice reference. All exist before the build starts. | YES |

## Sizing — any No = build something smaller

| # | Check | Evidence | Pass/Fail |
|---|-------|----------|-----------|
| 04 | **Output Valuable** — would someone act on it? | 47,000 impressions from 4 posts; one post alone drove 340 profile visits and 3 wholesale enquiries; 6,200 followers waiting. | YES |
| 05 | **Impact Measurable** — trackable with a number? | Baseline ~0.5 posts/month over 8 months vs. target 3/week; stall time baseline 90–180 min/post vs. target 15 min/week. Both trackable from day one. | YES |
| 08 | **ROI Worth It** — benefit clearly outweighs cost? | One converted wholesale enquiry likely exceeds the build + running cost (Gemini Flash + Pro on the free tier, plus free-tier Supabase/Vercel/Google News). | YES |

## Boundary — any No = build the tool, human stays here

| # | Check | Evidence | Pass/Fail |
|---|-------|----------|-----------|
| 06 | **Failure Risk OK** — consequence if AI is wrong? | No output reaches LinkedIn without Meera's approval. Worst case is a bad draft she rejects, not a post live under her name. | YES |
| 07 | **Judgment Protected** — human reviews before anything consequential? | Meera passed on two consultants who built end-to-end, auto-publishing tools. She wants to stay the author of everything published. Auto-scheduling would remove her judgment at the most consequential step. | **NO ← THE CUT** |
| 09 | **Owner Clear** — one person accountable? | Meera reviews, edits, and publishes herself. No ambiguity. | YES |

## The Cut

**Check killed: 07 — Judgment Protected.**

The tool drafts; it never publishes. Every draft — with or without a news angle —
lands back in Telegram as a **pending** item and requires an explicit APPROVE from
Meera before it's treated as ready. There is no code path anywhere in this project
that posts to LinkedIn. When a news item is used, the draft additionally carries a
visible verify flag naming the source, because a fact published under Meera's name
that she hasn't checked is the exact failure this pipeline exists to prevent.
