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

// 1. Add 'suspected' state fields
t = mustReplace(
  t,
  " tab:'list',\n filter:'all',",
  " tab:'list',\n filter:'all',\n suspectedFilter:'all',\n candidateSearch:'',",
  'Phase1 state additions'
);

// 2. Add 'suspected' tab button to nav bar
t = mustReplace(
  t,
  "<button data-act=\"tab\" data-v=\"variants\" id=\"t-variants\">الفحص</button>",
  "<button data-act=\"tab\" data-v=\"variants\" id=\"t-variants\">الفحص</button>\n  <button data-act=\"tab\" data-v=\"suspected\" id=\"t-suspected\">الرصد</button>",
  'Phase1 nav bar suspected tab'
);

// 3. Update applyLangDir to include suspected tab label
t = mustReplace(
  t,
  " const tv=$('t-variants');if(tv)tv.textContent=tr('الفحص','Scan');",
  " const tv=$('t-variants');if(tv)tv.textContent=tr('الفحص','Scan');\n const tsu=$('t-suspected');if(tsu)tsu.textContent=tr('الرصد','Suspected');",
  'Phase1 applyLangDir suspected tab'
);

// 4. Add suspected tab rendering in renderMain
t = mustReplace(
  t,
  " }else if(state.tab==='variants')renderVariants();\n else renderSettings();",
  " }else if(state.tab==='variants')renderVariants();\n else if(state.tab==='suspected')renderSuspected();\n else renderSettings();",
  'Phase1 renderMain suspected tab'
);

// 5. Add suspected tab fab display logic
t = mustReplace(
  t,
  " $('fabAdd').style.display=state.tab==='list'?'':'none';",
  " $('fabAdd').style.display=(state.tab==='list'||state.tab==='suspected')?'':'none';",
  'Phase1 fab display'
);

// 6. Add renderSuspected function before renderList
const renderSuspectedFn = "/* ---------- render: suspected (Inbox) ---------- */\n" +
"function renderSuspected(){\n" +
" const m=$('main');\n" +
" m.innerHTML=`<div class=\"pad\"><div id=\"suspectedNote\"></div>\n" +
"  <div class=\"row\" style=\"margin-bottom:12px\">\n" +
"   <input type=\"search\" id=\"sq\" style=\"flex:3\" placeholder=\"${tr('بحث في المرشحين (رابط، اسم، منصة)','Search candidates (URL, handle, platform)')}\" value=\"${esc(state.candidateSearch)}\" aria-label=\"${tr('بحث','Search')}\">\n" +
"   <select id=\"sf\" style=\"flex:1;min-height:48px\">\n" +
"    <option value=\"all\">${tr('الكل','All')}</option>\n" +
"    <option value=\"new\">${tr('جديد','New')}</option>\n" +
"    <option value=\"confirmed\">${tr('مؤكد','Confirmed')}</option>\n" +
"    <option value=\"dismissed\">${tr('مرفوض','Dismissed')}</option>\n" +
"    <option value=\"allowlisted\">${tr('مسموح','Allowlisted')}</option>\n" +
"   </select>\n" +
"  </div>\n" +
"  <div id=\"candidateList\"></div>\n" +
"  <div style=\"height:16px\"></div>\n" +
"  <div class=\"panel\">\n" +
"   <h3>${tr('تشغيل كاشف النطاقات (Domain Detector)','Run Domain Detector')}</h3>\n" +
"   <p class=\"hint\">${tr('يُشغّل Edge Function detect-domains على Supabase لفحص النطاقات المشابهة تلقائياً.','Runs the detect-domains Edge Function on Supabase to automatically scan lookalike domains.')}</p>\n" +
"   <div class=\"row\">\n" +
"    <button class=\"btn primary\" data-act=\"runDomainDetector\">${tr('تشغيل كاشف النطاقات','Run Domain Detector')}</button>\n" +
"    <button class=\"btn\" data-act=\"tab\" data-v=\"settings\">${tr('إعدادات العلامة','Brand Settings')}</button>\n" +
"   </div>\n" +
"   <div id=\"detectorRuns\"></div>\n" +
"  </div></div>`;\n" +
" $('sq').addEventListener('input',e=>{state.candidateSearch=e.target.value;renderCandidateList()});\n" +
" $('sf').addEventListener('change',e=>{state.suspectedFilter=e.target.value;renderCandidateList()});\n" +
" renderCandidateList();\n" +
" renderDetectorRuns();\n" +
"}\n\n" +
"function renderCandidateList(){\n" +
" const el=$('candidateList');if(!el)return;\n" +
" const filter=state.suspectedFilter;\n" +
" const q=state.candidateSearch.trim().toLowerCase();\n" +
" let list=state.cases.filter(c=>c.source==='customer'||c.source==='detect-domains'||c.source==='detect-ct');\n" +
" if(filter!=='all')list=list.filter(c=>(c.candidateStatus||'new')===filter);\n" +
" if(q)list=list.filter(c=>(c.username+' '+c.url+' '+(c.platform||'')).toLowerCase().includes(q));\n" +
" if(!list.length){\n" +
"  el.innerHTML=`<div class=\"empty\"><b>${tr('لا توجد مرشحات','No candidates yet')}</b>${tr('شغّل كاشف النطاقات أو انتظر بلاغات العملاء.','Run the domain detector or wait for customer reports.')}</div>`;\n" +
"  return;\n" +
" }\n" +
" el.innerHTML=list.map(c=>{\n" +
"  const p=PLATFORMS[c.platform]||PLATFORMS.other;\n" +
"  const score=c.candidateScore||70;\n" +
"  const scoreColor=score>=70?'var(--bad)':score>=40?'var(--warn)':'var(--ok)';\n" +
"  return `<div class=\"case\" style=\"cursor:default\">\n" +
"   <span class=\"pf\" style=\"background:${p.c};${p.dark?'color:#222':''}\">${p.i}</span>\n" +
"   <span class=\"meta\"><div class=\"u\"><bdi dir=\"ltr\">${esc(idLabel(c))}</bdi></div>\n" +
"   <div class=\"d\">${typeInfo(typeOf(c)).t} · ${pfName(c.platform)} · ${tr('النتيجة:','Score:')} <b style=\"color:${scoreColor}\">${score}</b></div></span>\n" +
"   <div style=\"display:flex;gap:4px;flex-wrap:wrap\">\n" +
"    <button class=\"btn sm ok\" data-act=\"confirmCandidate\" data-id=\"${c.id}\">${tr('تأكيد → إنشاء حالة','Confirm → Create Case')}</button>\n" +
"    <button class=\"btn sm\" data-act=\"dismissCandidate\" data-id=\"${c.id}\">${tr('رفض','Dismiss')}</button>\n" +
"    <button class=\"btn sm\" data-act=\"allowlistCandidate\" data-id=\"${c.id}\">${tr('مسموح','Allowlist')}</button>\n" +
"   </div></div>`;\n" +
" }).join('');\n" +
"}\n\n" +
"async function renderDetectorRuns(){\n" +
" const el=$('detectorRuns');if(!el)return;\n" +
" const cfg=Cloud.getConfig();\n" +
" if(!cfg||!state.authUser){\n" +
"  el.innerHTML=`<p class=\"hint\" style=\"margin-top:8px\">${tr('يتطلب اتصال Supabase ومصادقة.','Requires Supabase connection and authentication.')}</p>`;\n" +
"  return;\n" +
" }\n" +
" try{\n" +
"  const r=await fetch(cfg.url+'/rest/v1/detector_runs?order=started_at.desc&limit=10',{\n" +
"   headers:Auth.authHeaders(cfg,await Auth.getSession())\n" +
"  });\n" +
"  if(!r.ok){el.innerHTML=`<p class=\"hint\">${tr('تعذّر جلب سجلات الكاشف','Could not fetch detector runs')}</p>`;return}\n" +
"  const runs=await r.json();\n" +
"  if(!runs.length){el.innerHTML=`<p class=\"hint\">${tr('لا توجد عمليات فحص سابقة','No previous detector runs')}</p>`;return}\n" +
"  el.innerHTML=`<ul class=\"log\" style=\"margin-top:8px\">${runs.map(r=>`<li>${fdate(new Date(r.started_at).getTime())}: <b>${esc(r.detector)}</b> — ${esc(r.status)} ${r.stats?JSON.stringify(r.stats):''} ${r.error?'<span style=\"color:var(--bad)\">'+esc(r.error)+'</span>':''}</li>`).join('')}</ul>`;\n" +
" }catch{el.innerHTML=`<p class=\"hint\">${tr('تعذّر جلب سجلات الكاشف','Could not fetch detector runs')}</p>`}\n" +
"}\n\n" +
"/* ---------- render: suspected (Inbox) ---------- */\n";

t = t.replace(
  "/* ---------- render: settings ---------- */",
  renderSuspectedFn + "/* ---------- render: settings ---------- */"
);

// 7. Add brand profile editor panel to settings (before the cloud sync panel)
const brandProfilePanel = " <div class=\"panel\"><h3>${tr('ملف العلامة (Brand Profile — Phase 1)','Brand Profile (Phase 1)')}</h3>\n" +
" <p class=\"hint\">${tr('تُستخدم في كاشف النطاقات (D1) والتنبيهات.','Used by the domain detector (D1) and alert notifications.')}</p>\n" +
" " + "f('s-aliases',tr('أسماء بديلة (Alias)','Aliases (comma-separated)'),s.aliases||'','text',tr('مثال: MyBrand, My Brand','Example: MyBrand, My Brand'))" + "\n" +
" " + "f('s-keywords',tr('كلمات مفتاحية (Keywords)','Keywords (comma-separated)'),s.keywords||'','text',tr('مثال: fashion, abaya, dress','Example: fashion, abaya, dress'))" + "\n" +
" " + "f('s-official-phones',tr('أرقام هواتف رسمية','Official Phone Numbers (one per line)'),s.officialPhones||'','text','','ltr')" + "\n" +
" <label for=\"s-allowlist\">${tr('قائمة السماح (Allowlist)','Allowlist — allowed domains/handles/phones (one per line)')}</label>\n" +
" <textarea id=\"s-allowlist\" class=\"ltr\" " + "${ro}" + ">${esc(s.allowlistText||'')}</textarea>\n" +
" <p class=\"hint\">${tr('النطاقات/الحسابات في هذه القائمة لن تُولّد تنبيهات (override صارم).','Domains/handles in this list will NEVER generate alerts (hard override).')}</p>\n" +
" <div style=\"height:12px\"></div>\n" +
" <h4 style=\"margin:0 0 6px;font-size:14px\">${tr('قنوات التنبيه (Alert Channels)','Alert Channels (Telegram / Email)')}</h4>\n" +
" " + "f('s-tg-token',tr('رمز بوت تيليجرام','Telegram Bot Token'),s.tgToken||'','password',tr('من @BotFather','From @BotFather'),'ltr')" + "\n" +
" " + "f('s-tg-chat',tr('معرّف دردشة تيليجرام','Telegram Chat ID'),s.tgChat||'','text',tr('من @userinfobot','From @userinfobot'),'ltr')" + "\n" +
" " + "f('s-alert-email',tr('بريد التنبيهات','Alert Email Address'),s.alertEmail||'','email')" + "\n" +
" <div style=\"height:12px\"></div>\n" +
" " + "${isOwner()?`<button class=\"btn primary block\" data-act=\"saveBrandProfile\">${tr('حفظ ملف العلامة','Save Brand Profile')}</button>`:''}" + "\n" +
" </div>\n";

// Insert brand profile panel before cloud sync panel
const cloudPanelAnchor = " <div class=\"panel\"><h3>${tr('المزامنة السحابية";
const cloudIdx = t.indexOf(cloudPanelAnchor);
if (cloudIdx < 0) throw new Error('Cloud panel anchor not found');
t = t.slice(0, cloudIdx) + brandProfilePanel + t.slice(cloudIdx);

// 8. Add Phase 1 actions to actions object
t = mustReplace(
  t,
  " noop(){},",
  " noop(){},\n" +
  " async runDomainDetector(){\n" +
  "  const cfg=Cloud.getConfig();\n" +
  "  if(!cfg||!state.authUser){toast(tr('يتطلب اتصال Supabase ومصادقة','Requires Supabase connection and authentication'));return}\n" +
  "  if(!state.activeWorkspaceId||!state.activeBrandId){toast(tr('اختر مساحة العمل والعلامة أولاً','Select workspace and brand first'));return}\n" +
  "  toast(tr('جاري تشغيل كاشف النطاقات...','Running domain detector...'));\n" +
  "  try{\n" +
  "   const s=await Auth.getSession();\n" +
  "   const r=await fetch(cfg.url+'/functions/v1/detect-domains',{method:'POST',headers:Auth.authHeaders(cfg,s),body:JSON.stringify({workspace_id:state.activeWorkspaceId,brand_id:state.activeBrandId})});\n" +
  "   const j=await r.json();\n" +
  "   if(!r.ok)throw new Error(j.error||'Failed');\n" +
  "   toast(tr('اكتمل الفحص: '+j.registered+' نطاق مسجّل، '+j.candidates+' مرشح جديد','Scan complete: '+j.registered+' registered, '+j.candidates+' new candidates'));\n" +
  "   renderDetectorRuns();\n" +
  "  }catch(e){toast(tr('تعذّر تشغيل الكاشف: ','Could not run detector: ')+String(e&&e.message||e))}\n" +
  " },\n" +
  " confirmCandidate(el){\n" +
  "  const c=state.cases.find(x=>x.id===el.dataset.id);if(!c)return;\n" +
  "  c.candidateStatus='confirmed';c.status='found';\n" +
  "  DB.put('cases',c);toast(tr('تم تأكيد المرشح — تم إنشاء حالة','Candidate confirmed — case created'));renderCandidateList();\n" +
  " },\n" +
  " dismissCandidate(el){\n" +
  "  const c=state.cases.find(x=>x.id===el.dataset.id);if(!c)return;\n" +
  "  const reason=prompt(tr('سبب الرفض (fan page / reseller / unrelated / duplicate):','Dismissal reason (fan page / reseller / unrelated / duplicate):'));\n" +
  "  if(reason===null)return;\n" +
  "  c.candidateStatus='dismissed';c.dismissedReason=reason;\n" +
  "  DB.put('cases',c);toast(tr('تم رفض المرشح','Candidate dismissed'));renderCandidateList();\n" +
  " },\n" +
  " allowlistCandidate(el){\n" +
  "  const c=state.cases.find(x=>x.id===el.dataset.id);if(!c)return;\n" +
  "  c.candidateStatus='allowlisted';\n" +
  "  DB.put('cases',c);toast(tr('تمت إضافة المرشح إلى قائمة السماح','Candidate allowlisted'));renderCandidateList();\n" +
  " },\n" +
  " async saveBrandProfile(){\n" +
  "  if(!isOwner())return;\n" +
  "  const g=id=>$(id)?$(id).value.trim():'';\n" +
  "  const aliases=g('s-aliases').split(/[,،]/).map(x=>x.trim()).filter(Boolean);\n" +
  "  const keywords=g('s-keywords').split(/[,،]/).map(x=>x.trim()).filter(Boolean);\n" +
  "  const officialPhones=g('s-official-phones').split('\\n').map(x=>x.trim()).filter(Boolean);\n" +
  "  const allowlistText=g('s-allowlist');\n" +
  "  const allowlist=allowlistText.split('\\n').map(x=>x.trim()).filter(Boolean).map(x=>({domain:x}));\n" +
  "  const profile={aliases,keywords,officialPhones,allowlist,allowlistText,tgToken:g('s-tg-token'),tgChat:g('s-tg-chat'),alertEmail:g('s-alert-email')};\n" +
  "  state.settings=Object.assign(state.settings,profile);\n" +
  "  await DB.put('settings',{key:'main',value:state.settings});\n" +
  "  const cfg=Cloud.getConfig();\n" +
  "  if(cfg&&state.activeBrandId){\n" +
  "   const s=await Auth.getSession();\n" +
  "   if(s){\n" +
  "    await fetch(cfg.url+'/rest/v1/brands?id=eq.'+encodeURIComponent(state.activeBrandId),{method:'PATCH',headers:Auth.authHeaders(cfg,s),body:JSON.stringify({aliases,keywords,official_phones:officialPhones,allowlist})});\n" +
  "   }\n" +
  "  }\n" +
  "  toast(tr('تم حفظ ملف العلامة','Brand profile saved'));\n" +
  " },\n",
  'Phase1 actions'
);

// 9. Update saveSettings to include new brand profile fields
t = mustReplace(
  t,
  "   brand:g('s-brand'),handles:g('s-handles'),domain:g('s-domain'),official:g('s-official'),\n   images:g('s-images'),tm:g('s-tm'),license:g('s-license'),owner:g('s-owner'),\n   email:g('s-email'),phone:g('s-phone'),pin:g('s-pin'),\n   remind:Math.max(1,parseInt(g('s-remind'))||7),updatedAt:Date.now()",
  "   brand:g('s-brand'),handles:g('s-handles'),domain:g('s-domain'),official:g('s-official'),\n   images:g('s-images'),tm:g('s-tm'),license:g('s-license'),owner:g('s-owner'),\n   email:g('s-email'),phone:g('s-phone'),pin:g('s-pin'),\n   remind:Math.max(1,parseInt(g('s-remind'))||7),updatedAt:Date.now(),\n   aliases:state.settings.aliases||[],keywords:state.settings.keywords||[],\n   officialPhones:state.settings.officialPhones||[],allowlistText:state.settings.allowlistText||'',\n   tgToken:state.settings.tgToken||'',tgChat:state.settings.tgChat||'',alertEmail:state.settings.alertEmail||''",
  'Phase1 saveSettings update'
);

// 10. Update reload() to restore brand profile fields
t = mustReplace(
  t,
  " if(s)state.settings=Object.assign({remind:7},s.value);",
  " if(s)state.settings=Object.assign({remind:7,aliases:[],keywords:[],officialPhones:[],allowlistText:'',tgToken:'',tgChat:'',alertEmail:''},s.value);",
  'Phase1 reload update'
);

// 11. Update state.settings default to include new fields
t = mustReplace(
  t,
  " settings:{remind:7,brand:'',handles:'',domain:'',official:'',images:'',tm:'',license:'',owner:'',email:'',phone:'',pin:''},",
  " settings:{remind:7,brand:'',handles:'',domain:'',official:'',images:'',tm:'',license:'',owner:'',email:'',phone:'',pin:'',aliases:[],keywords:[],officialPhones:[],allowlistText:'',tgToken:'',tgChat:'',alertEmail:''},",
  'Phase1 state settings default'
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
console.log('PHASE 1 IMPLEMENTATION PATCHED AND SYNTAX VERIFIED!');
process.exit(0);
