# Brand Guard (حارس العلامة) — Ground Rules

- Product: Brand Guard — brand impersonation detection, case tracking, takedown reporting. UI: Arabic RTL first, English LTR second.
- Never auto-submit reports to any platform. Never create or operate fake accounts. Never scrape behind a login.
- Candidates are "suspected" until a human confirms. Never publish or name a suspect publicly before confirmation.
- No secrets in the frontend except the Supabase URL and anon key. Service-role keys live only in Edge Function / worker secrets.
- Every table has RLS enabled. No policy may use `using (true)` for the anon role.
- Every detector is an isolated module with: input, output (candidates), rate limit, timeout, and a recorded detector_run.
- Every external API/provider sits behind an adapter interface so it can be swapped.
- Evidence is immutable: store SHA-256, server-side capture time, never overwrite.
- All user-facing strings go through tr(ar, en). Dates shown in the user's timezone, stored in UTC.
- One feature per task. Write tests for scoring, normalization, and RLS before UI.
- Keep a GAPS.md updated every phase: what is built, what is partial, what is unverified.
