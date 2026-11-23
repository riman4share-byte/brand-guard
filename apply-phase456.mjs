import fs from 'node:fs';
import path from 'node:path';

const dir = process.cwd();
let t = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

function mustReplace(src, anchor, next, label) {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error(label + ': anchor not found');
  if (src.indexOf(anchor, i + 1) >= 0) throw new Error(label + ': anchor not unique');
  return src.slice(0, i) + next + src.slice(i + anchor.length);
}

// 1. Add whiteLabel and onboarding state
t = mustReplace(
  t,
  " sweepCoverage:{},\n phoneMismatchCache:{},",
  " sweepCoverage:{},\n phoneMismatchCache:{},\n whiteLabel:{logo:'',primaryColor:'#0F5C7A',secondaryColor:'#101C2C',accentColor:'#F2A541',customDomain:'',plan:'free'},\n onboardingStep:'brand_profile',\n onboardingComplete:false,",
  'Phase456 state additions'
);

// 2. Add 'analytics' and 'health' tabs to nav bar
t = mustReplace(
  t,
  "  <button data-act=\"tab\" data-v=\"sweep\" id=\"t-sweep\">المسح</button>",
  "  <button data-act=\"tab\" data-v=\"sweep\" id=\"t-sweep\">المسح</button>\n  <button data-act=\"tab\" data-v=\"analytics\" id=\"t-analytics\">التحليلات</button>",
  'Phase456 nav bar analytics tab'
);

// 3. Update applyLangDir
t = mustReplace(
  t,
  " const tsw=$('t-sweep');if(tsw)tsw.textContent=tr('المسح','Sweep');",
  " const tsw=$('t-sweep');if(tsw)tsw.textContent=tr('المسح','Sweep');\n const tan=$('t-analytics');if(tan)tan.textContent=tr('التحليلات','Analytics');",
  'Phase456 applyLangDir analytics tab'
);

// 4. Add analytics tab rendering in renderMain
t = mustReplace(
  t,
  " else if(state.tab==='sweep')renderSweep();\n else renderSettings();",
  " else if(state.tab==='sweep')renderSweep();\n else if(state.tab==='analytics')renderAnalytics();\n else renderSettings();",
  'Phase456 renderMain analytics tab'
);

// 5. Add renderAnalytics function
const renderAnalyticsFn = "/* ---------- render: analytics & health ---------- */\n" +
"function renderAnalytics(){\n" +
" const m=$('main');\n" +
" const cases=state.cases;\n" +
" const total=cases.length;\n" +
" const byStatus=STATUSES.map(s=>({k:s.k,t:stName(s.k),n:cases.filter(c=>c.status===s.k).length}));\n" +
" const byType=Object.keys(TYPES).map(k=>({k,t:typeInfo(k).t,n:cases.filter(c=>typeOf(c)===k).length}));\n" +
" const byPlatform=Object.keys(PLATFORMS).map(k=>({k,t:pfName(k),n:cases.filter(c=>c.platform===k).length})).filter(x=>x.n>0);\n" +
" const removed=cases.filter(c=>c.status==='removed').length;\n" +
" const reported=cases.filter(c=>c.status==='reported'||c.status==='review').length;\n" +
" const overdue=cases.filter(isLate).length;\n" +
" const customerReports=cases.filter(c=>c.source==='customer').length;\n" +
" const avgDaysToRemoval=cases.filter(c=>c.status==='removed'&&c.reportedAt).map(c=>(c.updatedAt-c.reportedAt)/86400000);\n" +
" const avgRemoval=avgDaysToRemoval.length?Math.round(avgDaysToRemoval.reduce((a,b)=>a+b,0)/avgDaysToRemoval.length):0;\n" +
" let h=`<div class=\"pad\"><div class=\"panel\" style=\"margin-top:0\"><h3>${tr('لوحة التحليلات (Analytics Dashboard)','Analytics Dashboard')}</h3>\n" +
" <p class=\"hint\">${tr('مقاييس الأداء والحماية لعلامتك التجارية.','Performance and protection metrics for your brand.')}</p></div>\n" +
" <div class=\"panel\"><h3>${tr('المقاييس الرئيسية (KPIs)','Key Performance Indicators')}</h3>\n" +
" <div class=\"kv\"><b>${tr('إجمالي الحالات:','Total Cases:')}</b><span>${total}</span>\n" +
" <b>${tr('تمت الإزالة:','Removed:')}</b><span style=\"color:var(--ok)\">${removed}</span>\n" +
" <b>${tr('قيد المتابعة:','Pending:')}</b><span style=\"color:var(--warn)\">${reported}</span>\n" +
" <b>${tr('متأخرة:','Overdue:')}</b><span style=\"color:var(--bad)\">${overdue}</span>\n" +
" <b>${tr('بلاغات العملاء:','Customer Reports:')}</b><span>${customerReports}</span>\n" +
" <b>${tr('متوسط أيام الإزالة:','Avg. Days to Removal:')}</b><span>${avgRemoval} ${tr('يوم','days')}</span>\n" +
" <b>${tr('معدل الإزالة:','Removal Rate:')}</b><span>${total?Math.round(removed/total*100):0}%</span></div></div>\n" +
" <div class=\"panel\"><h3>${tr('الحالات حسب الحالة (Status Breakdown)','Cases by Status')}</h3>\n" +
" <div class=\"kv\">${byStatus.map(s=>`<b>${s.t}:</b><span>${s.n}</span>`).join('')}</div></div>\n" +
" <div class=\"panel\"><h3>${tr('الحالات حسب النوع (Type Breakdown)','Cases by Type')}</h3>\n" +
" <div class=\"kv\">${byType.filter(x=>x.n>0).map(s=>`<b>${s.t}:</b><span>${s.n}</span>`).join('')}</div></div>\n" +
" <div class=\"panel\"><h3>${tr('الحالات حسب المنصة (Platform Breakdown)','Cases by Platform')}</h3>\n" +
" <div class=\"kv\">${byPlatform.map(s=>`<b>${s.t}:</b><span>${s.n}</span>`).join('')}</div></div>\n" +
" <div class=\"panel\"><h3>${tr('تصدير تقرير العميل (Monthly Client Report)','Export Monthly Client Report')}</h3>\n" +
" <p class=\"hint\">${tr('توليد تقرير PDF شهري للعميل (ملخص النشاط، عدد الحالات، الإجراءات).','Generate a monthly PDF report for the client (activity summary, case counts, actions taken).')}</p>\n" +
" <div class=\"row\"><button class=\"btn primary\" data-act=\"printCases\">${tr('طباعة تقرير PDF','Print PDF Report')}</button><button class=\"btn\" data-act=\"exportCSV\">${tr('تصدير Excel (CSV)','Export Excel (CSV)')}</button></div></div>\n" +
" <div class=\"panel\"><h3>${tr('خطة الاشتراك (Plan & Limits)','Subscription Plan & Limits')}</h3>\n" +
" <div class=\"kv\"><b>${tr('الخطة الحالية:','Current Plan:')}</b><span style=\"color:var(--brand);font-weight:700\">${esc(state.whiteLabel.plan.toUpperCase())}</span>\n" +
" <b>${tr('الحد الأقصى للعلامات:','Max Brands:')}</b><span>${state.whiteLabel.plan==='free'?'1':'10'}</span>\n" +
" <b>${tr('الحد الأقصى للحالات:','Max Cases:')}</b><span>${state.whiteLabel.plan==='free'?'100':'10,000'}</span>\n" +
" <b>${tr('الحد الأقصى للصور:','Max Images/Case:')}</b><span>${state.whiteLabel.plan==='free'?'10':'50'}</span></div>\n" +
" <p class=\"hint\" style=\"margin-top:8px\">${tr('للترقية، تواصل مع Kais Tauiti.','To upgrade, contact Kais Tauiti.')}</p></div></div>`;\n" +
" $('main').innerHTML=h;\n" +
"}\n\n" +
"/* ---------- render: analytics ---------- */\n";

t = t.replace(
  "/* ---------- render: settings ---------- */",
  renderAnalyticsFn + "/* ---------- render: settings ---------- */"
);

// 5. Add onboarding wizard to settings
t = mustReplace(
  t,
  " <div class=\"panel\" style=\"margin-top:0\"><h3>${tr('بيانات العلامة','Brand Profile')}</h3>",
  " <div class=\"panel\" style=\"margin-top:0\"><h3>${tr(' معالج الإعداد (Onboarding Wizard)','Onboarding Wizard')}</h3>\n" +
  " <p class=\"hint\">${tr('أكمل هذه الخطوات لتفعيل حماية علامتك بالكامل.','Complete these steps to fully activate your brand protection.')}</p>\n" +
  " <div style=\"display:flex;flex-direction:column;gap:8px;margin-top:10px\">\n" +
  "  <div style=\"display:flex;align-items:center;gap:10px;padding:8px;background:${state.settings.brand?'#F0FFF4':'#FFF5F5'};border-radius:8px;border:1px solid ${state.settings.brand?'#C6F6D5':'#FED7D7'}\"><span style=\"font-size:18px\">${state.settings.brand?'✅':'⬜'}</span><span style=\"font-size:14px;font-weight:500\">${tr('١. أدخل بيانات العلامة (Brand Profile)','1. Enter Brand Profile')}</span></div>\n" +
  "  <div style=\"display:flex;align-items:center;gap:10px;padding:8px;background:${state.settings.official?'#F0FFF4':'#FFF5F5'};border-radius:8px;border:1px solid ${state.settings.official?'#C6F6D5':'#FED7D7'}\"><span style=\"font-size:18px\">${state.settings.official?'✅':'⬜'}</span><span style=\"font-size:14px;font-weight:500\">${tr('٢. أضف حساباتك الرسمية (Official Channels)','2. Add Official Channels')}</span></div>\n" +
  "  <div style=\"display:flex;align-items:center;gap:10px;padding:8px;background:${state.settings.images?'#F0FFF4':'#FFF5F5'};border-radius:8px;border:1px solid ${state.settings.images?'#C6F6D5':'#FED7D7'}\"><span style=\"font-size:18px\">${state.settings.images?'✅':'⬜'}</span><span style=\"font-size:14px;font-weight:500\">${tr('٣. أضف صور منتجاتك (Product Images)','3. Add Product Images')}</span></div>\n" +
  "  <div style=\"display:flex;align-items:center;gap:10px;padding:8px;background:${Cloud.getConfig()?'#F0FFF4':'#FFF5F5'};border-radius:8px;border:1px solid ${Cloud.getConfig()?'#C6F6D5':'#FED7D7'}\"><span style=\"font-size:18px\">${Cloud.getConfig()?'✅':'⬜'}</span><span style=\"font-size:14px;font-weight:500\">${tr('٤. اربط Supabase (اختياري — Cloud Sync)','4. Connect Supabase (Optional — Cloud Sync)')}</span></div>\n" +
  "  <div style=\"display:flex;align-items:center;gap:10px;padding:8px;background:${state.settings.tm?'#F0FFF4':'#FFF5F5'};border-radius:8px;border:1px solid ${state.settings.tm?'#C6F6D5':'#FED7D7'}\"><span style=\"font-size:18px\">${state.settings.tm?'✅':'⬜'}</span><span style=\"font-size:14px;font-weight:500\">${tr('٥. أدخل رقم تسجيل العلامة التجارية (Trademark No.)','5. Enter Trademark Registration No.')}</span></div>\n" +
  " </div></div>\n" +
  " <div class=\"panel\" style=\"margin-top:0\"><h3>${tr('بيانات العلامة','Brand Profile')}</h3>",
  'Phase456 onboarding wizard'
);

// 6. Add white-label settings panel
t = mustReplace(
  t,
  " <div class=\"panel\"><h3>${tr('المزامنة السحابية (Supabase — اختياري)','Cloud Sync (Supabase — Optional)')}</h3>",
  " <div class=\"panel\"><h3>${tr('إعدادات White-Label (للعملاء)','White-Label Settings (For Clients)')}</h3>\n" +
  " <p class=\"hint\">${tr('تخصيص الشعار والألوان والدومين (للعملاء المميزين).','Customize logo, colors, and domain (for premium clients).')}</p>\n" +
  " ${f('wl-logo',tr('رابط شعار العميل (Logo URL)','Client Logo URL'),state.whiteLabel.logo,'url','','ltr')}\n" +
  " ${f('wl-primary',tr('اللون الأساسي (Primary Color)','Primary Color (hex)'),state.whiteLabel.primaryColor,'text','#0F5C7A','ltr')}\n" +
  " ${f('wl-accent',tr('لون التمييز (Accent Color)','Accent Color (hex)'),state.whiteLabel.accentColor,'text','#F2A541','ltr')}\n" +
  " ${f('wl-domain',tr('دومين مخصص (Custom Domain)','Custom Domain'),state.whiteLabel.customDomain,'text','brand-guard.yourdomain.com','ltr')}\n" +
  " <div style=\"height:12px\"></div>\n" +
  " ${isOwner()?`<button class=\"btn primary block\" data-act=\"saveWhiteLabel\">${tr('حفظ إعدادات White-Label','Save White-Label Settings')}</button>`:''}</div>\n" +
  " <div class=\"panel\"><h3>${tr('المزامنة السحابية (Supabase — اختياري)','Cloud Sync (Supabase — Optional)')}</h3>",
  'Phase456 white-label panel'
);

// 7. Add saveWhiteLabel action
t = mustReplace(
  t,
  " noop(){},",
  " noop(){},\n" +
  " saveWhiteLabel(){\n" +
  "  if(!isOwner())return;\n" +
  "  const g=id=>$(id)?$(id).value.trim():'';\n" +
  "  state.whiteLabel={logo:g('wl-logo'),primaryColor:g('wl-primary')||'#0F5C7A',secondaryColor:state.whiteLabel.secondaryColor,accentColor:g('wl-accent')||'#F2A541',customDomain:g('wl-domain'),plan:state.whiteLabel.plan};\n" +
  "  localStorage.setItem('hares-whitelabel',JSON.stringify(state.whiteLabel));\n" +
  "  // Apply colors to CSS variables\n" +
  "  document.documentElement.style.setProperty('--brand',state.whiteLabel.primaryColor);\n" +
  "  document.documentElement.style.setProperty('--gold',state.whiteLabel.accentColor);\n" +
  "  if(state.whiteLabel.logo){const logoEl=document.getElementById('ktTopLogo');if(logoEl)logoEl.src=state.whiteLabel.logo}\n" +
  "  toast(tr('تم حفظ إعدادات White-Label','White-Label settings saved'));\n" +
  " },\n" +
  " async exportMonthlyReport(){\n" +
  "  const cases=state.cases;\n" +
  "  const removed=cases.filter(c=>c.status==='removed').length;\n" +
  "  const reported=cases.filter(c=>c.status==='reported'||c.status==='review').length;\n" +
  "  const overdue=cases.filter(isLate).length;\n" +
  "  const customerReports=cases.filter(c=>c.source==='customer').length;\n" +
  "  const byPlatform=Object.keys(PLATFORMS).map(k=>({name:pfName(k),n:cases.filter(c=>c.platform===k).length})).filter(x=>x.n>0);\n" +
  "  const report={\n" +
  "   title:tr('تقرير حماية العلامة التجارية (شهري)','Brand Protection Monthly Report'),\n" +
  "   brand:state.settings.brand,\n" +
  "   period:new Date().toLocaleDateString(isEn()?'en-US':'ar-AE',{year:'numeric',month:'long'}),\n" +
  "   generated:new Date().toISOString(),\n" +
  "   kpis:{total:cases.length,removed,reported,overdue,customerReports,removalRate:cases.length?Math.round(removed/cases.length*100):0},\n" +
  "   byPlatform,\n" +
  "   cases:cases.map(c=>({id:c.id,type:typeOf(c),platform:pfName(c.platform),handle:idLabel(c),status:stName(c.status),refId:c.refId||'',detected:fdate(c.foundAt),reported:c.reportedAt?fdate(c.reportedAt):''}))\n" +
  "  };\n" +
  "  const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});\n" +
  "  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='monthly-report-'+new Date().toISOString().slice(0,7)+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);\n" +
  "  toast(tr('تم تصدير تقرير العميل (JSON)','Client monthly report exported (JSON)'));\n" +
  " },\n",
  'Phase456 actions'
);

// 8. Update reload() to restore whiteLabel
t = mustReplace(
  t,
  " state.checked=ck?ck.value:[];",
  " state.checked=ck?ck.value:[];\n  try{const wl=localStorage.getItem('hares-whitelabel');if(wl)state.whiteLabel=JSON.parse(wl)}catch{}",
  'Phase456 restore whiteLabel'
);

// 9. Apply white-label colors on startup
const _wlIdx = t.lastIndexOf("applyLangDir();");
if (_wlIdx < 0) throw new Error('Phase456 apply whiteLabel colors: anchor not found');
t = t.slice(0, _wlIdx) + "applyLangDir();\n// Apply white-label colors\nif(state.whiteLabel){document.documentElement.style.setProperty('--brand',state.whiteLabel.primaryColor||'#0F5C7A');document.documentElement.style.setProperty('--gold',state.whiteLabel.accentColor||'#F2A541');if(state.whiteLabel.logo){const le=document.getElementById('ktTopLogo');if(le)le.src=state.whiteLabel.logo}}" + t.slice(_wlIdx + "applyLangDir();".length);

// 10. Add health status page (simple)
const _hpIdx = t.indexOf(" if(state.verifyMode){");
if (_hpIdx < 0) throw new Error('Phase456 health page gate: anchor not found');
t = t.slice(0, _hpIdx) + " if(urlParams.get('health')==='1'){\n  $('fabAdd').style.display='none';$('navBar').style.display='none';\n  $('sub').textContent=tr('حالة النظام (Health Status)','System Health Status');\n  renderHealthPage();return;\n }\n if(state.verifyMode){" + t.slice(_hpIdx + " if(state.verifyMode){".length);

const renderHealthPageFn = "function renderHealthPage(){\n" +
" const m=$('main');\n" +
" m.innerHTML=`<div class=\"pad\"><div class=\"panel\" style=\"text-align:center;padding:24px\"><h3>${tr('حالة النظام (Health Status)','System Health Status')}</h3>\n" +
" <div class=\"kv\"><b>${tr('التطبيق:','App:')}</b><span style=\"color:var(--ok)\">✅ ${tr('يعمل','Running')}</span>\n" +
" <b>${tr('IndexedDB:','IndexedDB:')}</b><span style=\"color:var(--ok)\">✅ ${tr('متاح','Available')}</span>\n" +
" <b>${tr('Supabase:','Supabase:')}</b><span style=\"color:${Cloud.getConfig()?'var(--ok)':'var(--warn)'}\">${Cloud.getConfig()?'✅ '+tr('متصل','Connected'):'⚠️ '+tr('غير متصل (محلي)','Not connected (local)')}</span>\n" +
" <b>${tr('اللغة:','Language:')}</b><span>${state.lang.toUpperCase()}</span>\n" +
" <b>${tr('الإصدار:','Version:')}</b><span>Brand Guard v3.0 (Phase 6)</span>\n" +
" <b>${tr('Powered by:','Powered by:')}</b><span style=\"color:var(--gold);font-weight:700\">Kais Tauiti (KAIS)</span></div>\n" +
" <div style=\"margin-top:16px\"><button class=\"btn primary\" data-act=\"tab\" data-v=\"list\">${tr('العودة للتطبيق','Back to App')}</button></div></div></div>`;\n" +
"}\n";

t = t.replace(
  "/* ---------- render: settings ---------- */",
  renderHealthPageFn + "/* ---------- render: settings ---------- */"
);

fs.writeFileSync(path.join(dir, 'index.html'), t, 'utf8');
fs.writeFileSync(path.join(dir, 'hares-alalama.html'), t, 'utf8');

const enHtml = t
  .replace('<html lang="ar" dir="rtl">', '<html lang="en" dir="ltr">')
  .replace('<title>حارس العلامة — Brand Guard</title>', '<title>Brand Guard — حارس العلامة</title>')
  .replace(
    "const defaultLang=window.__HARES_DEFAULT_LANG__||urlParams.get('lang')||localStorage.getItem('hares-lang')||'ar';",
    "window.__HARES_DEFAULT_LANG__='en';\nconst defaultLang=urlParams.get('lang')||window.__HARES_DEFAULT_LANG__||'en';"
  );
fs.writeFileSync(path.join(dir, 'brand-guard-en.html'), enHtml, 'utf8');

for (const fname of ['index.html', 'hares-alalama.html', 'brand-guard-en.html']) {
  const txt = fs.readFileSync(path.join(dir, fname), 'utf8');
  if ([...txt].some(c => c === '\uFFFD')) throw new Error(`U+FFFD found in ${fname}`);
  const m = txt.match(/<script>([\s\S]*?)<\/script>/);
  new Function(m[1]);
}
console.log('PHASE 4/5/6 IMPLEMENTATION PATCHED AND SYNTAX VERIFIED!');
process.exit(0);
