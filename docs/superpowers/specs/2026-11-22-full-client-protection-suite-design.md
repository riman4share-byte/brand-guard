# حارس العلامة (Brand Guard) — Full Client Protection Suite Spec

**Date:** 2026-11-22  
**Target Directory:** `E:\brand protection`  
**Files:** `index.html`, `hares-alalama.html`, `brand-guard-en.html`, `README.md`

---

## 1. Overview
Upgrade **حارس العلامة (Brand Guard)** with a complete, professional client brand-protection toolkit in both **Arabic (RTL)** and **English (LTR)** while keeping 100% browser-native, zero-server execution.

## 2. Feature Specifications

### 2.1 Direct Official Takedown Form Links + Reference Ticket ID (`refId`)
- Add direct URLs to each platform's Trademark Infringement (`tmForm`) and Impersonation (`impForm`) submission portals:
  - **Instagram**: Trademark (`https://help.instagram.com/contact/230197320740525`) & Impersonation (`https://help.instagram.com/contact/636276399721841`)
  - **Facebook**: Trademark (`https://www.facebook.com/help/contact/1057530520958514`) & Impersonation (`https://www.facebook.com/help/370054663132312`)
  - **TikTok**: Trademark/IP (`https://www.tiktok.com/legal/report/Trademark`) & Impersonation (`https://www.tiktok.com/legal/report/feedback`)
  - **X (Twitter)**: Trademark (`https://help.x.com/en/forms/ipi/trademark`) & Impersonation (`https://help.x.com/en/forms/authenticity/impersonation`)
  - **Snapchat**: Trademark (`https://support.snapchat.com/en-US/i-need-help?start=5746233202802688`) & Impersonation (`https://support.snapchat.com/en-US/a/report-impersonation`)
  - **YouTube**: Trademark (`https://www.youtube.com/copyright_complaint_form`) & Impersonation (`https://support.google.com/youtube/answer/2801947`)
  - **Telegram**: Abuse/DMCA (`mailto:abuse@telegram.org`, `https://telegram.org/faq#q-there-39s-illegal-content-on-telegram-how-do-i-take-it-down`)
  - **WhatsApp**: Grievance/Impersonation (`mailto:support@whatsapp.com`, `https://www.whatsapp.com/contact/`)
- Add `c.refId` (Platform Ticket / Reference Number) input in Case Detail sheet with a 1-click Save button (`saveRefId`), and display `refId` in the case card, printable dossier, and CSV export.

### 2.2 Automatic Forensic Evidence Watermarking (`stampShot`)
- In the Add/Edit Case form and Customer Report form, include a checkbox (`f-stamp` / `cf-stamp`, checked by default): **«ختم التاريخ والرابط على الصورة كدليل قانوني / Stamp Legal Evidence Footer»**.
- When `compress(file, meta)` runs with `meta.stamp === true`, draw a 44px dark navy forensic footer bar at the bottom of the canvas containing:
  `EVIDENCE • <ISO UTC Timestamp> • Target: <target> • Brand: <brand>`

### 2.3 Domain Whois / RDAP & Registrar Abuse Inspector (`checkDomainRdap`)
- For any `domain` case (or any case with a custom website URL), add a **«فحص Whois / RDAP»** button in Case Detail.
- Fetches `https://rdap.org/domain/${encodeURIComponent(domain)}`.
- Extracts:
  - `registrar`: Registrar organization name (`fn` from `entities` where `roles` includes `'registrar'`).
  - `abuseEmail`: Abuse email (`email` from nested `entities` where `roles` includes `'abuse'`).
  - `created`: Registration date from `events` (`eventAction === 'registration'`).
  - `nameservers`: List of `ldhName` from `nameservers`.
- Saves `c.rdap = { at, registrar, abuseEmail, created, nameservers }` on the case.
- Displays the Registrar, Creation Date, Nameservers, and Abuse Email in Case Detail, plus a 1-click **«إرسال بلاغ لمسجّل النطاق (Abuse Email)»** button that opens `mailto:${abuseEmail}` pre-filled with the formal Domain Takedown report.

### 2.4 UAE + KSA + Global Official Escalation Center
- Add an **«التصعيد للجهات الرسمية / Official Escalation Center»** panel inside Case Detail with grouped 1-click action links:
  - **الإمارات (UAE)**:
    - Dubai Police eCrime (`https://www.ecrime.ae`)
    - Dubai Economy / DED Consumer & IP Protection (`https://consumerrights.ae`)
    - TDRA (.ae Domain Dispute & Blocking) (`https://tdra.gov.ae`)
  - **السعودية (Saudi Arabia)**:
    - SAIP (الهيئة السعودية للملكية الفكرية) (`https://www.saip.gov.sa`)
    - CST (هيئة الاتصالات والفضاء والتقنية — ترشيح وحجب المواقع) (`https://www.cst.gov.sa`)
    - Ministry of Commerce (وزارة التجارة — بلاغ تجاري) (`https://mc.gov.sa`)
  - **عالمي (Global Anti-Phishing & Hosting)**:
    - Google Safe Browsing Report Phishing (`https://safebrowsing.google.com/safebrowsing/report_phish/`)
    - Cloudflare Abuse Report (`https://abuse.cloudflare.com`)
    - ICANN Registrar Compliance (`https://www.icann.org/compliance/complaint`)

### 2.5 1-Click "Customer Scam Alert" Story Card Generator (`generateAlertCard`)
- In Case Detail, add a **«⚠️ إنشاء بطاقة تحذير للعملاء (Story) / Generate Scam Alert Story Card»** button.
- Uses an HTML5 `<canvas width="1080" height="1920">` to render a high-contrast bilingual/localized social story graphic:
  - Top banner: Crimson warning badge (`⚠️ تحذير هام للعملاء / OFFICIAL SCAM ALERT`).
  - Brand Header: Brand name & protection notice.
  - Red Danger Box: Displays the fake account/website/number (`idLabel(c)` + `c.url` + Platform) with a tilted red stamp (`حساب منتحل / FAKE IMPERSONATOR`).
  - Green Verified Box: Lists the brand's official accounts/website from `state.settings.official` and `state.settings.domain` (`الحسابات الرسمية المعتمدة / VERIFIED OFFICIAL CHANNELS`).
  - Footer: Timestamp & warning not to share bank transfers or personal data with unauthorized accounts.
- Opens the generated PNG in the Lightbox with a **«تحميل الصورة / Download PNG»** button.

### 2.6 Client Demo Preset (`loadDemoPreset` / `clearAllData`)
- In Settings, add a **«عرض تجريبي للعملاء / Client Demo Preset»** panel with:
  - **«تحميل بيانات عرض تجريبية / Load Demo Client Data»**: Populates realistic brand settings and 4 sample cases across Instagram, Fake Website Domain, WhatsApp Scammer, and Paid Ad (including a customer report and an overdue case) so the user can demo the full system to any client in 1 click.
  - **«مسح جميع البيانات / Reset All Data»** (Owner only, with confirmation).
