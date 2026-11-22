# Full Client Protection Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Direct Official Takedown Form Links, Platform Ticket Reference IDs, Forensic Evidence Watermarking, Live Domain RDAP/Whois Abuse Inspector, UAE+KSA+Global Official Escalation Center, 1-Click Scam Alert Story Image Generator (1080×1920 Canvas), and 1-Click Client Demo Preset in both Arabic (RTL) and English (LTR).

**Architecture:** All features are built into the zero-dependency single-file app (`index.html`, synced to `hares-alalama.html` and `brand-guard-en.html`), using browser-native Canvas 2D for forensic watermarking and story card rendering, and public `https://rdap.org/domain/<domain>` for registrar/abuse contact lookup.

**Tech Stack:** Vanilla HTML5, CSS3, ES2022 JS, HTML5 Canvas 2D, Public RDAP JSON API, Cloudflare DoH API, IndexedDB.

## Global Constraints

- Zero mandatory paid APIs or external JS bundles.
- Full bilingual support (`ar` RTL and `en` LTR) for every label, button, report, and canvas graphic.
- Verify syntax (`new Function`), zero `U+FFFD`, and end-to-end headless Chromium execution before completion.

---

### Task 1: Implement Direct Platform Takedown Portals & Reference Ticket ID (`refId`)

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Enrich `PLATFORMS` with `tmForm` and `impForm` direct URLs**
- [ ] **Step 2: Add `refId` input and `saveRefId` action in Case Detail (`detailHtml`)**
- [ ] **Step 3: Include `refId` in Case List cards, Printable Dossier (`printCases`), and CSV Export (`exportCSV`)**

---

### Task 2: Implement Forensic Evidence Timestamp Watermarking

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add `f-stamp` and `cf-stamp` checkboxes (checked by default) to case and customer forms**
- [ ] **Step 2: Update `compress(file, meta)` to draw a dark forensic metadata bar (`EVIDENCE LOG • UTC Timestamp • Target • Brand`) at the bottom of uploaded screenshots when enabled**

---

### Task 3: Implement Live Domain Whois / RDAP & Registrar Abuse Inspector

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Write `fetchDomainRdap(domain)` querying `https://rdap.org/domain/${encodeURIComponent(domain)}` and parsing vCard entities for Registrar Name, Abuse Email, Registration Date, and Nameservers**
- [ ] **Step 2: Add RDAP inspection panel in Case Detail for domain/website cases with 1-click `checkCaseRdap` and `emailRegistrarAbuse` (`mailto:` pre-filled with English trademark/phishing takedown request)**

---

### Task 4: Implement UAE + KSA + Global Official Escalation Center

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add `ESCALATION_LINKS` constant covering UAE (`ecrime.ae`, `consumerrights.ae`, `tdra.gov.ae`), KSA (`saip.gov.sa`, `cst.gov.sa`, `mc.gov.sa`), and Global (`Google Safe Browsing`, `Cloudflare Abuse`, `ICANN Compliance`)**
- [ ] **Step 2: Render the Escalation Center panel inside Case Detail with 1-click links and a button to generate the printable PDF Dossier for that specific case**

---

### Task 5: Implement 1-Click "Customer Scam Alert" Story Card Generator (1080×1920 Canvas)

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Write `buildScamAlertCard(c)` creating a 1080×1920 Canvas with warning header, red FAKE impersonator box, tilted warning stamp, green OFFICIAL verified channels box, and safety notice**
- [ ] **Step 2: Add `generateAlertCard` action in Case Detail that opens the generated PNG in `#lightbox` with a 1-click Download PNG button (`downloadLightImg`)**

---

### Task 6: Implement Client Demo Preset & Reset in Settings + Sync & Verify

**Files:**
- Modify: `index.html`
- Modify: `hares-alalama.html`
- Modify: `brand-guard-en.html`
- Modify: `README.md`

- [ ] **Step 1: Add `loadDemoPreset` and `resetAllData` actions in Settings**
- [ ] **Step 2: Sync `hares-alalama.html` and `brand-guard-en.html` from `index.html`**
- [ ] **Step 3: Run headless Chromium verification across all new features**
