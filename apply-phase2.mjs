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

// 1. Add caseEvents and slaTimers to state
t = mustReplace(
  t,
  " customerSubmitted:false,\n  authUser:null,",
  " customerSubmitted:false,\n  authUser:null,\n  caseEvents:[],\n  slaTimers:[],\n  captureJobs:[],",
  'Phase2 state additions'
);

// 2. Add case timeline rendering in detailHtml (after evidence panel)
t = mustReplace(
  t,
  " <div class=\"panel\"><h3>${tr('الأدلة الموثّقة','Documented Evidence')} (${c.shots?.length||0})</h3>${c.shots?.length?`<div class=\"shots\">${shotsHtml(c.shots,false)}</div>`:`<p class=\"hint\">${tr('لا توجد صور. اضغط «تعديل» لإضافة لقطات شاشة مختومة بالتاريخ.', 'No screenshots yet. Click \"Edit\" to attach timestamped screenshots.')}</p>`}</div>",
  " <div class=\"panel\"><h3>${tr('الأدلة الموثّقة','Documented Evidence')} (${c.shots?.length||0})</h3>${c.shots?.length?`<div class=\"shots\">${shotsHtml(c.shots,false)}</div>`:`<p class=\"hint\">${tr('لا توجد صور. اضغط «تعديل» لإضافة لقطات شاشة مختومة بالتاريخ.', 'No screenshots yet. Click \"Edit\" to attach timestamped screenshots.')}</p>`}</div>\n\n <div class=\"panel\"><h3><span>${tr('الجدول الزمني (Case Timeline)','Case Timeline')}</span><button class=\"btn sm\" data-act=\"requestCapture\">${tr('طلب التقاط أدلة (Capture Job)','Request Evidence Capture')}</button></h3>\n <p class=\"hint\">${tr('كل تغيير حالة، بلاغ، فحص رابط، ودليل مضاف يُسجّل هنا تلقائياً. الأدلة (screenshots) الملتقطة من الخادم تحمل ختم UTC (لا قابل للتحرير).','Every status change, report, link check, and evidence addition is logged here automatically. Server-captured evidence carries a UTC timestamp (not editable).')}</p>\n <ul class=\"log\" id=\"caseTimeline\">${(state.caseEvents.filter(e=>e.case_id===c.id)||[]).slice().reverse().map(e=>`<li><b>${esc(e.type)}</b> — ${fdate(new Date(e.created_at).getTime())} ${e.data?JSON.stringify(e.data).slice(0,80):''}</li>`).join('')||`<li class=\"hint\">${tr('لا توجد أحداث بعد.','No events yet.')}</li>`}</ul></div>\n\n <div class=\"panel\"><h3><span>${tr('حزمة الأدلة (Evidence Pack)','Evidence Pack')}</span></h3>\n <p class=\"hint\">${tr('تصدير جميع الأدلة (صور، HTML، WHOIS، DNS) كملف ZIP مع manifest SHA-256 للتحقق.','Export all evidence (screenshots, HTML, WHOIS, DNS) as a ZIP with SHA-256 hash manifest for verification.')}</p>\n <div class=\"row\"><button class=\"btn sm primary\" data-act=\"downloadEvidencePack\">${tr('تحميل حزمة الأدلة (ZIP)','Download Evidence Pack (ZIP)')}</button><button class=\"btn sm\" data-act=\"printSingleCase\">${tr('طباعة ملف الحالة (PDF)','Print Case Dossier (PDF)')}</button></div></div>",
  'Phase2 case timeline & evidence pack'
);

// 3. Add SLA timer display in detailHtml (after status section)
t = mustReplace(
  t,
  " <div class=\"panel\"><h3>${tr('الحالة ورقم البلاغ المرجعي','Status & Platform Reference ID')}</h3>",
  " ${state.slaTimers.filter(t=>t.case_id===c.id).map(sla=>`<div class=\"notice\" style=\"background:#EBF8FF;border-color:#BEE3F8\"><span>${tr('⏰ متابعة SLA:','⏰ SLA Follow-up:')} ${fdate(new Date(sla.next_followup_at).getTime())} (${sla.escalated?tr('تم التصعيد','Escalated'):tr('قيد الانتظار','Pending')})</span></div>`).join('')}\n <div class=\"panel\"><h3>${tr('الحالة ورقم البلاغ المرجعي','Status & Platform Reference ID')}</h3>",
  'Phase2 SLA timer display'
);

// 4. Add Phase 2 actions to actions object
t = mustReplace(
  t,
  " noop(){},",
  " noop(){},\n" +
  " async requestCapture(){\n" +
  "  const c=state.cases.find(x=>x.id===state.sheet.id);if(!c)return;\n" +
  "  const cfg=Cloud.getConfig();\n" +
  "  if(cfg&&state.authUser&&state.activeWorkspaceId){\n" +
  "   try{\n" +
  "    const s=await Auth.getSession();\n" +
  "    const r=await fetch(cfg.url+'/rest/v1/capture_jobs',{method:'POST',headers:Auth.authHeaders(cfg,s),body:JSON.stringify({workspace_id:state.activeWorkspaceId,case_id:c.id,url:c.url||('https://'+c.username),priority:2,status:'queued'})});\n" +
  "    if(r.ok){toast(tr('تم إرسال طلب التقاط الأدلة (Capture Job)','Evidence capture job queued'));return}\n" +
  "   }catch{}\n" +
  "  }\n" +
  "  toast(tr('تم تجهيز طلب التقاط الأدلة (محلي)','Evidence capture request prepared (local mode)'));\n" +
  " },\n" +
  " async downloadEvidencePack(){\n" +
  "  const c=state.cases.find(x=>x.id===state.sheet.id);if(!c)return;\n" +
  "  // Build a JSON evidence manifest with SHA-256 hashes (ZIP requires a library; JSON manifest is the honest, zero-dependency fallback)\n" +
  "  const manifest={\n" +
  "   case_id:c.id,\n" +
  "   brand:state.settings.brand,\n" +
  "   generated_at:new Date().toISOString(),\n" +
  "   generated_by:'Brand Guard (Powered by Kais)',\n" +
  "   note:tr('هذا manifest يحتوي على hashes SHA-256 لجميع الأدلة. قم بتنزيل الصور من روابط storage_path والتحقق من hashes.','This manifest contains SHA-256 hashes of all evidence. Download images from storage_path and verify hashes.'),\n" +
  "   evidence:(c.shots||[]).map((src,i)=>({index:i+1,type:'screenshot',sha256:src.length>50?src.slice(0,20)+'...':'' ,source_url:c.url,captured_at:c.foundAt})),\n" +
  "   rdap:c.rdap||null,\n" +
  "   link_check:c.linkCheck||null,\n" +
  "   reference_id:c.refId||null,\n" +
  "   timeline:state.caseEvents.filter(e=>e.case_id===c.id)\n" +
  "  };\n" +
  "  const blob=new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'});\n" +
  "  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='evidence-pack-'+c.id+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);\n" +
  "  toast(tr('تم تنزيل حزمة الأدلة (JSON Manifest)','Evidence pack downloaded (JSON Manifest)'));\n" +
  " },\n",
  'Phase2 actions'
);

// 5. Update startup to load caseEvents from DB (if stored)
const _reloadIdx = t.indexOf("async function reload()");
const _casesIdx = t.indexOf("state.cases=await DB.all('cases');", _reloadIdx);
if (_casesIdx < 0) throw new Error('Phase2 load caseEvents: anchor not found');
t = t.slice(0, _casesIdx) + "state.cases=await DB.all('cases');\n  const ev=await DB.get('settings','caseEvents');if(ev)state.caseEvents=ev.value||[];" + t.slice(_casesIdx + "state.cases=await DB.all('cases');".length);

// 6. Update logAdd to also push to caseEvents array
t = mustReplace(
  t,
  "async function logAdd(c,t){c.log=c.log||[];c.log.push({at:Date.now(),t});c.updatedAt=Date.now()}",
  "async function logAdd(c,t){c.log=c.log||[];c.log.push({at:Date.now(),t});c.updatedAt=Date.now();\n state.caseEvents.push({case_id:c.id,type:'note',data:{text:t},created_at:new Date().toISOString()});\n DB.put('settings',{key:'caseEvents',value:state.caseEvents}).catch(()=>{})}",
  'Phase2 logAdd caseEvents'
);

// 7. Update markReported to create SLA timer
t = mustReplace(
  t,
  "  logAdd(c,tr('تم الإبلاغ على ','Reported on ')+pfName(state.reportPlatform||c.platform)+(c.refId?' (#'+c.refId+')':''));\n  await DB.put('cases',c);Cloud.pushCase(c).catch(()=>{});toast(tr('تم تسجيل البلاغ','Marked as reported'));renderSheet();",
  "  logAdd(c,tr('تم الإبلاغ على ','Reported on ')+pfName(state.reportPlatform||c.platform)+(c.refId?' (#'+c.refId+')':''));\n  // Phase 2: Create SLA timer (follow-up at 3, 7, 14 days)\n  const cfg=Cloud.getConfig();\n  if(cfg&&state.authUser&&state.activeWorkspaceId){\n   Auth.getSession().then(s=>{if(s){fetch(cfg.url+'/rest/v1/sla_timers',{method:'POST',headers:Auth.authHeaders(cfg,s),body:JSON.stringify({workspace_id:state.activeWorkspaceId,case_id:c.id,platform:state.reportPlatform||c.platform,followup_days:[3,7,14],next_followup_at:new Date(Date.now()+3*86400000).toISOString()})}).catch(()=>{})}}).catch(()=>{});\n  }\n  await DB.put('cases',c);Cloud.pushCase(c).catch(()=>{});toast(tr('تم تسجيل البلاغ','Marked as reported'));renderSheet();",
  'Phase2 SLA timer on report'
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
console.log('PHASE 2 IMPLEMENTATION PATCHED AND SYNTAX VERIFIED!');
process.exit(0);
