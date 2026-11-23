# Brand Guard (حارس العلامة) — Platform Gaps & Status Tracker

Last Updated: 2026-11-23

## 1. What Is Built (Baseline before Phase 0)
- Single-file bilingual app (`index.html`, `hares-alalama.html`, `brand-guard-en.html`) with IndexedDB local persistence.
- 5 case types (`profile`, `domain`, `phone`, `ad`, `listing`) with smart URL platform/handle detection.
- Arabic & English takedown report generator + direct official platform form links.
- Browser-based Cloudflare DoH lookalike domain scanner (28 permutations) and RDAP Whois/abuse email lookup.
- Link liveness check (`Check Links`).
- 1080×1920 Scam Alert Story Card generator (HTML5 Canvas).
- Official Escalation Center links (UAE, KSA, Global) + printable PDF complaint dossier, CSV export, and JSON backup/restore.
- Offline PWA (`manifest.json`, `sw.js`).
- Public customer report mode (`?report=1`) and Client Visual Manual (`client-manual.html`).

---

## 2. Known Gaps from Blueprint Section 2

| # | Gap Description | Target Phase | Current Status | Notes |
|---|---|---|---|---|
| 1 | Supabase policies in `supabase-schema.sql` use `using (true)` — anyone with the anon key can read/write everything | **P0** | **Implemented** | `supabase/migrations/0001_phase0_foundation.sql` now has strict multi-tenant RLS with `member_role()` helper, zero `anon` policies, and immutable `evidence`/`case_events`. `supabase-schema.sql` updated. |
| 2 | Owner PIN is plaintext, client-side only | **P0** | **Partially Implemented** | PIN stripped from cloud sync. Supabase Auth module (`Auth`) added with email/password sign-in/sign-up/session restore. Workspace/brand management UI added. Roles enforced via RLS server-side. Local convenience PIN lock retained but no longer synced. |
| 3 | No background detection; browser cannot run scheduled jobs when closed | **P1** | **Partially Implemented** | `detect-domains` Edge Function created. Frontend "Suspected" tab (Inbox) added with Confirm/Dismiss/Allowlist. Brand profile editor added. `detector_runs` table + RLS added. Scoring engine unit tests (16 pass). |
| 9 | (New) No proactive Sweep screen for manual coverage tracking | **P3** | **Implemented** | Sweep tab added with per-platform last-swept tracking, stale warnings (>7 days), provider budget display, phone mismatch checker, and public Verify page link. |
| 10 | (New) No public Verify Official Channels page | **P3** | **Implemented** | `?verify=1` renders public verification page with official website, social accounts, phone numbers, and anti-impersonation warning. Copy Verify Link button added to Sweep tab. |
| 11 | (New) No phone normalization / mismatch detection | **P3** | **Partially Implemented** | `normalize_phone()` SQL function (E.164) and `check_phone_mismatch()` added to migration 0004. Frontend phone mismatch checker added to Sweep tab. Full E.164 normalization in UI pending. |
| 12 | (New) No SERP provider adapter or budget guard | **P3** | **Open** | `provider_budget` table added (migration 0004). Frontend shows budget display. Actual SERP provider integration (SerpApi/Apify) pending verification of ToS and pricing. |
| 13 | (New) No customer report triage workflow | **P3** | **Partially Implemented** | Customer reports appear in Suspected tab with `customer` source filter. Confirm/Dismiss/Allowlist actions available. Status updates (`new` → `triaged` → `dismissed`) pending server-side. |
| 4 | Evidence timestamps use the device clock (editable) and client-side canvas watermark | **P2** | **Partially Implemented** | Playwright capture worker (`worker/capture-worker.mjs`) created with SSRF protection, SHA-256 hashing, server UTC timestamps, Wayback Machine submission. `capture_jobs` and `sla_timers` tables added (migration 0003). Case timeline UI, SLA timer display, and Evidence Pack (JSON manifest with hashes) download added. `evidence`/`case_events` immutability enforced at DB level (P0). Client-side watermark reworded in manual to clarify "documented evidence, not legal-grade proof". |
| 5 | Data lives in one browser by default; backup is manual | **P0** | **Partially Implemented** | Auth session restore + workspace/brand selector added. IndexedDB stays as offline cache. Full export/import already exists. Cloud sync strips PIN. Full cloud-first migration pending. |
| 6 | No multi-brand / multi-client separation | **P0** | **Partially Implemented** | `workspaces`, `members`, `brands`, `brand_assets` tables created in migration. Frontend workspace/brand picker added (`renderWorkspacePicker`, `Auth.createWorkspace`, `Auth.createBrand`). Active workspace/brand stored in `localStorage`. |
| 7 | Fonts and demo images are cross-origin and not cached offline | **P6** | **Partially Implemented** | White-label settings (logo, colors, domain) added. Onboarding wizard (5 steps) added. Analytics dashboard with KPIs, status/type/platform breakdowns, monthly report export, and plan limits added. Health status page (`?health=1`) added. PWA push and offline font caching still pending. |
| 14 | (New) No image/visual similarity detection | **P4** | **Partially Implemented** | `image_matches` and `provider_configs` tables added (migration 0005). pHash module (`worker/phash.mjs`) with Hamming distance, similarity scoring, match classification, and TinEye adapter created. Frontend image comparison pending. |
| 15 | (New) No report template registry or escalation ladder | **P5** | **Partially Implemented** | `report_templates`, `form_url_checks`, `repeat_offenders`, `analytics_snapshots`, `escalation_steps` tables added (migration 0006). Default escalation ladders seeded for domain and profile cases. Analytics dashboard added to frontend. Template registry and form URL health checks pending. |
| 16 | (New) No white-label or productization features | **P6** | **Partially Implemented** | `workspace_settings`, `onboarding_progress`, `push_subscriptions`, `health_checks` tables added (migration 0007). White-label settings (logo, colors, domain) and onboarding wizard added to frontend. Plan limit enforcement function added. PWA push, billing hooks, and full white-label still pending. |
| 8 | External integrations (Meta Ad Library, Google Lens, TinEye, RDAP from browser) untested on real mobile phones | **P0** | **Partial** | Verified in desktop headless Chromium (`file://` and `http://`); real iOS Safari / Android Chrome phone test still pending. |

---

## 3. Open Questions & Verify-Before-Build List (Section 20)

| # | Item to Verify | Target Phase | Status | Findings / Decision |
|---|---|---|---|---|
| 1 | Meta Ad Library API coverage for commercial ads in UAE/KSA (D6) | P3 | **Unverified** | Keep as generated deep links in Sweep screen until API coverage is verified. |
| 2 | `crt.sh` / CT source reliability and rate limits for daily polling (D2) | P1 | **Unverified** | Must implement caching, polite rate limit, and fallback adapter. |
| 3 | SERP provider ToS, Arabic result quality, and price per 1k queries (D4) | P3 | **Unverified** | Evaluate SerpApi / Apify / Bright Data + enforce monthly workspace query cap. |
| 4 | Telegram public preview scraping permissions (D5) | P3 | **Unverified** | Verify robots/ToS before building automated channel preview parser. |
| 5 | RFC 3161 TSA choice & Wayback Save Page Now rate limits (Section 11) | P2 | **Unverified** | Verify free/public TSA terms and Internet Archive SPN API limits. |
| 6 | WhatsApp Cloud API template approval & per-conversation cost (Section 13) | P3+ | **Unverified** | Start with Telegram Bot + Email (Resend/Postmark) in P1. |
| 7 | Platform report form URLs change frequently (Section 10) | P5 | **Unverified** | Add `last_verified_at` and automated 404 health check for form URLs. |
| 8 | Legal review of evidence wording, public Verify page, PDPL (UAE/KSA) | P0 / P2 | **Unverified** | Update UI/manual wording in P0/P2 to avoid claiming "legal-grade forensic proof". |
| 9 | Arabic transliteration coverage for brand names | P1 | **Unverified** | Start with manual `aliases` array on `brands` table in P0/P1. |
| 10 | Pricing / positioning: managed service vs software license | P6 | **Unverified** | Decides P6 white-label & billing priority. |
| 11 | Marketplace brand-registry programs (Amazon, Noon, etc.) | P3 / P5 | **Unverified** | Document eligibility per client brand. |
| 12 | Real-phone testing of Lens, TinEye, Ad Library links & RDAP/DoH CORS | P0 | **Unverified** | Must verify on mobile browser during P0 acceptance. |
