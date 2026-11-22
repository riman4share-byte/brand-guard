# حارس العلامة (Brand Guard) — Full Roadmap Design Spec

**Date:** 2026-11-22  
**Target Directory:** `E:\brand protection`  
**Architecture:** Local-first static PWA (`index.html`, `hares-alalama.html`, `manifest.json`, `sw.js`, `supabase-schema.sql`) with zero build steps and zero mandatory cloud costs.

---

## 1. Overview & Goals
Extend the existing single-file Arabic RTL web application (`hares-alalama.html`) to implement all roadmap items from `README.md` while keeping the app fast, 100% functional locally out of the box, and free of paid dependencies:
- **Item 0:** Verified external inspection URLs (Meta Ad Library, Google Lens, TinEye, Google site search).
- **Item 1:** Optional Supabase Cloud Sync (cases, settings, screenshots, and auth/anon REST sync).
- **Item 2:** Public Customer Report Form (`?report=1`) that lets customers submit impersonation reports (link + screenshot + notes) without seeing internal data.
- **Item 3:** Overdue Alerting via Web Notifications API + 1-click WhatsApp and Email summary dispatch.
- **Item 3b:** Browser-based Lookalike Domain Scanner (dnstwist-style permutations + Cloudflare DNS-over-HTTPS resolution).
- **Item 4:** Daily/On-demand Link & Domain liveness checker with status logging.
- **Item 5:** Offline-ready PWA (`manifest.json` + `sw.js` + `index.html`).
- **Item 6:** User Roles (`owner` / مالك vs `staff` / موظف) with PIN protection for Owner mode.

---

## 2. File Structure
- `index.html` — Primary application entrypoint (required by `README.md` and static hosts).
- `hares-alalama.html` — Identical copy of `index.html` so existing bookmarks or direct opens continue working identically.
- `manifest.json` — Web App Manifest (`lang: "ar"`, `dir: "rtl"`, standalone display, embedded SVG data-URI icons).
- `sw.js` — Service Worker with cache-first app shell and network-first fallback for external requests.
- `supabase-schema.sql` — Ready-to-run SQL script for Supabase (`cases`, `settings`, and public customer report insert policy).

---

## 3. Feature Specifications

### 3.1 PWA & Offline Support (Feature 5)
- Link `manifest.json` in `<head>` and register `sw.js` when running over `http:` or `https:` (gracefully no-op on `file://` so local double-click never throws errors).
- `sw.js` caches `./`, `./index.html`, `./hares-alalama.html`, and `./manifest.json`.

### 3.2 Lookalike Domain Scanner (Feature 3b)
- In Settings, add `s-domain` ("النطاق الرسمي للعلامة", e.g., `mybrand.com`).
- In the «الفحص» (`variants`) tab, add a panel **«فحص النطاقات المشابهة (DNS)»**:
  - Generates common lookalike domains from the official domain name:
    - TLD swaps (`.com`, `.net`, `.org`, `.shop`, `.store`, `.ae`, `.online`, `.co`)
    - Suffixes/prefixes (`-shop`, `-store`, `-official`, `-ae`, `-uae`, `official-`)
    - Character omissions, adjacent swaps, doubled letters, and homoglyphs (`o`→`0`, `l`→`1`, `i`→`l`).
  - Clicking **«فحص النطاقات الآن»** queries Cloudflare DNS-over-HTTPS (`https://cloudflare-dns.com/dns-query?name=<domain>&type=A` with `Accept: application/dns-json`).
  - Displays status badge for each domain:
    - **مسجّل / نشط (Active IP found)** — highlighted in red (`--bad`) with a 1-click **«+ تسجيل كحالة»** button that opens the Add Case form pre-filled with `type: 'domain'`, `platform: 'website'`, `url: 'https://' + domain`, `username: domain`.
    - **غير مسجّل (NXDOMAIN / No A record)** — muted green/grey.

### 3.3 Link & Domain Liveness Checker (Feature 4)
- Each case stores `linkCheck: { at: timestamp, state: 'live' | 'down' | 'unknown', detail: string }`.
- In Case Detail sheet and in the Cases list tab («فحص روابط الحالات» batch button):
  - For `domain` cases or URLs: checks DNS A/AAAA existence via Cloudflare DoH first (reliable, no CORS block). If DNS returns `Status === 3` (`NXDOMAIN`), marks link as **«النطاق متوقف / أُزيل (NXDOMAIN)»** (`down`).
  - If DNS resolves, attempts a `fetch(url, { mode: 'no-cors', cache: 'no-store' })` reachability probe to verify if the server responds or refuses connection.
  - Updates `c.linkCheck`, appends to case log, and if `down` while status is not `removed`, offers a 1-click **«تحديث الحالة إلى أُزيل»** button.

### 3.4 Overdue Alerts: Browser Notification + WhatsApp / Email (Feature 3)
- In Settings:
  - `s-phone`: WhatsApp number for receiving overdue summaries (e.g. `+971...`).
  - `s-notify`: Button to enable browser notifications (`Notification.requestPermission()`).
- When overdue cases exist (`isLate(c)`):
  - The overdue notice banner in «الحالات» includes quick action buttons: **«إرسال تنبيه واتساب»** (`https://wa.me/...`) and **«إرسال بريد»** (`mailto:...`) pre-filled with the list of overdue cases, platforms, and days elapsed.
  - If browser notifications are granted and not yet shown today (`localStorage.getItem('hares-notified-day')`), fires a desktop/mobile browser `Notification`.

### 3.5 User Roles: Owner vs. Staff (Feature 6)
- `state.role` defaults to `'owner'`.
- In Settings, Owner can set an optional **رمز المالك (Owner PIN)** (`s-pin`) and switch active view to **وضع الموظف (`staff`)** or **وضع المالك (`owner`)**.
- Header displays a role pill (`مالك` / `موظف`) that lets the user switch roles (prompting for PIN when switching from `staff` back to `owner`).
- When in `staff` mode:
  - Staff **can**: view cases, filter/search, add new cases, edit case notes/screenshots, change case status, copy report text, run domain/link checks.
  - Staff **cannot**: delete cases (`deleteCase` hidden/blocked), edit Brand/Cloud/Role Settings (inputs disabled/hidden in Settings), or overwrite data via JSON import.

### 3.6 Optional Supabase Cloud Sync (Feature 1)
- Stored in local config (`localStorage.getItem('hares-cloud')`):
  - `url`: Supabase Project URL (`https://<project>.supabase.co`)
  - `key`: Supabase Anon / Public Key
  - `workspace`: Shared workspace key/slug (default `'default'`) so teams can sync cases and settings.
- Uses lightweight native `fetch` against Supabase PostgREST (`/rest/v1/hares_cases` and `/rest/v1/hares_settings`):
  - **«مزامنة الآن» (Sync Now)** button in Settings & header indicator: pushes local cases/settings updated more recently and pulls remote cases/settings into IndexedDB.
  - Auto-syncs in the background when saving a case or changing status if Cloud Sync is configured.
  - Includes `supabase-schema.sql` with table definitions and RLS policies.

### 3.7 Public Customer Report Form (Feature 2)
- Triggered when URL contains `?report=1` (or `#report`), or via a preview button in Settings.
- Renders a dedicated customer-facing view (**«الإبلاغ عن حساب أو موقع منتحل»**):
  - Shows brand name (from query param `?brand=...`, cloud settings, or local settings).
  - Form fields: Suspicious Link / Username / Number, Case Type, Platform, Customer Notes, Optional Reporter Contact, and Screenshot Upload (compressed automatically).
  - Submits directly to Supabase (if cloud params are configured/passed) AND/OR local IndexedDB with `source: 'customer'`, `status: 'found'`, and log entry `'بلاغ وارد من عميل'`.
  - Shows a confirmation screen after submission without exposing any existing cases or internal tabs.
- In the main app's Cases list, customer-submitted cases display a distinct **`بلاغ عميل`** badge.
- In Settings, an **"إنشاء رابط نموذج العملاء"** button copies the shareable customer report URL (including brand name and optional Supabase parameters in the URL query/hash so customers on external devices submit straight into the owner's Supabase table).
