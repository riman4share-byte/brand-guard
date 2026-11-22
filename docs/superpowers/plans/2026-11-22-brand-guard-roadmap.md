# حارس العلامة (Brand Guard) Full Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all roadmap items from `README.md` (PWA/offline support, lookalike domain scanner, link liveness checker, overdue alerts via Notification/WhatsApp/Email, Owner/Staff roles, optional Supabase Cloud Sync, and public Customer Report Form) in a fast, zero-dependency static web application.

**Architecture:** A single-file Arabic RTL web application in `index.html` (and synced to `hares-alalama.html`), paired with `manifest.json`, `sw.js`, and `supabase-schema.sql`. Data persists locally in IndexedDB first and optionally syncs to Supabase via native `fetch` REST calls when configured.

**Tech Stack:** Vanilla HTML5, CSS3, ES2022 JavaScript, IndexedDB, Service Worker / Web App Manifest, Cloudflare DNS-over-HTTPS (`application/dns-json`), Supabase PostgREST API.

## Global Constraints

- Zero mandatory build tools, npm dependencies, or paid services.
- Must run cleanly on Windows 11 in any modern browser (both `file://` and `http://` / `https://`).
- Keep `index.html` and `hares-alalama.html` byte-identical.
- Never corrupt Arabic text (`U+FFFD` count must be 0) and validate inline JS syntax with `new Function(...)`.

---

### Task 1: Create PWA Manifest, Service Worker, and Supabase SQL Schema

**Files:**
- Create: `manifest.json`
- Create: `sw.js`
- Create: `supabase-schema.sql`

- [ ] **Step 1: Create `manifest.json`**
  Write the RTL Arabic Web App Manifest with embedded SVG shield icons and standalone display mode.

- [ ] **Step 2: Create `sw.js`**
  Write the offline-first Service Worker caching `./`, `./index.html`, `./hares-alalama.html`, and `./manifest.json`.

- [ ] **Step 3: Create `supabase-schema.sql`**
  Write the PostgreSQL table definitions (`hares_cases` and `hares_settings`) and Row Level Security policies for optional Supabase Cloud Sync and public customer reports.

---

### Task 2: Upgrade `index.html` & `hares-alalama.html` with All Roadmap Features

**Files:**
- Create: `index.html`
- Modify: `hares-alalama.html`

- [ ] **Step 1: Add PWA registration & Top Bar Role/Sync/Report Mode indicators**
  - Link `manifest.json` in `<head>`.
  - Add header action badges for active Role (`مالك` / `موظف`) and Cloud Sync button (`☁️ مزامنة`).
  - Detect `?report=1` (or `#report` / `state.customerMode`) on startup to render the isolated Public Customer Report view.

- [ ] **Step 2: Implement Lookalike Domain Scanner (Feature 3b)**
  - Add `domainVariants(domain)` generator producing TLD swaps (`.com`, `.net`, `.org`, `.shop`, `.store`, `.ae`, `.online`, `.co`), hyphenated prefixes/suffixes (`-shop`, `-store`, `-official`, `-ae`, `-uae`, `official-`), character drops, adjacent swaps, and homoglyphs.
  - Add `checkDomainDns(domain)` using `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A` with `Accept: application/dns-json`.
  - Render the scanner inside the «الفحص» tab with 1-click **«+ تسجيل كحالة»** (`addDomainCase`) for active domains.

- [ ] **Step 3: Implement Link Status / 404 Liveness Checker (Feature 4)**
  - Add `checkCaseLink(c)` that checks DNS existence via Cloudflare DoH and HTTP reachability via `fetch(url, { mode: 'no-cors', cache: 'no-store' })`.
  - Store `c.linkCheck = { at, state: 'live'|'down'|'unknown', detail }` and log results in `c.log`.
  - Add single-case check button in Case Detail sheet and batch **«فحص حالة الروابط»** button in Cases list tab, plus a 1-click button to mark `down` cases as `removed` (`أُزيل`).

- [ ] **Step 4: Implement Overdue Alerts via Browser Notification, WhatsApp & Email (Feature 3)**
  - Add `buildLateSummary()` generating a clean Arabic summary of all overdue cases (`isLate(c)`).
  - Add **«تنبيه واتساب»** and **«تنبيه بريد»** buttons to the overdue notice banner and Settings.
  - Add optional Browser Notification permission request and daily overdue notification trigger.

- [ ] **Step 5: Implement User Roles (`owner` vs `staff`) with PIN guard (Feature 6)**
  - Add role switcher (`toggleRole`) with optional PIN verification when switching from `staff` (`موظف`) to `owner` (`مالك`).
  - Restrict `deleteCase`, settings mutation, cloud credential viewing, and destructive imports when `state.role === 'staff'`.

- [ ] **Step 6: Implement Optional Supabase Cloud Sync (Feature 1)**
  - Add `Cloud` helper module using `fetch` against `${cloud.url}/rest/v1/hares_cases` and `hares_settings`.
  - Support bidirectional merge by `id` and `updatedAt` timestamp so neither device loses newer edits.
  - Trigger background push on case save / status update when configured, plus manual **«مزامنة الآن»** button.

- [ ] **Step 7: Implement Public Customer Report Form (Feature 2)**
  - Render dedicated customer submission UI when `?report=1` is present or previewed via **«معاينة نموذج العملاء»**.
  - Allow customers to paste a suspicious link/username/number, select platform, attach screenshots, and submit directly to Supabase (if configured in URL or local config) and IndexedDB with `source: 'customer'`.
  - Display a **`بلاغ عميل`** badge on customer-submitted cases in the main Cases list.
  - Provide a 1-click **«نسخ رابط نموذج العملاء»** button in Settings.

- [ ] **Step 8: Sync `index.html` and `hares-alalama.html` and update `README.md`**
  - Copy `index.html` to `hares-alalama.html` and verify byte equality.
  - Update `README.md` to document all new features and how to use them.

---

### Task 3: End-to-End Automated Verification

**Files:**
- Create (temporary): `verify-app.mjs`

- [ ] **Step 1: Verify JS syntax, UTF-8 integrity, and byte parity**
  - Parse inline `<script>` with `new Function()`, assert `0` `U+FFFD` replacement characters, and assert `index.html` === `hares-alalama.html`.

- [ ] **Step 2: Run headless browser verification (Playwright)**
  - Launch the app over a local HTTP server in headless Chromium.
  - Verify all tabs (`الحالات`, `الفحص`, `الإعدادات`), External link formats (Meta Ad Library, Google Lens, TinEye), Lookalike Domain generation & DNS check, Case creation + Link Status Check, Overdue WhatsApp/Email alert generation, Owner/Staff role switching & permission enforcement, and Public Customer Report Form (`?report=1`) submission.
