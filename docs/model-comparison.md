# Final Checkpoint — Model Comparison

The case's B1 wrap-up asks: swap the drafting model, run the same note through both,
and write down in one sentence what changed. This build is Gemini-only (see
[nine-checks.md](nine-checks.md) — no Anthropic per course constraint), so the
comparison is **Gemini Flash vs. Gemini Pro** on identical inputs, in place of the
case's Gemini-vs-Claude exercise. Reproducible via `/compare <note>` in the Telegram
bot, or the same call directly against `lib/gemini.ts`.

## Test note

Note 01 from the sample set — the batch-fourteen pH/preservative-drift incident.

## What changed

**Flash fabricated specifics the note never gave it**: an exact baseline pH ("5.3" vs.
a measured "4.9"), a viscosity drop ("roughly 17%"), a unit count on hold ("2,400
units"), lab tests never mentioned ("passed microbial challenge testing... heavy
metals"), and even a motive for the supplier's change ("to meet a regulatory update in
the EU"). None of that is in the source note — Flash invented plausible-sounding data
to make the post feel more substantiated.

**Pro stayed inside what the note actually said.** It used the note's own "0.4 units"
figure, didn't invent additional numbers, and didn't assert anything beyond what Meera
described. Its closing line — *"If they simply tell you the formula has not changed,
they might actually believe it"* — is also the sharper, more voice-consistent ending of
the two.

## Why this matters for this specific build

Meera's entire published voice is built on not overclaiming data — she flags exactly
where evidence is thin, cites her own real numbers, and explicitly criticizes brands
that assert more than their documentation supports (see `newsletter_003`,
`newsletter_010`, `linkedin_post_004` in the seed data). A model that fabricates a
precise-sounding pH baseline or a batch-size figure isn't just stylistically off for
her — it's the exact failure mode her writing is about. That's the concrete version of
"holds voice better across a full post": not just tone, but not inventing the kind of
specific claim she'd insist on actually having data for.

**One-sentence answer:** Pro stayed faithful to only the facts in the note while Flash
fabricated several precise-sounding data points to fill the piece out — for a founder
whose entire voice is "don't claim what you can't document," that makes Pro the right
default for drafting even at roughly 2-3x Flash's latency.
