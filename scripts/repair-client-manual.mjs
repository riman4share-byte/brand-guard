import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const manualPath = path.join(root, 'client-manual.html');
const originalHtml = fs.readFileSync(manualPath, 'utf8');
const originalEol = originalHtml.includes('\r\n') ? '\r\n' : '\n';
let html = originalHtml.replace(/\r\n/g, '\n');

const count = (needle) => html.split(needle).length - 1;

function assertOnce(anchor, label = anchor) {
  assert.equal(count(anchor), 1, `Expected exactly one anchor: ${label}`);
}

function replaceOnce(oldText, newText, label = oldText) {
  assertOnce(oldText, label);
  html = html.replace(oldText, newText);
}

function insertBeforeOnce(anchor, insertion, label = anchor) {
  assertOnce(anchor, label);
  html = html.replace(anchor, insertion + anchor);
}

for (const lang of ['ar', 'en']) {
  for (let number = 1; number <= 11; number += 1) {
    if (lang === 'en' && number === 10) continue;
    assertOnce(`id="${lang}-${number}"`, `${lang}-${number}`);
  }
}
for (const id of ['ar-12', 'ar-13', 'ar-14', 'ar-15', 'en-10', 'en-12', 'en-13', 'en-14', 'en-15']) {
  assert.equal(count(`id="${id}"`), 0, `Section already exists: ${id}`);
}

const arTocAnchor = '        <a href="#ar-11"><b>١١</b> نموذج استقبال بلاغات العملاء العام</a>';
const enTocAnchor = '        <a href="#en-11"><b>11</b> Public Customer Report Form (?report=1)</a>';
assertOnce(arTocAnchor, 'Arabic TOC section 11');
assertOnce(enTocAnchor, 'English TOC section 11');

replaceOnce(
  arTocAnchor,
  `${arTocAnchor}
        <a href="#ar-12"><b>١٢</b> تبويب «الرصد» (Suspected Inbox)</a>
        <a href="#ar-13"><b>١٣</b> تبويب «المسح» (Sweep) وصفحة التحقق العامة</a>
        <a href="#ar-14"><b>١٤</b> تبويب «التحليلات» (Analytics)</a>
        <a href="#ar-15"><b>١٥</b> الإعدادات المتقدمة: Onboarding، White-Label، المصادقة، الصحة، الأدلة وSLA</a>`,
  'Arabic TOC insertion'
);

replaceOnce(
  enTocAnchor,
  `${enTocAnchor}
        <a href="#en-12"><b>12</b> "Suspected" Tab (Inbox)</a>
        <a href="#en-13"><b>13</b> "Sweep" Tab & Public Verify Page</a>
        <a href="#en-14"><b>14</b> "Analytics" Tab</a>
        <a href="#en-15"><b>15</b> Advanced Settings: White-Label, Onboarding, Auth, Health, Evidence & SLA</a>`,
  'English TOC insertion'
);

const arSections = `
    <!-- Section 12 AR -->
    <section class="sec" id="ar-12">
      <div class="sec-head">
        <span class="sec-num">القسم ١٢</span>
        <h2>تبويب «الرصد» (Suspected Inbox) — مراجعة المرشحين قبل تأكيد الحالة</h2>
      </div>
      <div class="split">
        <div>
          <p>تبويب <b>«الرصد»</b> مخصص لمراجعة الحسابات والنطاقات المشبوهة قبل اعتبارها حالات مؤكدة. في النسخة المحلية الحالية، تُعرض هنا السجلات المحلية التي تحمل مصدر <code>customer</code> أو <code>detect-domains</code> أو <code>detect-ct</code>، وليس جدول <code>candidates</code> السحابي بعد.</p>
          <ul class="opt-list">
            <li class="opt">
              <h4>البحث والتصفية</h4>
              <p>ابحث بالرابط أو الاسم أو المنصة، وصفّ حسب: الكل، جديد، مؤكد، مرفوض، مسموح.</p>
            </li>
            <li class="opt">
              <h4>بطاقة المرشح والنتيجة</h4>
              <p>تعرض المنصة والنوع والنتيجة اللونية: أحمر للنتيجة 70 فأكثر، برتقالي من 40 إلى 69، وأخضر لأقل من 40. النتيجة الحالية تقديرية وليست حكماً نهائياً.</p>
            </li>
            <li class="opt ok">
              <h4>تأكيد / رفض / مسموح</h4>
              <p>• <b>تأكيد:</b> يحدّث السجل المحلي إلى حالة مرصودة ويعلّم المرشح كمؤكد؛ لا ينشئ سجلاً سحابياً منفصلاً بعد.
              <br>• <b>رفض:</b> يطلب سبب الرفض ويحفظه محلياً.
              <br>• <b>مسموح:</b> يعلّم المرشح كمسموح في قائمة المراجعة المحلية. قائمة السماح الدائمة للعلامة تُدار من الإعدادات.</p>
            </li>
            <li class="opt warn">
              <h4>تشغيل كاشف النطاقات (Domain Detector)</h4>
              <p>هذا الزر يستدعي Edge Function باسم <code>detect-domains</code> على Supabase. يتطلب اتصال Supabase ومصادقة ومساحة عمل/علامة نشطة ونشر الدالة. لم يتم التحقق الحي من هذا المسار بعد، وسجل عمليات الكاشف يظهر فقط عند الاتصال والمصادقة.</p>
            </li>
          </ul>
        </div>
        <div class="shot-box">
          <img src="manual-screenshots/12-suspected-inbox-ar.png" alt="تبويب الرصد بالعربية">
          <div class="cap">تبويب الرصد — مراجعة المرشحين المحليين وأزرار التأكيد والرفض والسماح</div>
        </div>
      </div>
    </section>

    <!-- Section 13 AR -->
    <section class="sec" id="ar-13">
      <div class="sec-head">
        <span class="sec-num">القسم ١٣</span>
        <h2>تبويب «المسح» (Sweep) وصفحة التحقق العامة (Verify)</h2>
      </div>
      <div class="split">
        <div>
          <p>تبويب <b>«المسح»</b> يساعدك على تغطية المنصات يدوياً بانتظام، لأن الكشف الآلي الكامل للحسابات والإعلانات غير مضمون.</p>
          <ul class="opt-list">
            <li class="opt">
              <h4>تغطية المنصات وتحذير التقادم</h4>
              <p>يسجّل آخر مسح لكل منصة، ويظهر تحذير إذا مرّت 7 أيام أو أكثر بدون مسح. اضغط <b>«تم المسح اليوم»</b> بعد فحص المنصة، أو <b>«فتح المنصة»</b> للانتقال إليها.</p>
            </li>
            <li class="opt">
              <h4>ميزانية مزود البحث وفحص الأرقام</h4>
              <p>• عرض ميزانية SERP الحالي توضيحي/ثابت وليس تكاملاً حياً مع مزود بحث.
              <br>• فاحص تطابق الأرقام يقارن الرقم المدخل برقم الهاتف/واتساب المحدد في الإعدادات؛ التطبيع الكامل بصيغة E.164 ما زال جزئياً.</p>
            </li>
            <li class="opt ok">
              <h4>صفحة التحقق العامة (<code>?verify=1</code>)</h4>
              <p>تعرض الموقع الرسمي والحسابات والأرقام المعتمدة من الإعدادات مع تحذير للعملاء. استخدم <b>«نسخ رابط التحقق»</b> أو <b>«معاينة»</b> لمشاركتها في البايو أو الفواتير.</p>
            </li>
          </ul>
        </div>
        <div class="shot-box">
          <img src="manual-screenshots/13-sweep-verify-ar.png" alt="تبويب المسح بالعربية">
          <div class="cap">تبويب المسح — تغطية المنصات وتحذيرات التقادم</div>
        </div>
      </div>
      <div class="shot-box" style="margin-top:18px">
        <img src="manual-screenshots/13b-verify-page-ar.png" alt="صفحة التحقق العامة">
        <div class="cap">صفحة التحقق العامة التي يراها العملاء للتأكد من القنوات الرسمية</div>
      </div>
    </section>

    <!-- Section 14 AR -->
    <section class="sec" id="ar-14">
      <div class="sec-head">
        <span class="sec-num">القسم ١٤</span>
        <h2>تبويب «التحليلات» (Analytics) — مؤشرات الأداء وتقارير العميل</h2>
      </div>
      <div class="split">
        <div>
          <p>يعرض تبويب <b>«التحليلات»</b> ملخصاً محلياً لحالاتك المسجلة، دون الحاجة إلى خادم.</p>
          <ul class="opt-list">
            <li class="opt">
              <h4>المؤشرات الرئيسية</h4>
              <p>إجمالي الحالات، تمت الإزالة، قيد المتابعة، المتأخرة، بلاغات العملاء، متوسط أيام الإزالة، ومعدل الإزالة.</p>
            </li>
            <li class="opt">
              <h4>التوزيعات</h4>
              <p>الحالات حسب الحالة، النوع، والمنصة لمساعدتك على معرفة أين يتركز الانتحال.</p>
            </li>
            <li class="opt ok">
              <h4>تقرير العميل والحدود</h4>
              <p>يمكن طباعة تقرير PDF أو تصدير CSV من هذه الشاشة. كما تعرض حدود الخطة الحالية بشكل توضيحي؛ الفوترة والإنفاذ الكامل للحدود ليسا مسار إنتاج مؤكد بعد.</p>
            </li>
          </ul>
        </div>
        <div class="shot-box">
          <img src="manual-screenshots/14-analytics-ar.png" alt="لوحة التحليلات بالعربية">
          <div class="cap">لوحة التحليلات — المؤشرات الرئيسية وتوزيع الحالات</div>
        </div>
      </div>
    </section>

    <!-- Section 15 AR -->
    <section class="sec" id="ar-15">
      <div class="sec-head">
        <span class="sec-num">القسم ١٥</span>
        <h2>الإعدادات المتقدمة: Onboarding، White-Label، المصادقة، الصحة، الأدلة وSLA</h2>
      </div>
      <div class="split">
        <div>
          <p>تجمع هذه الأقسام ميزات Phase 0–6. بعضها واجهة محلية جاهزة، وبعضها مسار سحابي/عامل خارجي يحتاج نشر Supabase أو worker والتحقق الحي قبل اعتباره إنتاجياً.</p>
          <ul class="opt-list">
            <li class="opt">
              <h4>معالج الإعداد (Onboarding Checklist)</h4>
              <p>خمس خطوات: بيانات العلامة، القنوات الرسمية، صور المنتجات، ربط Supabase الاختياري، ورقم تسجيل العلامة. تظهر علامة ✅ عند اكتمال البيانات المقابلة.</p>
            </li>
            <li class="opt">
              <h4>White-Label</h4>
              <p>تخصيص الشعار واللون الأساسي ولون التمييز والدومين المخصص محلياً. الدومين المخصص لا يُجهّز تلقائياً؛ يحتاج إعداد استضافة/DNS منفصل.</p>
            </li>
            <li class="opt">
              <h4>المصادقة ومساحات العمل (Supabase Auth)</h4>
              <p>عند إعداد Supabase، تظهر شاشة تسجيل الدخول/إنشاء الحساب واختيار مساحة العمل والعلامة. الأدوار محمية بسياسات RLS في migrations، لكن النشر والاختبار الحي لم يكتملا بعد. رمز PIN المحلي وسيلة راحة داخل الجهاز وليس حد أمان سحابي.</p>
            </li>
            <li class="opt">
              <h4>حالة النظام (<code>?health=1</code>)</h4>
              <p>تعرض حالة التطبيق وIndexedDB واتصال Supabase واللغة والإصدار. هذه صفحة حالة واجهة، وليست مراقبة إنتاجية عميقة.</p>
            </li>
            <li class="opt">
              <h4>الجدول الزمني وطلب التقاط الأدلة</h4>
              <p>يسجّل الجدول الزمني أحداث الحالة محلياً. زر <b>«طلب التقاط أدلة»</b> يرسل طلباً إلى <code>capture_jobs</code> فقط عند وجود Supabase ومصادقة ومساحة عمل؛ في الوضع المحلي يكتفي بتجهيز الطلب دون التقاط فعلي. عامل Playwright موجود في المستودع لكنه غير منشأ/مُتحقق إنتاجياً.</p>
            </li>
            <li class="opt warn">
              <h4>حزمة الأدلة وSLA — توضيح مهم</h4>
              <p>• الزر الحالي موسوم <b>Evidence Pack (ZIP)</b>، لكن التنفيذ الحالي بدون مكتبات ينزّل <b>JSON manifest</b> وليس ZIP فعلياً، وقيم SHA-256 فيه عناصر نائبة/مقتطعة وليست hashes محسوبة للأدلة.
              <br>• مؤقتات SLA تُنشأ عند «تم الإبلاغ» فقط في المسار السحابي المصادق؛ لا يوجد إعادة فتح تلقائي مؤكد في الواجهة الحالية.
              <br>• ختم الصور الحالي يستخدم وقت الجهاز بصيغة UTC، وليس ختم خادم قانوني مستقل.</p>
            </li>
            <li class="opt warn">
              <h4>حدود المزامنة والتنبيهات الحالية</h4>
              <p>المزامنة السحابية الحالية ما زالت تستخدم جداول <code>hares_cases</code> و<code>hares_settings</code> القديمة. مسار الجداول متعدد المستأجرين الجديد يحتاج نشر migrations والتحقق. رموز Telegram/البريد في الإعدادات تُحفظ في المتصفح؛ لا تعاملها كإعداد إنتاجي آمن قبل نقل الأسرار إلى خادم/Edge Function.</p>
            </li>
          </ul>
        </div>
        <div class="shot-box">
          <img src="manual-screenshots/15-advanced-settings-ar.png" alt="الإعدادات المتقدمة بالعربية">
          <div class="cap">إعدادات White-Label والمزامنة الاختيارية</div>
        </div>
      </div>
      <div class="shot-box" style="margin-top:18px">
        <img src="manual-screenshots/15b-case-evidence-timeline-ar.png" alt="الجدول الزمني وحزمة الأدلة">
        <div class="cap">الجدول الزمني وحزمة الأدلة — راجع التوضيح أعلاه حول JSON manifest وحدود الختم الحالي</div>
      </div>
    </section>
`;

const enSections = `
    <!-- Section 12 EN -->
    <section class="sec" id="en-12">
      <div class="sec-head">
        <span class="sec-num">Section 12</span>
        <h2>"Suspected" Tab (Inbox) — Review Candidates Before Confirming a Case</h2>
      </div>
      <div class="split">
        <div>
          <p>The <b>Suspected</b> tab is for reviewing suspicious accounts and domains before treating them as confirmed cases. In the current local build, it shows local records whose source is <code>customer</code>, <code>detect-domains</code>, or <code>detect-ct</code>; it does not yet read the cloud <code>candidates</code> table.</p>
          <ul class="opt-list">
            <li class="opt">
              <h4>Search & Filter</h4>
              <p>Search by URL, handle, or platform, and filter by All, New, Confirmed, Dismissed, or Allowlisted.</p>
            </li>
            <li class="opt">
              <h4>Candidate Card & Score</h4>
              <p>Shows platform, type, and a color-coded score: red for 70+, amber for 40–69, green below 40. The score is an estimate, not a final judgment.</p>
            </li>
            <li class="opt ok">
              <h4>Confirm / Dismiss / Allowlist</h4>
              <p>• <b>Confirm:</b> updates the local record to a detected case and marks the candidate confirmed; it does not yet create a separate cloud case.
              <br>• <b>Dismiss:</b> asks for a reason and stores it locally.
              <br>• <b>Allowlist:</b> marks the candidate allowlisted in the local review list. The permanent brand allowlist is managed in Settings.</p>
            </li>
            <li class="opt warn">
              <h4>Run Domain Detector</h4>
              <p>This button calls the <code>detect-domains</code> Edge Function on Supabase. It requires a Supabase connection, authentication, an active workspace/brand, and a deployed function. This path has not been live-verified yet, and detector-run logs appear only when connected and authenticated.</p>
            </li>
          </ul>
        </div>
        <div class="shot-box">
          <img src="manual-screenshots/12-suspected-inbox-en.png" alt="Suspected inbox in English">
          <div class="cap">Suspected inbox — local candidate review with Confirm, Dismiss, and Allowlist actions</div>
        </div>
      </div>
    </section>

    <!-- Section 13 EN -->
    <section class="sec" id="en-13">
      <div class="sec-head">
        <span class="sec-num">Section 13</span>
        <h2>"Sweep" Tab & Public Verify Page</h2>
      </div>
      <div class="split">
        <div>
          <p>The <b>Sweep</b> tab helps you cover platforms manually on a regular schedule, because fully automated detection of accounts and ads is not guaranteed.</p>
          <ul class="opt-list">
            <li class="opt">
              <h4>Platform Coverage & Stale Warnings</h4>
              <p>Records the last sweep date per platform and warns when 7+ days have passed. Click <b>Mark Swept Today</b> after checking a platform, or <b>Open Platform</b> to visit it.</p>
            </li>
            <li class="opt">
              <h4>Provider Budget & Phone Mismatch Checker</h4>
              <p>• The current SERP budget display is illustrative/static, not a live search-provider integration.
              <br>• The phone checker compares the entered number with the phone/WhatsApp number configured in Settings; full E.164 normalization is still partial.</p>
            </li>
            <li class="opt ok">
              <h4>Public Verify Page (<code>?verify=1</code>)</h4>
              <p>Shows the official website, accounts, and phone numbers from Settings with a customer warning. Use <b>Copy Verify Link</b> or <b>Preview</b> to share it in bios or invoices.</p>
            </li>
          </ul>
        </div>
        <div class="shot-box">
          <img src="manual-screenshots/13-sweep-verify-en.png" alt="Sweep tab in English">
          <div class="cap">Sweep tab — platform coverage and stale warnings</div>
        </div>
      </div>
    </section>

    <!-- Section 14 EN -->
    <section class="sec" id="en-14">
      <div class="sec-head">
        <span class="sec-num">Section 14</span>
        <h2>"Analytics" Tab — Performance Metrics & Client Reports</h2>
      </div>
      <div class="split">
        <div>
          <p>The <b>Analytics</b> tab summarizes your locally recorded cases without requiring a server.</p>
          <ul class="opt-list">
            <li class="opt">
              <h4>Key Metrics</h4>
              <p>Total cases, removed, pending, overdue, customer reports, average days to removal, and removal rate.</p>
            </li>
            <li class="opt">
              <h4>Breakdowns</h4>
              <p>Cases by status, type, and platform help you see where impersonation is concentrated.</p>
            </li>
            <li class="opt ok">
              <h4>Client Report & Plan Limits</h4>
              <p>You can print a PDF report or export CSV from this screen. Current plan limits are displayed illustratively; billing and full limit enforcement are not yet a verified production path.</p>
            </li>
          </ul>
        </div>
        <div class="shot-box">
          <img src="manual-screenshots/14-analytics-en.png" alt="Analytics dashboard in English">
          <div class="cap">Analytics dashboard — key metrics and case breakdowns</div>
        </div>
      </div>
    </section>

    <!-- Section 15 EN -->
    <section class="sec" id="en-15">
      <div class="sec-head">
        <span class="sec-num">Section 15</span>
        <h2>Advanced Settings: White-Label, Onboarding, Auth, Health, Evidence & SLA</h2>
      </div>
      <div class="split">
        <div>
          <p>These areas cover Phase 0–6 features. Some are ready local UI; others are cloud/worker paths that require Supabase deployment or a capture worker and live verification before being treated as production-ready.</p>
          <ul class="opt-list">
            <li class="opt">
              <h4>Onboarding Checklist</h4>
              <p>Five steps: brand profile, official channels, product images, optional Supabase connection, and trademark registration number. A ✅ appears when the matching data is present.</p>
            </li>
            <li class="opt">
              <h4>White-Label</h4>
              <p>Customize logo, primary color, accent color, and custom domain locally. The custom domain is not provisioned automatically; it needs separate hosting/DNS setup.</p>
            </li>
            <li class="opt">
              <h4>Auth & Workspaces (Supabase Auth)</h4>
              <p>When Supabase is configured, sign-in/sign-up and workspace/brand selection appear. Roles are protected by RLS policies in the migrations, but deployment and live testing are not complete yet. The local PIN is a device convenience, not a cloud security boundary.</p>
            </li>
            <li class="opt">
              <h4>Health Status (<code>?health=1</code>)</h4>
              <p>Shows app, IndexedDB, Supabase connection, language, and version status. This is a UI status page, not deep production monitoring.</p>
            </li>
            <li class="opt">
              <h4>Case Timeline & Evidence Capture Request</h4>
              <p>The timeline logs case events locally. <b>Request Evidence Capture</b> posts to <code>capture_jobs</code> only with Supabase, authentication, and a workspace; in local mode it only prepares a request without actual capture. The Playwright worker exists in the repository but is not deployed/live-verified.</p>
            </li>
            <li class="opt warn">
              <h4>Evidence Pack & SLA — Important Clarification</h4>
              <p>• The current button is labeled <b>Evidence Pack (ZIP)</b>, but the zero-dependency implementation downloads a <b>JSON manifest</b>, not a real ZIP, and its SHA-256 values are placeholder/truncated entries rather than computed evidence hashes.
              <br>• SLA timers are created on “Reported” only in the authenticated cloud path; no verified automatic reopen exists in the current UI.
              <br>• The current image stamp uses device time formatted as UTC, not an independent legal server timestamp.</p>
            </li>
            <li class="opt warn">
              <h4>Current Sync & Alert Limits</h4>
              <p>Current cloud sync still targets the legacy <code>hares_cases</code> and <code>hares_settings</code> tables. The new multi-tenant table path needs migration deployment and verification. Telegram/email alert credentials in Settings are browser-stored; do not treat them as production-secure until secrets move to a server/Edge Function.</p>
            </li>
          </ul>
        </div>
        <div class="shot-box">
          <img src="manual-screenshots/15-advanced-settings-en.png" alt="Advanced settings in English">
          <div class="cap">White-Label settings and optional cloud sync</div>
        </div>
      </div>
      <div class="shot-box" style="margin-top:18px">
        <img src="manual-screenshots/15b-case-evidence-timeline-en.png" alt="Case timeline and evidence pack">
        <div class="cap">Case timeline and evidence pack — see the clarification above about the JSON manifest and current stamping limits</div>
      </div>
    </section>
`;

const arInsertAnchor = '    </section>\n  </div>\n\n  <!-- ==================== DIVIDER ==================== -->';
const enInsertAnchor = '    </section>\n  </div>\n\n  <div style="text-align:center;margin-top:40px';
assertOnce(arInsertAnchor, 'Arabic block closing anchor');
assertOnce(enInsertAnchor, 'English block closing anchor');

html = html.replace(arInsertAnchor, `    </section>\n${arSections}  </div>\n\n  <!-- ==================== DIVIDER ==================== -->`);
html = html.replace(enInsertAnchor, `    </section>\n${enSections}  </div>\n\n  <div style="text-align:center;margin-top:40px`);

const enCombinedStart = '    <!-- Section 9 & 10 EN -->';
const enSection11Start = '    <!-- Section 11 EN -->';
assertOnce(enCombinedStart, 'Combined English section 9/10 start');
assertOnce(enSection11Start, 'English section 11 start');
const startIndex = html.indexOf(enCombinedStart);
const endIndex = html.indexOf(enSection11Start);
assert.ok(startIndex >= 0 && endIndex > startIndex, 'English section 9/10 range is invalid');

const enSettingsSections = `    <!-- Section 9 EN -->
    <section class="sec" id="en-9">
      <div class="sec-head">
        <span class="sec-num">Section 9</span>
        <h2>Settings (Part 1): Brand Profile, Demo Preset & Customer Report Link</h2>
      </div>
      <div class="split">
        <div>
          <p>In the <b>Settings</b> tab, configure the app once:</p>
          <ul class="opt-list">
            <li class="opt">
              <h4>1. Brand Profile</h4>
              <p>Enter brand name, official handles, official website domain, official account URLs, product image URLs, trademark registration number, trade license number, reporter name, contact email, WhatsApp alert number, and follow-up reminder days. These values feed reports, scans, and customer warning cards.</p>
            </li>
            <li class="opt ok">
              <h4>2. Client Demo Preset</h4>
              <p><b>Load Demo Client Data</b> fills neutral sample brand settings and four sample cases for presentations or training. <b>Reset All Data</b> clears local demo data before real client use.</p>
            </li>
            <li class="opt">
              <h4>3. Public Customer Report Link</h4>
              <p><b>Copy Customer Form Link</b> creates a shareable <code>?report=1</code> link for your bio or website. <b>Preview Form</b> shows the customer-facing form without exposing internal cases.</p>
            </li>
          </ul>
        </div>
        <div class="shot-box">
          <img src="manual-screenshots/09-settings-top-ar.png" alt="Settings brand profile">
          <div class="cap">Settings — onboarding checklist and brand profile</div>
        </div>
      </div>
    </section>

    <!-- Section 10 EN -->
    <section class="sec" id="en-10">
      <div class="sec-head">
        <span class="sec-num">Section 10</span>
        <h2>Settings (Part 2): Alerts, Roles & PIN, Cloud Sync, Dossier & Backup</h2>
      </div>
      <div class="split">
        <div>
          <p>The remaining settings sections cover administration, exports, and optional cloud sync:</p>
          <ul class="opt-list">
            <li class="opt">
              <h4>1. Overdue Alerts</h4>
              <p>Send a summary of overdue reports via WhatsApp or email, or enable browser notifications. These are manual/device-assisted alerts, not a verified server notification service.</p>
            </li>
            <li class="opt">
              <h4>2. Owner / Staff Mode & PIN</h4>
              <p>Set an optional local Owner PIN and switch to Staff Mode. Staff can add cases, update statuses, and run checks, but cannot delete cases or edit settings without returning to Owner mode. The PIN is a local convenience lock, not a cloud security boundary.</p>
            </li>
            <li class="opt">
              <h4>3. Optional Supabase Cloud Sync</h4>
              <p>The app works locally without a server. You can paste a Supabase Project URL and Anon Key to sync, but the current sync path still uses legacy <code>hares_cases</code>/<code>hares_settings</code> tables. The new multi-tenant migrations require deployment and live verification.</p>
            </li>
            <li class="opt ok">
              <h4>4. PDF Dossier, CSV & JSON Backup</h4>
              <p>Generate a printable complaint dossier (save as PDF from the print dialog), export a CSV spreadsheet, or save/restore a full JSON backup including photos.</p>
            </li>
          </ul>
        </div>
        <div class="shot-box">
          <img src="manual-screenshots/10b-settings-cloud-dossier-ar.png" alt="Settings cloud and dossier">
          <div class="cap">Settings — optional cloud sync and dossier/export controls</div>
        </div>
      </div>
    </section>

`;

html = html.slice(0, startIndex) + enSettingsSections + html.slice(endIndex);

replaceOnce(
  'كيف ترسل بلاغاً قانونياً رسمياً تقبله المنصات، وكيف تصعّد للشرطة والجهات الرسمية بملف PDF موثّق.',
  'كيف تجهّز نص بلاغ رسمي ونموذج المنصة المباشر للإرسال اليدوي، وكيف تصعّد للجهات الرسمية بملف PDF منظم.',
  'Arabic hero overclaim'
);
replaceOnce(
  '<div class="hero-stat"><b>٣. إغلاق قانوني سريع</b><span>كتابة نص البلاغ القانوني مع ختم الصور بالتاريخ وفتح نموذج المنصة المباشر.</span></div>',
  '<div class="hero-stat"><b>٣. تجهيز بلاغ سريع</b><span>كتابة نص البلاغ مع ختم توثيق للصور وفتح نموذج المنصة المباشر؛ الإرسال يتم يدوياً.</span></div>',
  'Arabic hero stat 3'
);
replaceOnce(
  '<a href="#ar-3"><b>٣</b> إضافة حالة انتحال وختم الأدلة القانوني</a>',
  '<a href="#ar-3"><b>٣</b> إضافة حالة انتحال وختم توثيق الأدلة</a>',
  'Arabic TOC section 3 wording'
);
replaceOnce(
  '<h2>إضافة حالة انتحال جديدة + ختم الأدلة القانوني (Add Case & Forensic Stamp)</h2>',
  '<h2>إضافة حالة انتحال جديدة + ختم توثيق الأدلة (Add Case & Documented Evidence Stamp)</h2>',
  'Arabic section 3 heading'
);
replaceOnce(
  '<h4>٤. ختم التاريخ والرابط على الصور كدليل قانوني (Forensic Evidence Stamp)</h4>',
  '<h4>٤. ختم التاريخ والرابط على الصور كشريط توثيق مساعد (Documented Evidence Stamp)</h4>',
  'Arabic section 3 stamp heading'
);
replaceOnce(
  'خيار مفعّل تلقائياً: عند رفع أي لقطة شاشة (Screenshot)، يقوم التطبيق بضغط الصورة لتوفير المساحة ويطبع أسفلها شريط توثيق قانوني يحتوي على:',
  'خيار مفعّل تلقائياً: عند رفع أي لقطة شاشة (Screenshot)، يقوم التطبيق بضغط الصورة لتوفير المساحة ويطبع أسفلها شريط توثيق مساعد يحتوي على وقت الجهاز بصيغة UTC. هذا الشريط يساعد على التنظيم، لكنه ليس إثباتاً قانونياً مستقلاً أو ختم خادم:',
  'Arabic section 3 stamp wording'
);
replaceOnce(
  'وهذا يجعل الصورة دليلاً قوياً عند تقديمها للشرطة أو مسجّل النطاق.',
  'وهذا يساعد على ترتيب الصورة ضمن ملف الشكوى، مع بقاء التحقق القانوني النهائي للجهة المختصة.',
  'Arabic section 3 stamp overclaim'
);
replaceOnce(
  '<a href="#en-3"><b>3</b> Adding a Case & Forensic Evidence Stamp</a>',
  '<a href="#en-3"><b>3</b> Adding a Case & Documented Evidence Stamp</a>',
  'English TOC section 3 wording'
);
replaceOnce(
  '<h2>Adding a Case & Automatic Forensic Evidence Watermarking</h2>',
  '<h2>Adding a Case & Documented Evidence Stamp</h2>',
  'English section 3 heading'
);
replaceOnce(
  '<h4>4. Forensic Evidence Timestamp Bar (Checked by Default)</h4>',
  '<h4>4. Documented Evidence Timestamp Bar (Checked by Default)</h4>',
  'English section 3 stamp heading'
);
replaceOnce(
  'When you attach screenshots, the app compresses them for fast storage and automatically stamps a dark forensic bar at the bottom of the image:',
  'When you attach screenshots, the app compresses them for fast storage and stamps a dark documentation bar at the bottom of the image using device time formatted as UTC:',
  'English section 3 stamp wording'
);
replaceOnce(
  'This ensures every screenshot in your legal PDF dossier carries verifiable timestamp and target metadata.',
  'This helps organize screenshots in your PDF dossier with timestamp and target metadata, but it is not an independent legal server timestamp or standalone legal proof.',
  'English section 3 stamp overclaim'
);
replaceOnce(
  'Add Case screen with automatic platform/username extraction and Forensic Evidence Watermark option',
  'Add Case screen with automatic platform/username extraction and Documented Evidence Stamp option',
  'English section 3 caption'
);
replaceOnce(
  'شاشة إضافة حالة — التعرّف التلقائي على المنصة والاسم مع خيار ختم الأدلة القانوني',
  'شاشة إضافة حالة — التعرّف التلقائي على المنصة والاسم مع خيار ختم توثيق الأدلة',
  'Arabic section 3 caption'
);
replaceOnce(
  'attach a screenshot (automatically stamped with UTC evidence time)',
  'attach a screenshot (stamped with a UTC-formatted device timestamp for documentation, not an independent legal server timestamp)',
  'English customer form stamp wording'
);

if (originalEol === '\r\n') html = html.replace(/\n/g, '\r\n');
fs.writeFileSync(manualPath, html, 'utf8');
console.log('client-manual.html repaired with unique-anchor assertions.');
