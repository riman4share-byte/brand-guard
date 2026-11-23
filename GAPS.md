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
| 3 | No background detection; browser cannot run scheduled jobs when closed | **P1** | **Open** | Build Edge Function detectors (`detect-domains`, `detect-ct`, `enrich`, `score`, `notify`) scheduled via `pg_cron` + `pg_net`. |
| 4 | Evidence timestamps use the device clock (editable) and client-side canvas watermark | **P2** | **Open** | Build Playwright capture worker polling `capture_jobs`, storing immutable `evidence` rows with server UTC timestamp and SHA-256 hash; reword client-side watermark claims per Section 11. |
| 5 | Data lives in one browser by default; backup is manual | **P0** | **Partially Implemented** | Auth session restore + workspace/brand selector added. IndexedDB stays as offline cache. Full export/import already exists. Cloud sync strips PIN. Full cloud-first migration pending. |
| 6 | No multi-brand / multi-client separation | **P0** | **Partially Implemented** | `workspaces`, `members`, `brands`, `brand_assets` tables created in migration. Frontend workspace/brand picker added (`renderWorkspacePicker`, `Auth.createWorkspace`, `Auth.createBrand`). Active workspace/brand stored in `localStorage`. |
| 7 | Fonts and demo images are cross-origin and not cached offline | **P6** | **Open** | Cache fonts and core assets locally in Service Worker. |
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
