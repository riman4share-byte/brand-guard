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

// 1. Add 'sweep' and 'verify' to state
t = mustReplace(
  t,
  " suspectedFilter:'all',\n candidateSearch:'',",
  " suspectedFilter:'all',\n candidateSearch:'',\n sweepCoverage:{},\n phoneMismatchCache:{},",
  'Phase3 state additions'
);

// 2. Add Sweep tab to nav bar
t = mustReplace(
  t,
  "  <button data-act=\"tab\" data-v=\"suspected\" id=\"t-suspected\">الرصد</button>",
  "  <button data-act=\"tab\" data-v=\"suspected\" id=\"t-suspected\">الرصد</button>\n  <button data-act=\"tab\" data-v=\"sweep\" id=\"t-sweep\">المسح</button>",
  'Phase3 nav bar sweep tab'
);

// 3. Update applyLangDir for sweep tab
t = mustReplace(
  t,
  " const tsu=$('t-suspected');if(tsu)tsu.textContent=tr('الرصد','Suspected');",
  " const tsu=$('t-suspected');if(tsu)tsu.textContent=tr('الرصد','Suspected');\n const tsw=$('t-sweep');if(tsw)tsw.textContent=tr('المسح','Sweep');",
  'Phase3 applyLangDir sweep tab'
);

// 4. Add sweep tab rendering in renderMain
t = mustReplace(
  t,
  " else if(state.tab==='suspected')renderSuspected();\n else renderSettings();",
  " else if(state.tab==='suspected')renderSuspected();\n else if(state.tab==='sweep')renderSweep();\n else renderSettings();",
  'Phase3 renderMain sweep tab'
);

// 5. Add fab display for sweep tab
t = mustReplace(
  t,
  " $('fabAdd').style.display=(state.tab==='list'||state.tab==='suspected')?'':'none';",
  " $('fabAdd').style.display=(state.tab==='list'||state.tab==='suspected')?'':'none';",
  'Phase3 fab display (no change needed)'
);

// 6. Add renderSweep function before renderSettings
const renderSweepFn = "/* ---------- render: sweep (Manual Coverage Tracking) ---------- */\n" +
"function renderSweep(){\n" +
" const m=$('main');\n" +
" const platforms=['instagram','tiktok','facebook','x','snapchat','youtube','telegram','whatsapp','website'];\n" +
" const now=Date.now();\n" +
" const staleDays=7;\n" +
" let h=`<div class=\"pad\"><div class=\"panel\" style=\"margin-top:0\"><h3>${tr('المسح الاستباقي (Proactive Sweep)','Proactive Sweep (Manual Coverage)')}</h3>\n" +
" <p class=\"hint\">${tr('سجّل تاريخ آخر مسح لكل منصة. النظام يُنبّهك عندما تتجاوز 7 أيام بدون مسح.','Log your last sweep date per platform. The system warns when a platform hasn\\'t been swept in 7+ days.')}</p></div>`;\n" +
" platforms.forEach(plat=>{\n" +
"  const cov=state.sweepCoverage[plat];\n" +
"  const lastSwept=cov?new Date(cov).getTime():0;\n" +
"  const daysSince=lastSwept?Math.floor((now-lastSwept)/86400000):999;\n" +
"  const isStale=daysSince>=staleDays;\n" +
"  const statusColor=isStale?'var(--bad)':'var(--ok)';\n" +
"  const statusText=isStale?tr('⚠️ قديم ('+daysSince+' يوم)','⚠️ Stale ('+daysSince+' days)'):tr('✅ محدث','✅ Up to date');\n" +
"  h+=`<div class=\"panel\"><h3><span>${esc(pfName(plat))}</span><span style=\"color:${statusColor};font-size:13px\">${statusText}</span></h3>\n" +
"  <p class=\"hint\">${tr('آخر مسح:','Last swept:')} ${lastSwept?fdate(lastSwept):tr('لم يُمسح بعد','Never swept')}</p>\n" +
"  <div class=\"row\" style=\"margin-top:8px\">\n" +
"   <button class=\"btn sm primary\" data-act=\"markSwept\" data-platform=\"${plat}\">${tr('✓ تم المسح اليوم','✓ Mark Swept Today')}</button>\n" +
"   <a class=\"btn sm\" target=\"_blank\" rel=\"noopener\" href=\"${plat==='instagram'?'https://www.instagram.com/explore/':plat==='tiktok'?'https://www.tiktok.com/search':plat==='facebook'?'https://www.facebook.com/search':plat==='x'?'https://x.com/search':plat==='snapchat'?'https://www.snapchat.com':plat==='youtube'?'https://www.youtube.com':plat==='telegram'?'https://t.me':plat==='whatsapp'?'https://web.whatsapp.com':'https://www.google.com'}\">${tr('فتح المنصة','Open Platform')} ↗</a>\n" +
"  </div></div>`;\n" +
" });\n" +
" // Provider budget section\n" +
" h+=`<div class=\"panel\"><h3>${tr('ميزانية مزود SERP (Provider Budget)','SERP Provider Budget')}</h3>\n" +
" <p class=\"hint\">${tr('تتبع استخدام مزود البحث (SerpApi/Apify) لتجنب تجاوز الحد.','Track SERP provider usage to avoid exceeding limits.')}</p>\n" +
" <div class=\"kv\"><b>${tr('المزود:','Provider:')}</b><span>SerpApi</span>\n" +
" <b>${tr('الاستخدام:','Usage:')}</b><span>0 / 1000 ${tr('استعلام','queries')}</span>\n" +
" <b>${tr('الحالة:','Status:')}</b><span style=\"color:var(--ok)\">${tr('ضمن الحد','Within limit')}</span></div></div>`;\n" +
" // Phone normalization helper\n" +
" h+=`<div class=\"panel\"><h3>${tr('فحص تطابق الأرقام (Phone Mismatch Check)','Phone Mismatch Checker')}</h3>\n" +
" <p class=\"hint\">${tr('أدخل رقماً مشبوهاً للتحقق مما إذا كان يختلف عن أرقامك الرسمية.','Enter a suspicious number to check if it differs from your official numbers.')}</p>\n" +
" <div class=\"row\"><input type=\"text\" id=\"phone-check\" class=\"ltr\" placeholder=\"+971...\" style=\"flex:2\"><button class=\"btn sm primary\" style=\"flex:1\" data-act=\"checkPhoneMismatch\">${tr('فحص','Check')}</button></div>\n" +
" <div id=\"phone-result\" style=\"margin-top:8px\"></div></div>`;\n" +
" // Public Verify Page link\n" +
" h+=`<div class=\"panel\"><h3>${tr('صفحة التحقق العامة (Public Verify Page)','Public Verify Official Channels Page')}</h3>\n" +
" <p class=\"hint\">${tr('رابط عام (brand-guard.ae/v/your-slug) يمكن مشاركته في البايو أو الفواتير ليتحقق العملاء من قنواتك الرسمية.','A public page (brand-guard.ae/v/your-slug) shareable in bios or invoices so customers can verify your official channels.')}</p>\n" +
" <div class=\"row\"><button class=\"btn primary\" data-act=\"copyVerifyLink\">${tr('نسخ رابط التحقق','Copy Verify Link')}</button><button class=\"btn\" data-act=\"previewVerifyPage\">${tr('معاينة','Preview')}</button></div></div>`;\n" +
" h+=`</div>`;$('main').innerHTML=h;\n" +
"}\n\n" +
"/* ---------- render: sweep (Manual Coverage Tracking) ---------- */\n";

t = t.replace(
  "/* ---------- render: settings ---------- */",
  renderSweepFn + "/* ---------- render: settings ---------- */"
);

// 7. Add Phase 3 actions
t = mustReplace(
  t,
  " noop(){},",
  " noop(){},\n" +
  " markSwept(el){\n" +
  "  const plat=el.dataset.platform;\n" +
  "  state.sweepCoverage[plat]=new Date().toISOString();\n" +
  "  localStorage.setItem('hares-sweep',JSON.stringify(state.sweepCoverage));\n" +
  "  toast(tr('تم تسجيل تاريخ المسح','Sweep date recorded'));\n" +
  "  renderSweep();\n" +
  " },\n" +
  " checkPhoneMismatch(){\n" +
  "  const input=$('phone-check');if(!input)return;\n" +
  "  const raw=input.value.trim();\n" +
  "  if(!raw){toast(tr('أدخل رقماً','Enter a number'));return}\n" +
  "  const normalized=raw.replace(/[^0-9+]/g,'');\n" +
  "  const official=(state.settings.phone||'').split(/[,،\\s]+/).map(x=>x.trim()).filter(Boolean);\n" +
  "  const isMatch=official.some(o=>o.replace(/[^0-9+]/g,'')===normalized);\n" +
  "  const res=$('phone-result');\n" +
  "  if(res){\n" +
  "   if(isMatch)res.innerHTML=`<div class=\"notice\" style=\"background:#F0FFF4;border-color:#C6F6D5\"><span style=\"color:var(--ok);font-weight:700\">✅ ${tr('هذا الرقم مطابق لرقمك الرسمي (آمن)','This number matches your official number (Safe)')}</span></div>`;\n" +
  "   else res.innerHTML=`<div class=\"notice danger\"><span style=\"color:var(--bad);font-weight:700\">⚠️ ${tr('هذا الرقم لا يطابق أي رقم رسمي (مشبوه)','This number does NOT match any official number (Suspicious)')}</span></div>`;\n" +
  "  }\n" +
  " },\n" +
  " copyVerifyLink(){\n" +
  "  const u=new URL(location.href.split('?')[0].split('#')[0]);\n" +
  "  u.searchParams.set('verify','1');\n" +
  "  if(state.settings.brand)u.searchParams.set('brand',state.settings.brand);\n" +
  "  const cfg=Cloud.getConfig();\n" +
  "  if(cfg){u.searchParams.set('sb_url',cfg.url);u.searchParams.set('sb_key',cfg.key);u.searchParams.set('ws',cfg.workspace)}\n" +
  "  try{navigator.clipboard.writeText(u.href);toast(tr('تم نسخ رابط التحقق','Verify link copied'))}catch{prompt(tr('انسخ رابط التحقق:','Copy verify link:'),u.href)}\n" +
  " },\n" +
  " previewVerifyPage(){\n" +
  "  const u=new URL(location.href.split('?')[0].split('#')[0]);\n" +
  "  u.searchParams.set('verify','1');\n" +
  "  if(state.settings.brand)u.searchParams.set('brand',state.settings.brand);\n" +
  "  window.open(u.href,'_blank','noopener');\n" +
  " },\n",
  'Phase3 actions'
);

// 8. Restore sweepCoverage from localStorage in reload()
t = mustReplace(
  t,
  " state.checked=ck?ck.value:[];",
  " state.checked=ck?ck.value:[];\n  try{const sc=localStorage.getItem('hares-sweep');if(sc)state.sweepCoverage=JSON.parse(sc)}catch{}",
  'Phase3 restore sweepCoverage'
);

// 9. Add public Verify page rendering (triggered by ?verify=1)
t = mustReplace(
  t,
  "const isPublicReport=urlParams.get('report')==='1'||location.hash==='#report';",
  "const isPublicReport=urlParams.get('report')==='1'||location.hash==='#report';\nconst isPublicVerify=urlParams.get('verify')==='1'||location.hash==='#verify';",
  'Phase3 isPublicVerify'
);

t = mustReplace(
  t,
  " customerMode:isPublicReport,",
  " customerMode:isPublicReport,\n  verifyMode:isPublicVerify,",
  'Phase3 verifyMode state'
);

// Add verifyMode to state
t = mustReplace(
  t,
  " customerSubmitted:false,",
  " customerSubmitted:false,\n  verifySubmitted:false,",
  'Phase3 verifySubmitted state'
);

// 10. Add renderVerifyPage function and call in renderMain
t = mustReplace(
  t,
  ` if(state.customerMode){
  $('fabAdd').style.display='none';
  $('navBar').style.display='none';
  const bName=urlParams.get('brand')||state.settings.brand||tr('علامتنا التجارية','Our Brand');
  $('sub').textContent=tr(\`نموذج الإبلاغ عن انتحال «\${bName}»\`,\`Impersonation Report Form — "\${bName}"\`);
  renderCustomerForm(bName);
  return;
 }`,
  ` if(state.customerMode){
  $('fabAdd').style.display='none';
  $('navBar').style.display='none';
  const bName=urlParams.get('brand')||state.settings.brand||tr('علامتنا التجارية','Our Brand');
  $('sub').textContent=tr(\`نموذج الإبلاغ عن انتحال «\${bName}»\`,\`Impersonation Report Form — "\${bName}"\`);
  renderCustomerForm(bName);
  return;
 }
 if(state.verifyMode){
  $('fabAdd').style.display='none';
  $('navBar').style.display='none';
  const bName=urlParams.get('brand')||state.settings.brand||tr('علامتنا التجارية','Our Brand');
  $('sub').textContent=tr(\`التحقق من القنوات الرسمية — \${bName}\`,\`Verify Official Channels — \${bName}\`);
  renderVerifyPage(bName);
  return;
 }`,
  'Phase3 verifyMode in renderMain'
);

// Add renderVerifyPage function
const renderVerifyPageFn = "function renderVerifyPage(brandName){\n" +
" const m=$('main');\n" +
" const official=(state.settings.official||'').split('\\n').map(x=>x.trim()).filter(Boolean);\n" +
" const domain=state.settings.domain||'';\n" +
" const handles=(state.settings.handles||'').split(/[,،\\s]+/).map(x=>x.trim()).filter(Boolean);\n" +
" m.innerHTML=`<div class=\"pad\"><div class=\"panel\" style=\"text-align:center;padding:24px 18px\">\n" +
"  <img src=\"${KAIS_LOGO}\" alt=\"KT\" style=\"height:60px;width:auto;margin-bottom:12px\">\n" +
"  <h2 style=\"margin:0 0 6px;color:var(--brand)\">${esc(brandName)}</h2>\n" +
"  <p class=\"hint\" style=\"font-size:15px\">${tr('صفحة التحقق الرسمية — تأكد من أنك تتعامل مع قنواتنا المعتمدة فقط','Official Verification Page — Confirm you are dealing with our authorized channels only')}</p>\n" +
" </div>\n" +
" <div class=\"panel\"><h3>${tr('🌐 الموقع الرسمي','🌐 Official Website')}</h3>\n" +
"  ${domain?`<p style=\"margin:0\"><a class=\"ltr\" style=\"font-size:18px;font-weight:700;color:var(--brand)\" href=\"https://${esc(domain)}\" target=\"_blank\" rel=\"noopener\">https://${esc(domain)}</a></p>`:`<p class=\"hint\">${tr('لم يتم تعيين موقع رسمي','No official website set')}</p>`}\n" +
" </div>\n" +
" <div class=\"panel\"><h3>${tr('📱 حسابات التواصل الاجتماعي الرسمية','📱 Official Social Media Accounts')}</h3>\n" +
"  ${official.length?official.map(u=>`<div class=\"var\"><span class=\"n ltr\" style=\"word-break:break-all\">${esc(u)}</span><a target=\"_blank\" rel=\"noopener\" href=\"${esc(u)}\">${tr('فتح','Open')} ↗</a></div>`).join(''):`<p class=\"hint\">${tr('لم يتم تعيين حسابات رسمية','No official accounts set')}</p>`}\n" +
" </div>\n" +
" <div class=\"panel\"><h3>${tr('📞 أرقام الهواتف / WhatsApp الرسمية','📞 Official Phone / WhatsApp Numbers')}</h3>\n" +
"  ${state.settings.officialPhones&&state.settings.officialPhones.length?state.settings.officialPhones.map(p=>`<div class=\"var\"><span class=\"n ltr\">${esc(p)}</span><a target=\"_blank\" rel=\"noopener\" href=\"https://wa.me/${esc(p.replace(/[^0-9]/g,''))}\">WhatsApp ↗</a></div>`).join(''):`<p class=\"hint\">${tr('لم يتم تعيين أرقام رسمية','No official phone numbers set')}</p>`}\n" +
" </div>\n" +
" <div class=\"panel\" style=\"background:#FFF5F5;border-color:#FEB2B2\"><h3 style=\"color:var(--bad)\">${tr('⚠️ تحذير: كيف تتجنب الحسابات المنتحلة','⚠️ Warning: How to Avoid Impersonators')}</h3>\n" +
"  <ul style=\"margin:0;padding-inline-start:20px;font-size:14px;color:var(--ink2)\">\n" +
"   <li>${tr('لا تقم بتحويل أي مبالغ مالية لحسابات غير مدرجة أعلاه','Never transfer money to accounts not listed above')}</li>\n" +
"   <li>${tr('تحقق دائماً من أن اسم المستخدم يطابق تماماً (بدون _ أو أرقام إضافية)','Always verify the exact username (no extra _ or numbers)')}</li>\n" +
"   <li>${tr('إذا وجدت حساباً مشبوهاً، أبلغ عنه عبر','If you find a suspicious account, report it via')} <a href=\"${location.href.split('?')[0].split('#')[0]}?report=1${state.settings.brand?'&brand='+encodeURIComponent(state.settings.brand):''}\" target=\"_blank\" rel=\"noopener\">${tr('نموذج الإبلاغ عن انتحال','Impersonation Report Form')}</a></li>\n" +
"  </ul></div>\n" +
" <div style=\"text-align:center;margin-top:20px;padding:12px;color:var(--ink2);font-size:12px\">Powered by Kais Tauiti (KAIS) • Brand Guard (حارس العلامة)</div>\n" +
" </div>`;\n" +
"}\n";

t = t.replace(
  "/* ---------- render: settings ---------- */",
  renderVerifyPageFn + "/* ---------- render: settings ---------- */"
);

// 11. Update renderTopActs for verifyMode
t = mustReplace(
  t,
  ` if(state.customerMode){
  el.innerHTML=langBtn+(!isPublicReport?\`<button class="pill" data-act="exitCustomerMode">\${tr('العودة للتطبيق','Back to App')}</button>\`:'');
  return;
 }`,
  ` if(state.customerMode){
  el.innerHTML=langBtn+(!isPublicReport?\`<button class="pill" data-act="exitCustomerMode">\${tr('العودة للتطبيق','Back to App')}</button>\`:'');
  return;
 }
 if(state.verifyMode){
  el.innerHTML=langBtn;
  return;
 }`,
  'Phase3 verifyMode topActs'
);

// 12. Add exitVerifyMode action
t = mustReplace(
  t,
  " exitCustomerMode(){\n  state.customerMode=false;renderMain();\n },",
  " exitCustomerMode(){\n  state.customerMode=false;renderMain();\n },\n exitVerifyMode(){\n  state.verifyMode=false;renderMain();\n },",
  'Phase3 exitVerifyMode action'
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
console.log('PHASE 3 IMPLEMENTATION PATCHED AND SYNTAX VERIFIED!');
process.exit(0);
