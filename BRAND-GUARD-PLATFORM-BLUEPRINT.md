# Brand Guard (حارس العلامة) — Detect · Track · Report Platform Blueprint

Purpose: turn the current single-file tracker into a real brand-protection platform that **detects** impersonation automatically, **tracks** every case to closure, and **reports** with solid evidence — with a human always confirming before anything is reported.

How to use this file: give it to OpenCode together with the project folder. Build **one phase at a time** (Section 17). After each phase, run the phase's acceptance checklist before moving on. Do not start the next phase until the current one passes.

---

## 0. Ground rules (copy into AGENTS.md)

```
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
```

---

## 1. Product definition

**Users**
- **Owner** (agency/you or the brand owner): full control, billing, brands, settings.
- **Staff**: triage candidates, manage cases, generate reports. Cannot delete brands or change settings.
- **Viewer** (client): read-only dashboard, analytics, evidence packs.
- **Public customer**: submits a suspicious link/screenshot via the public form; sees the brand's public "Verify official channels" page.

**Core loop**
1. **Detect** — scheduled detectors + customer reports create *candidates*.
2. **Triage** — human confirms (becomes a *case*), dismisses, or allowlists.
3. **Document** — server captures evidence with hashes and timestamps.
4. **Report** — app generates platform-specific report text + evidence pack and deep-links to the official form; a human submits.
5. **Track** — reference IDs, follow-up timers, escalation ladder, liveness checks until closed.
6. **Warn** — scam-alert story card + public verification page.
7. **Learn** — dismissals and confirmations tune scoring; analytics show what works.

**Honest scope statement:** reliable automated detection is strong for **domains/websites** and **customer reports**; **social accounts, ads, and phone numbers** are only partly automatable (no official search APIs). The platform combines paid search providers, customer reports, and a structured manual sweep to cover them. Do not promise full coverage to clients.

---

## 2. Current state and known gaps (from review)

Built: single-file app (IndexedDB), 5 case types, report generator (AR/EN), RDAP lookup, DNS lookalike scan (browser DoH), story card, escalation links UAE/KSA/global, link liveness, PWA, optional Supabase sync, public report form, owner/staff PIN.

Known gaps to close:
| # | Gap | Fixed in |
|---|-----|----------|
| 1 | Supabase policies are `using (true)` — anyone with the key can read/write everything | P0 |
| 2 | Owner PIN is plaintext, client-side only | P0 |
| 3 | No background detection; browser cannot run scheduled jobs | P1 |
| 4 | Evidence timestamps use the device clock (editable) | P2 |
| 5 | Data lives in one browser; backup is manual | P0 |
| 6 | No multi-brand / multi-client separation | P0 |
| 7 | Fonts/demo images are cross-origin and not cached offline | P6 |
| 8 | External integrations (Ad Library, Lens, TinEye, RDAP from browser) untested on real phones | P0 checklist |

---

## 3. Target architecture

```
                 ┌────────────────────────────────────────────┐
  Browser/PWA ──▶│ Frontend (single-file → modular later)     │
  (owner/staff/  │ Auth (Supabase), Inbox, Cases, Brands,     │
   viewer)       │ Evidence, Reports, Analytics, Settings      │
                 └───────────────┬────────────────────────────┘
                                 │ HTTPS (JWT)
                 ┌───────────────▼────────────────────────────┐
                 │ Supabase                                    │
                 │  Postgres (RLS, multi-tenant)               │
                 │  Auth  ·  Storage (private buckets)         │
                 │  Edge Functions (TypeScript/Deno)           │
                 │  pg_cron + pg_net (schedules)               │
                 └───────┬───────────────────────┬────────────┘
                         │                       │
        ┌────────────────▼───────┐   ┌───────────▼────────────────┐
        │ Detectors (Edge Fns)   │   │ Capture worker             │
        │ domains, CT, SERP,     │   │ (GitHub Actions or small   │
        │ liveness, enrichment   │   │ VPS): Playwright, pHash,   │
        └────────────┬───────────┘   │ screenshots, timestamping  │
                     │               └───────────┬────────────────┘
        ┌────────────▼───────────────────────────▼──────┐
        │ External: Cloudflare DoH, RDAP, crt.sh/CT,     │
        │ SERP provider, TinEye (opt), Telegram, Email,  │
        │ WhatsApp Cloud API (opt), Wayback, RFC3161 TSA │
        └────────────────────────────────────────────────┘
```

**Decisions**
- Backend: **Supabase** (already used; free tier is enough to start).
- Scheduling: **pg_cron → pg_net → Edge Function**.
- Browser-needed work (screenshots, visual similarity, perceptual hashing): **capture worker** polling a `capture_jobs` queue (GitHub Actions cron every 15 min to start; move to a small VPS/Fly.io if latency matters). Edge Functions cannot run a browser.
- Frontend: keep single-file through P1. If it exceeds ~3,000 lines or needs auth/session complexity, migrate to Vite + TypeScript modules (ask the owner first), keeping Arabic RTL, IndexedDB offline cache, and PWA.
- Offline: IndexedDB stays as a **local cache/queue** of the cloud data; edits made offline sync when online (last-write-wins with `updated_at`, conflicts logged).

---

## 4. Data model (reference schema — turn into migrations)

```sql
-- Multi-tenant core
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

create table members (
  workspace_id uuid references workspaces on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null check (role in ('owner','staff','viewer')),
  primary key (workspace_id, user_id)
);

create or replace function member_role(ws uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from members where workspace_id = ws and user_id = auth.uid()
$$;

-- A client brand
create table brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  name text not null,
  name_ar text,
  aliases text[] default '{}',            -- spellings, abbreviations, transliterations
  keywords text[] default '{}',           -- product names, slogans
  official_domains text[] default '{}',
  official_handles jsonb default '{}',    -- {"instagram":["x"],"tiktok":["y"]}
  official_phones text[] default '{}',
  trademark_no text, license_no text,
  countries text[] default '{AE}',
  logo_path text,
  allowlist jsonb default '[]',           -- known resellers/partners (domains/handles)
  public_slug text unique,                -- for the public verify page
  created_at timestamptz default now()
);

create table brand_assets (               -- logos + product photos for image matching
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands on delete cascade,
  kind text check (kind in ('logo','product')),
  storage_path text not null,
  phash text,                             -- 64-bit perceptual hash (hex)
  created_at timestamptz default now()
);

-- Detection output (suspected)
create table candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  brand_id uuid not null references brands on delete cascade,
  kind text not null check (kind in ('domain','account','phone','ad','listing','other')),
  platform text,
  url text, handle text, title text,
  normalized_key text not null,           -- dedupe key (e.g. domain, platform:handle, e164 phone)
  source text not null,                   -- detector name or 'customer'
  score int not null default 0,           -- 0..100
  signals jsonb not null default '{}',   -- explainable scoring breakdown
  status text not null default 'new' check (status in ('new','confirmed','dismissed','allowlisted')),
  dismissed_reason text,
  first_seen timestamptz default now(),
  last_seen timestamptz default now(),
  unique (workspace_id, brand_id, normalized_key)
);

-- Confirmed impersonations
create table cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  brand_id uuid not null references brands on delete cascade,
  candidate_id uuid references candidates,
  kind text not null, platform text, url text, handle text,
  status text not null default 'detected'
    check (status in ('detected','evidence_ready','reported','under_review','escalated','removed','rejected','closed')),
  priority int default 2,                 -- 1 high .. 3 low
  ref_id text,                            -- platform report/ticket number
  reported_at timestamptz, last_checked_at timestamptz,
  live_status text,                       -- 'live','down','nxdomain','unknown'
  notes text,
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);

create table case_events (                -- append-only timeline
  id bigint generated always as identity primary key,
  case_id uuid references cases on delete cascade,
  type text not null,                     -- status_change, reported, followup, evidence_added, note, liveness
  data jsonb default '{}', actor uuid, created_at timestamptz default now()
);

create table evidence (                   -- immutable
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases on delete cascade,
  kind text check (kind in ('screenshot','html','pdf','whois','dns','video','upload')),
  storage_path text not null,
  sha256 text not null,
  source_url text,
  captured_at timestamptz not null default now(),   -- SERVER time only
  capture_method text,                    -- 'worker-playwright' | 'user-upload'
  tsa_token text,                         -- RFC 3161 token (optional)
  archive_url text,                       -- Wayback snapshot (optional)
  created_at timestamptz default now()
);

create table capture_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid, case_id uuid, candidate_id uuid,
  url text not null, status text default 'queued', attempts int default 0,
  error text, created_at timestamptz default now(), finished_at timestamptz
);

create table detector_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid, brand_id uuid, detector text not null,
  started_at timestamptz default now(), finished_at timestamptz,
  status text, stats jsonb default '{}', error text
);

create table customer_reports (           -- public submissions land here only
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null, brand_id uuid,
  url text, description text, contact text,
  files jsonb default '[]',
  ip_hash text, status text default 'new',
  created_at timestamptz default now()
);

create table notification_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  kind text check (kind in ('telegram','email','whatsapp','push')),
  target text not null,                   -- chat id / address / phone
  min_score int default 60, digest boolean default false, enabled boolean default true
);

create table report_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid, platform text, kind text, lang text,
  body text not null, form_url text, version int default 1
);

create table audit_log (
  id bigint generated always as identity primary key,
  workspace_id uuid, actor uuid, action text, entity text, entity_id text,
  data jsonb, created_at timestamptz default now()
);
```

**RLS pattern (every table with `workspace_id`)**
```sql
alter table cases enable row level security;
create policy "members read"  on cases for select to authenticated using (member_role(workspace_id) is not null);
create policy "staff write"   on cases for insert to authenticated with check (member_role(workspace_id) in ('owner','staff'));
create policy "staff update"  on cases for update to authenticated using (member_role(workspace_id) in ('owner','staff'));
create policy "owner delete"  on cases for delete to authenticated using (member_role(workspace_id) = 'owner');
-- anon: NO policy on any table. Public form goes through an Edge Function.
```
`evidence` and `case_events`: insert allowed, **update/delete denied for everyone** (immutability). Storage buckets are private; the app uses short-lived signed URLs.

---

## 5. Auth, roles, and the public form

- Supabase Auth email + password (add magic link/TOTP 2FA for owners). **Disable open sign-ups**; owners invite staff/viewers.
- Replace the plaintext PIN. Staff/owner is a real role from `members`. Remove PIN from settings and from cloud sync. If a quick local lock is still wanted, store a salted SHA-256 hash locally only and label it "convenience lock".
- **Public report form** (`?report=<brand_slug>`): posts to Edge Function `submit-report`, which:
  - verifies a CAPTCHA (Cloudflare Turnstile or hCaptcha),
  - rate-limits by hashed IP (e.g. 5/hour),
  - validates URL/size, accepts up to 3 images ≤ 3 MB each (re-encoded server-side, EXIF stripped),
  - inserts into `customer_reports` with the service role,
  - creates a `candidates` row (`source='customer'`, base score 70) and notifies the owner.
- The anon key is never allowed to read anything.

---

## 6. Detectors

Each detector: input = brand profile; output = candidates with `signals`; writes a `detector_runs` row; has a timeout, retry with backoff, and a per-provider rate limit. Runs per brand per schedule.

### D1. Lookalike domains (Phase 1 — free, high value)
- Generate permutations in TypeScript: omission, repetition, transposition, keyboard-adjacent replacement, homoglyphs (Latin/Cyrillic/Arabic-Indic look-alikes), insertion, hyphenation, vowel swap, **keyword combos** (`-shop`, `-official`, `-store`, `-uae`, `outlet`, `sale`), **TLD swaps** (`.com .ae .shop .store .online .site .xyz .co .net .sa .me .app .vip .top`).
- Add **Arabic/Latin transliteration variants** from `aliases` (manually curated per brand; automate later).
- Cap permutations per brand (default 3,000); prioritize by likelihood.
- Resolve with Cloudflare DoH (`A/AAAA/NS/MX`) in batches with concurrency limit; keep only registered domains.
- Enrich each hit: RDAP (registrar, creation date, nameservers, abuse email), hosting (IP → ASN/provider, Cloudflare detection), HTTP fetch (status, title, has login/cart, brand words present, copied logo hash).
- Optional heavier coverage: run **dnstwist** in the worker (Python) weekly and merge results.
- Re-scan new/changed only; store `first_seen/last_seen`.

### D2. Certificate Transparency watcher (Phase 1)
- Query CT sources for certificates containing brand strings and aliases (crt.sh JSON; or a streaming source). **Verify availability/stability before relying on it**; crt.sh can be slow/flaky — implement caching, polite rate limits, and a fallback provider adapter.
- A new certificate for a lookalike name is a strong, early signal (often before the fake shop goes live).
- Feed hits into the same enrichment/scoring as D1.

### D3. Customer reports (Phase 1/3)
- From Section 5. Highest-precision source in practice. Show reporter-supplied screenshot and URL in the Inbox; thank-you message; optional follow-up if the reporter left contact details.

### D4. Social accounts and ads via search provider (Phase 3 — paid, partial)
- Reality: Instagram, TikTok, X, Facebook, Snapchat have no official brand-impersonation search APIs. Scraping them is fragile and may violate their terms.
- Approach: a **SERP/scraping provider adapter** (e.g. SerpApi, Apify actors, Bright Data, or similar — **evaluate cost, ToS, and Arabic coverage first**). Queries per brand: `site:instagram.com "<brand>"`, `site:tiktok.com "<brand>"`, `site:facebook.com "<brand>"`, handle variants, brand + "official", brand + city/country, brand + "wholesale/offer/discount", Arabic names, WhatsApp wa.me links with brand text.
- Parse results into candidates (platform, handle, title, snippet). Score using Section 7.
- Budget guard: monthly query cap per workspace; stop and alert when reached.
- **Structured manual sweep** (always available, free): a "Sweep" screen generates the exact search links (Instagram search, TikTok, Facebook, X, Snapchat, Google, Meta Ad Library, TikTok Creative Center) with handle variants; the user ticks each as checked, adds suspects with one tap, and the app logs sweep date/coverage per brand. This is the honest fallback for platforms without APIs.

### D5. Phone / WhatsApp / Telegram (Phase 3)
- Mostly customer-reported or found via D4 snippets. Normalize to E.164 (`normalized_key`), flag numbers that differ from `official_phones` but appear next to the brand name.
- Telegram: only **public** channel preview pages; respect robots/ToS; verify what is allowed before building.
- Never contact scammers or message numbers from the platform.

### D6. Ads (Phase 3, semi-manual)
- **Meta Ad Library**: verify current API coverage for commercial ads in the UAE/KSA before building. Until verified, keep it as generated deep links in the Sweep screen, plus a one-tap "register as case" with screenshot upload.
- Store/marketplace listings (Amazon, Noon, Temu, AliExpress, Facebook Marketplace, Dubizzle): use D4 provider queries; consider marketplace brand-registry programs (Amazon Brand Registry etc.) as extra report channels.

### D7. Image reuse and visual similarity (Phase 4)
- On upload of brand assets, compute **perceptual hash (pHash/dHash)** in the worker and store it.
- For every candidate page (D1, D2, D4), the worker downloads page images, hashes them, and compares to brand_assets (Hamming distance threshold, tunable). Also compare full-page screenshot similarity (downscaled hash / SSIM) against the brand's real site.
- Optional paid reverse search (TinEye API) for high-priority brands. Google Lens has no official API — keep as a manual link.

### D8. Link liveness and change monitoring (Phase 2)
- For every open case: daily check (DoH + HTTP HEAD/GET, redirect chain, content hash). States: `live`, `down`, `nxdomain`, `parked`, `changed`.
- On `down/nxdomain` for 2 consecutive checks → suggest status `removed` with one tap; on `changed` → re-capture evidence.
- Keep requests low-frequency; backoff on errors; set a clear User-Agent.

### D9. Enrichment and abuse routing (Phase 2/5)
- Domain → registrar abuse email/form (from RDAP), hosting provider abuse contact, Cloudflare-proxied? (use Cloudflare abuse form; real origin is hidden), Google Safe Browsing reporting, ICANN complaint path.
- Output a ranked **escalation ladder** per case (Section 10).

---

## 7. Scoring engine (explainable, tunable)

Score 0–100, stored with a `signals` JSON so the UI can show **why** (never a black box).

| Signal | Points | Notes |
|---|---|---|
| Exact brand name/alias in domain/handle | +25 | after normalization |
| Edit distance ≤ 2 from official | +20 | |
| Homoglyph/transliteration match | +20 | |
| Brand keywords + "shop/official/outlet/sale" | +10 | |
| Domain registered < 30 days | +20 | < 90 days +10 |
| Privacy-protected / bulk registrar / cheap TLD | +5 | weak signal alone |
| Page contains brand name, logo hash match, or copied product images | +20 to +30 | D7 |
| Page has checkout/WhatsApp contact, not in official list | +10 | |
| Shown phone ≠ official phone | +15 | |
| Reported by a customer | +30 | |
| Same registrant/nameserver/IP as an already confirmed case | +15 | clustering |
| **Allowlisted** (official, partner, reseller) | → 0 | hard override |
| Fan/news/review page (title heuristics) | −15 | lowers false positives |

Thresholds (tunable per workspace): **≥70 high** (instant alert), **40–69 review** (daily digest), **<40 hidden** (visible with filter).
Feedback loop: dismissal reasons (`fan page`, `reseller`, `unrelated`, `duplicate`) adjust per-brand allowlist and signal weights suggestions; log all changes. Unit-test the scorer with fixtures (real-looking examples and known-safe ones).

---

## 8. Inbox (triage) UX

- New top-level tab **Suspected (الرصد)** with badge count.
- Card: preview screenshot, URL/handle, score with signal chips, first seen, source, domain age/registrar/host.
- Actions: **Confirm → create case** (opens case pre-filled, queues capture job), **Dismiss** (reason), **Allowlist**, **Snooze 7d**, **Merge with existing case**.
- Bulk actions; filters (brand, kind, score, source, date); keyboard shortcuts on desktop; large tap targets on mobile.
- Cluster view: group candidates sharing registrant/IP/phone/handle pattern ("this network has 6 fakes").

---

## 9. Case lifecycle and tracking

States: `detected → evidence_ready → reported → under_review → escalated → removed | rejected | closed`.
- Every transition writes `case_events` and shows a timeline.
- **SLA timers** per platform (configurable): default follow-up at 3 / 7 / 14 days after `reported`; overdue banner and notifications.
- `rejected` prompts a re-report with a different category/form or escalation.
- Reference IDs, screenshots of platform replies (uploaded as evidence), tags, assignee, priority.
- **Repeat offender tracking**: link new cases to prior ones (same operator signals) and show history in reports to authorities.
- Reopen automatically if a `removed` target comes back live.

---

## 10. Reporting engine

**Principle:** generate everything, submit nothing automatically.

1. **Report text**: template per platform × case kind × language (AR/EN), filled from brand profile (trademark no., license no., official links) and case data. Editable before use. Templates versioned in `report_templates`.
2. **Deep links** to each platform's official trademark/impersonation form (keep a maintained registry with `last_verified_at`; surface a "link may be outdated" flag and a health check that detects 404s).
3. **Evidence pack** (ZIP + PDF): case summary, timeline, screenshots, HTML snapshot, WHOIS/RDAP, DNS records, hash manifest (SHA-256 of every file), capture times, brand ownership proof checklist (trademark certificate, trade license, power of attorney).
4. **Escalation ladder (per case kind)**
   - Account/ad: platform impersonation or trademark form → platform appeal/rejection follow-up → authority complaint (UAE: Dubai Police eCrime, Consumer Rights; KSA: SAIP, MoC; as listed in the existing escalation center).
   - Website: registrar abuse → hosting provider abuse → Cloudflare abuse (if proxied) → Google Safe Browsing → local registry/TDRA/CST → UDRP/legal counsel for high-value cases.
   - Phone/WhatsApp/Telegram: WhatsApp/Telegram report flows → telecom/authority report where applicable.
5. **Email abuse sends** (registrar/host): composed in-app, sent only after the user clicks "Send" through a transactional email provider (Resend/Postmark) from the client's domain, with the evidence pack link; log the message-id in `case_events`.
6. **Counter-notice readiness**: keep the ownership proof and correspondence history together.
7. **Public warning**: scam-alert story card (existing) + public **Verify Official Channels** page (Section 12).

---

## 11. Evidence integrity (be honest about legal weight)

- **Server-side capture** by the worker: Playwright full-page screenshot, rendered HTML, HAR/headers, final URL after redirects, TLS certificate details, desktop and mobile viewports. Capture time = server UTC, never the device clock.
- Compute SHA-256 on capture, store in `evidence`, and make rows immutable.
- **Third-party corroboration (optional but valuable):** submit the URL to the Internet Archive (Save Page Now) and store the snapshot URL; apply an **RFC 3161 trusted timestamp** token to the evidence manifest hash (use an established TSA; verify terms/availability).
- User-uploaded screenshots are labelled `user-upload` and flagged as lower trust.
- The existing client-side watermark remains as a convenience overlay, but the manual and UI must **not** claim legal-grade evidence. Recommended wording: "documented evidence supporting your report; admissibility depends on the jurisdiction — consult counsel; notarization or a licensed digital-forensics service is recommended for litigation."
- For high-stakes cases, offer a checklist for notarized capture (e.g. a notary or forensic provider).

---

## 12. Customer-facing features

- **Public "Verify Official Channels" page** per brand (`/v/<slug>`): official website, handles, phone numbers, WhatsApp, branches, QR code, "how to spot fakes", and a button "Report a suspicious account". Share it in bios and invoices. Strong preventive value and a good client selling point.
- **Scam-alert story card** generator (existing) with the brand's official handles; add Arabic/English variants and a WhatsApp-status size.
- **Customer report form** (Section 5) with a confirmation message and an optional status update ("the account you reported was removed").

---

## 13. Alerts and notifications

- **Telegram bot** (free, fastest to ship): instant alert for score ≥ 70, daily digest for 40–69, overdue follow-ups, removal confirmations. Inline buttons: Open case / Dismiss.
- **Email** (Resend/Postmark): same events, plus weekly summary PDF for the client.
- **WhatsApp Cloud API** (optional, later): requires approved message templates and business verification; costs and rules change, so verify before committing. Start with Telegram + email.
- **Web push** for the PWA (VAPID) as an in-app option.
- Per-channel settings: minimum score, quiet hours (default 22:00–07:00 Asia/Dubai), digest vs instant, per-brand routing.

---

## 14. Analytics and client reporting

- KPIs per brand and period: candidates found, confirmed, false-positive rate, cases by kind/platform, **median time to removal**, removal rate by platform, open/overdue cases, coverage (last sweep date per platform).
- Monthly **client report** (PDF): activity summary, before/after counts, top threats, actions taken, upcoming risks. This is the deliverable for the "service" positioning.
- Export: CSV/JSON of all data (full backup/restore, including images).

---

## 15. Security, privacy, compliance

- Threat model basics: leaked anon key (assume public), stolen staff account, malicious public submissions (XSS, huge files, URL tricks), SSRF through "fetch this URL" features.
- Controls: RLS everywhere with automated policy tests; CAPTCHA + rate limits; strict input validation; **SSRF protection in the worker** (block private IP ranges, metadata endpoints, non-http(s) schemes, limit redirects/size/time); sanitize and never `innerHTML` untrusted text; Content-Security-Policy; escape Arabic/RTL control characters in displayed URLs (spoofing).
- Secrets only in Edge Function/worker secret stores; rotate keys; separate dev and prod Supabase projects.
- Audit log for logins, exports, deletes, status changes, and settings.
- Backups: Supabase daily backups + weekly encrypted export to the owner's storage. Test restore once per phase.
- Data protection: the platform stores reporter contact details and screenshots that may include personal data. Define retention (e.g. delete unconfirmed candidates after 90 days; customer contact after case closure + 12 months) and a privacy notice on the public form. **Check UAE (Federal Decree-Law 45/2021) and KSA PDPL obligations with a local lawyer.**
- Legal guardrails: no accessing accounts without authorization, no impersonating users, no automated mass-reporting, comply with each source's terms, treat candidates as unproven allegations (defamation risk), and let counsel review public-facing wording.

---

## 16. Infrastructure and cost (estimates — verify current pricing)

| Item | Start | Notes |
|---|---|---|
| Supabase | Free → Pro | Pro needed for backups, higher limits, longer cron/Edge usage |
| Hosting (static app) | Free | Netlify/Vercel/GitHub Pages/Cloudflare Pages |
| GitHub Actions worker | Free tier | Move to a small VPS if captures queue up |
| SERP/scraping provider | ~$20–100+/mo | depends on queries and brands |
| TinEye API (optional) | paid per search | high-priority brands only |
| Email (Resend/Postmark) | free tier → low | |
| Telegram | free | |
| WhatsApp Cloud API | per-conversation fees | optional |
| CAPTCHA (Turnstile) | free | |

Cost controls: per-workspace query budgets, caps on permutations/captures, backoff, and alerts when a cap is reached.

---

## 17. Phased roadmap with acceptance criteria

### P0 — Security and foundation (do first)
Build: Supabase Auth login (owner/staff/viewer), `workspaces/members/brands` schema, RLS on all tables, Edge Function `submit-report` with CAPTCHA + rate limit, remove plaintext PIN, cloud-first with IndexedDB cache, full export/import, migrate existing local cases into a workspace/brand, real-phone test of external links.
Accept:
- [ ] Anon key cannot read or write any table (automated test proves it).
- [ ] A user in workspace A cannot see workspace B (test).
- [ ] Public form works only through the Edge Function; oversized/invalid input rejected.
- [ ] PIN removed from DB/sync; roles enforced server-side.
- [ ] Export → wipe → import restores everything including images.
- [ ] Existing app features still work (regression checklist).

### P1 — Detection v1: domains + CT + inbox + alerts
Build: D1, D2, enrichment (RDAP/hosting/HTTP), scoring engine, `candidates` + Inbox UI, Telegram + email alerts, pg_cron schedules, `detector_runs` dashboard, brand profile editor (aliases, keywords, allowlist).
Accept:
- [ ] A seeded test brand with a registered lookalike domain produces a candidate within one scheduled run.
- [ ] Scorer unit tests pass (fixtures for true positives, fan pages, resellers).
- [ ] Allowlisted domains never alert.
- [ ] Confirm creates a case; Dismiss records a reason.
- [ ] Alert delivered to Telegram/email with a working deep link.
- [ ] A failing detector shows in `detector_runs` and alerts the owner, without crashing others.

### P2 — Evidence and tracking
Build: capture worker (Playwright) + `capture_jobs`, immutable `evidence` with SHA-256 and server time, Wayback + optional RFC 3161, D8 liveness/change monitoring, case timeline, SLA timers, evidence pack (ZIP + PDF with hash manifest).
Accept:
- [ ] Confirming a case yields screenshots (desktop + mobile) and HTML within 15 minutes.
- [ ] Evidence rows cannot be updated/deleted (test).
- [ ] Hash manifest verifies after download.
- [ ] Liveness detects a taken-down test domain and proposes `removed`.
- [ ] Worker blocks SSRF targets (test with private IPs).

### P3 — Social, ads, phones, customers
Build: D4 provider adapter + budget guard, Sweep screen (manual checklist with coverage log), D5 phone normalization, D6 ad/listing flow, customer-report triage and status updates, public Verify page.
Accept:
- [ ] Provider outage or budget cap degrades gracefully with a visible warning.
- [ ] Sweep screen logs coverage per platform and warns when stale (> 7 days).
- [ ] Phone numbers normalize and match official numbers correctly (tests with +971/+966 formats).
- [ ] Public Verify page loads fast, works offline-cached, and exposes no private data.

### P4 — Image and visual similarity
Build: pHash for brand assets, worker image comparison, page-screenshot similarity vs official site, optional TinEye adapter.
Accept:
- [ ] Known copied product image from a test page is flagged with a score contribution and shown side-by-side.
- [ ] False-positive rate measured on a labelled sample and recorded in GAPS.md.

### P5 — Reporting automation and escalation
Build: template registry with versions, form-link health checks, escalation ladder UI, registrar/host abuse routing, email-send with logging, follow-up automation, repeat-offender linking, analytics and monthly client PDF.
Accept:
- [ ] For a domain case, the app proposes the correct next escalation step and generates the email with evidence link.
- [ ] Nothing is sent without an explicit click (test).
- [ ] Monthly report matches database counts.

### P6 — Productization
Build: white-label per client (logo, colors, domain), onboarding wizard (brand profile + assets + official channels), billing hooks, usage limits per plan, PWA push, offline-cache of fonts/assets, docs and client manual refresh, status/health page.
Accept:
- [ ] New client onboarded end-to-end in under 30 minutes.
- [ ] Plan limits enforced server-side.
- [ ] Manual/screenshots regenerated and accurate.

---

## 18. Testing strategy

- **Unit**: permutation generator, normalization (domains, handles, E.164, Arabic/Latin), scorer, template filling.
- **RLS tests**: run as anon, as user A, as user B, as viewer; assert allowed/denied operations per table.
- **Integration**: detector run against a controlled sandbox domain set; capture worker against a local test site; SSRF blocklist.
- **E2E (Playwright)**: login → add brand → candidate appears → confirm → evidence → report pack → mark reported → follow-up.
- **Mobile**: iOS Safari + Android Chrome, Arabic RTL, install as PWA.
- **Load/limits**: 10 brands × 3,000 permutations without exceeding provider limits or function timeouts.
- **Failure drills**: provider down, DNS timeouts, worker crash, duplicate runs (idempotent upserts via `normalized_key`).

---

## 19. Ready-to-paste OpenCode prompts

**Setup**
```
Read BRAND-GUARD-PLATFORM-BLUEPRINT.md fully and the current index.html, sw.js, manifest.json, supabase-schema.sql. Create AGENTS.md from Section 0 and GAPS.md listing every gap in Section 2 with status. Do not change app code yet. Reply with a short plan for Phase 0 and any questions.
```

**P0**
```
Implement Phase 0 from the blueprint only. Create SQL migrations from Section 4 (workspaces, members, brands, brand_assets, candidates, cases, case_events, evidence, customer_reports, audit_log) with RLS exactly as described and no anon policies. Add Supabase Auth login to the app, role enforcement in UI and server, Edge Function submit-report (Turnstile verification, hashed-IP rate limit, validation, image re-encode, service-role insert). Remove the plaintext PIN and stop syncing it. Add IndexedDB as an offline cache that syncs to the cloud. Add full export/import. Write automated RLS tests (anon, user A, user B, viewer). Keep Arabic RTL and existing features working. Update GAPS.md. Show me the test results.
```

**P1**
```
Implement Phase 1. Add brand profile editor (aliases, keywords, official domains/handles/phones, allowlist). Build Edge Functions: detect-domains (TypeScript permutations incl. homoglyphs, keyboard, TLD swaps, keyword combos; Cloudflare DoH in batches; cap 3000 per brand), detect-ct (crt.sh adapter with caching and a fallback interface), enrich (RDAP, hosting/ASN, HTTP title/status, brand-word check), score (Section 7, explainable signals, unit-tested), notify (Telegram + email). Schedule with pg_cron + pg_net. Add the Suspected tab per Section 8. Record every run in detector_runs. Write fixtures and tests. Update GAPS.md.
```

**P2**
```
Implement Phase 2. Build the capture worker (Playwright, desktop+mobile screenshots, rendered HTML, headers, TLS info) polling capture_jobs, with SSRF protections (block private/metadata IPs, non-http schemes, cap redirects/size/time). Store evidence immutable with SHA-256 and server time; optional Wayback and RFC 3161 timestamp. Add liveness/change monitoring for open cases, timeline, SLA follow-up timers, and the evidence pack (ZIP + PDF with hash manifest). Reword all "forensic/legal" claims per Section 11. Add tests including immutability and SSRF.
```

**P3–P6**
```
Implement Phase N from the blueprint only (replace N). Follow the Build and Accept lists exactly, write the tests first where listed, update GAPS.md, and stop for my review when done.
```

---

## 20. Open questions and verify-before-build list (honest gaps)

Resolve these before or during the phase noted; record answers in GAPS.md.
1. **Meta Ad Library API** coverage for commercial ads in UAE/KSA (D6) — unverified.
2. **crt.sh / CT source** reliability and rate limits for daily polling (D2) — unverified; choose a fallback.
3. **SERP provider**: ToS for social-site queries, Arabic result quality, price per 1,000 queries (D4).
4. **Telegram public preview** scraping permissions (D5).
5. **RFC 3161 TSA** choice and terms; Wayback Save Page Now limits (Section 11).
6. **WhatsApp Cloud API** template approval, verification, and per-conversation costs (Section 13).
7. **Platform report form URLs** change often — build the link health check and a monthly review task (Section 10).
8. **Legal review** of: evidence wording, public Verify page claims, data retention, PDPL obligations, takedown templates (UAE/KSA).
9. **Arabic transliteration** coverage for brand names — start manual via `aliases`, evaluate automation later.
10. **Pricing/positioning**: service vs software (decides P6 priority).
11. **Marketplace brand-registry programs** (Amazon, Noon, etc.) — eligibility and process per client.
12. Real-phone testing of Lens, TinEye, Ad Library links and RDAP/DoH CORS from the browser (P0 checklist).

---

## 21. Definition of done (platform level)

- A new lookalike domain for a test brand is detected, scored, and alerted without anyone opening the app.
- A customer report becomes a candidate within a minute and alerts the owner.
- A confirmed case has server-side evidence with hashes, a ready report text, the correct form link, an escalation ladder, and follow-up timers.
- Removal is detected automatically and the case closes with a recorded timeline.
- The client sees a dashboard and a monthly PDF; the public can verify official channels.
- Security tests pass, backups restore, and GAPS.md lists everything still partial or unverified.
