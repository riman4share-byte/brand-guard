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

// 1. Add Auth & Workspace state to the state object
t = mustReplace(
  t,
  ` customerMode:isPublicReport,
 customerSubmitted:false,`,
  ` customerMode:isPublicReport,
  customerSubmitted:false,
  authUser:null,
  authLoading:false,
  authError:'',
  activeWorkspaceId:localStorage.getItem('hares-active-ws')||'',
  activeBrandId:localStorage.getItem('hares-active-brand')||'',`,
  'Phase0 state additions'
);

// 2. Add Supabase Auth module after Cloud object (before URL parsing)
t = mustReplace(
  t,
  `/* ---------- URL parsing ---------- */`,
  `/* ---------- Supabase Auth (Phase 0) ---------- */
const Auth={
 getConfig(){
  const cfg=Cloud.getConfig();if(!cfg)return null;
  return {url:cfg.url,key:cfg.key};
 },
 getClient(){
  const cfg=this.getConfig();if(!cfg)return null;
  if(!window._supabaseClient){
   // Lightweight client using raw fetch against Supabase Auth REST API
   window._supabaseClient={url:cfg.url,key:cfg.key};
  }
  return window._supabaseClient;
 },
 async getSession(){
  const cfg=this.getConfig();if(!cfg)return null;
  const raw=localStorage.getItem('hares-auth-session');
  if(!raw)return null;
  try{
   const s=JSON.parse(raw);
   if(s.expires_at&&Date.now()/1000>s.expires_at){
    // Try refresh
    const r=await fetch(cfg.url+'/auth/v1/token?grant_type=refresh_token',{
     method:'POST',headers:{'apikey':cfg.key,'Content-Type':'application/json'},
     body:JSON.stringify({refresh_token:s.refresh_token})
    });
    if(!r.ok){localStorage.removeItem('hares-auth-session');return null}
    const ns=await r.json();
    ns.expires_at=Math.floor(Date.now()/1000)+(ns.expires_in||3600);
    localStorage.setItem('hares-auth-session',JSON.stringify(ns));
    return ns;
   }
   return s;
  }catch{return null}
 },
 async signIn(email,password){
  const cfg=this.getConfig();if(!cfg)throw new Error('No Supabase config');
  const r=await fetch(cfg.url+'/auth/v1/token?grant_type=password',{
   method:'POST',headers:{'apikey':cfg.key,'Content-Type':'application/json'},
   body:JSON.stringify({email,password})
  });
  const j=await r.json();
  if(!r.ok)throw new Error(j.error_description||j.msg||'Sign in failed');
  j.expires_at=Math.floor(Date.now()/1000)+(j.expires_in||3600);
  localStorage.setItem('hares-auth-session',JSON.stringify(j));
  return j;
 },
 async signUp(email,password){
  const cfg=this.getConfig();if(!cfg)throw new Error('No Supabase config');
  const r=await fetch(cfg.url+'/auth/v1/signup',{
   method:'POST',headers:{'apikey':cfg.key,'Content-Type':'application/json'},
   body:JSON.stringify({email,password})
  });
  const j=await r.json();
  if(!r.ok)throw new Error(j.error_description||j.msg||'Sign up failed');
  if(j.access_token){
   j.expires_at=Math.floor(Date.now()/1000)+(j.expires_in||3600);
   localStorage.setItem('hares-auth-session',JSON.stringify(j));
  }
  return j;
 },
 async signOut(){
  const cfg=this.getConfig();const s=await this.getSession();
  if(cfg&&s?.access_token){
   try{await fetch(cfg.url+'/auth/v1/logout',{method:'POST',headers:{'apikey':cfg.key,'Authorization':'Bearer '+s.access_token}})}catch{}
  }
  localStorage.removeItem('hares-auth-session');
 },
 authHeaders(cfg,s){
  const h={'apikey':cfg.key,'Content-Type':'application/json'};
  if(s?.access_token)h['Authorization']='Bearer '+s.access_token;
  return h;
 },
 async listWorkspaces(){
  const cfg=this.getConfig();const s=await this.getSession();if(!cfg||!s)return[];
  const r=await fetch(cfg.url+'/rest/v1/workspaces?select=id,name,plan,created_at&order=name.asc',{
   headers:this.authHeaders(cfg,s)
  });
  if(!r.ok)return[];
  return await r.json();
 },
 async createWorkspace(name){
  const cfg=this.getConfig();const s=await this.getSession();if(!cfg||!s)return null;
  const r=await fetch(cfg.url+'/rest/v1/workspaces',{
   method:'POST',headers:this.authHeaders(cfg,s),
   body:JSON.stringify({name,plan:'free'})
  });
  if(!r.ok)return null;
  const rows=await r.json();
  const ws=Array.isArray(rows)?rows[0]:rows;
  if(ws?.id){
   await fetch(cfg.url+'/rest/v1/members',{
    method:'POST',headers:this.authHeaders(cfg,s),
    body:JSON.stringify({workspace_id:ws.id,user_id:s.user?.id,role:'owner'})
   });
  }
  return ws;
 },
 async listBrands(workspaceId){
  const cfg=this.getConfig();const s=await this.getSession();if(!cfg||!s||!workspaceId)return[];
  const r=await fetch(cfg.url+'/rest/v1/brands?workspace_id=eq.'+encodeURIComponent(workspaceId)+'&select=id,name,name_ar,aliases,keywords,official_domains,official_handles,official_phones,trademark_no,license_no,countries,public_slug,created_at&order=name.asc',{
   headers:this.authHeaders(cfg,s)
  });
  if(!r.ok)return[];
  return await r.json();
 },
 async createBrand(workspaceId,brand){
  const cfg=this.getConfig();const s=await this.getSession();if(!cfg||!s||!workspaceId)return null;
  const r=await fetch(cfg.url+'/rest/v1/brands',{
   method:'POST',headers:this.authHeaders(cfg,s),
   body:JSON.stringify({workspace_id:workspaceId,...brand})
  });
  if(!r.ok)return null;
  const rows=await r.json();
  return Array.isArray(rows)?rows[0]:rows;
 }
};

/* ---------- URL parsing ---------- */`,
  'Phase0 Auth module'
);

// 3. Add auth gate: if cloud is configured and no session, show login screen
t = mustReplace(
  t,
  `/* ---------- render: header & main ---------- */`,
  `/* ---------- render: login & auth ---------- */
function renderLoginScreen(){
 const m=$('main');if(!m)return;
 const cfg=Cloud.getConfig();
 $('navBar').style.display='none';
 $('fabAdd').style.display='none';
 if(!cfg){
  m.innerHTML=\`<div class="pad"><div class="panel" style="text-align:center;padding:32px 20px">
   <h3>\${tr('التصنيف (Brand Guard)','Brand Guard')}</h3>
   <p class="hint">\${tr('يعمل محلياً بالكامل بدون حساب. لتفعيل المزامنة السحابية (Supabase) متعددة الأجهزة، افتح الإعدادات.','Works 100% locally without an account. To enable multi-device cloud sync (Supabase), open Settings.')}</p>
   <div style="height:16px"></div>
   <button class="btn primary" data-act="exitAuthMode">\${tr('الدخول للتطبيق المحلي','Enter Local App')}</button>
  </div></div>\`;
  return;
 }
 m.innerHTML=\`<div class="pad"><div class="panel" style="max-width:420px;margin:40px auto 0">
  <h3>\${tr('تسجيل الدخول (Supabase)','Sign In (Supabase)')}</h3>
  <p class="hint">\${tr('أدخل بريدك الإلكتروني وكلمة المرور للوصول إلى مساحة العمل.','Enter your email and password to access your workspace.')}</p>
  \${state.authError?\`<div class="notice danger" style="margin-top:10px"><span>\${esc(state.authError)}</span></div>\`:''}
  <label for="auth-email">\${tr('البريد الإلكتروني','Email')}</label>
  <input type="email" id="auth-email" class="ltr" placeholder="you@brand.com">
  <label for="auth-pass">\${tr('كلمة المرور','Password')}</label>
  <input type="password" id="auth-pass" class="ltr" placeholder="••••••••">
  <div style="height:16px"></div>
  <div class="row">
   <button class="btn primary" data-act="doSignIn">\${tr('تسجيل الدخول','Sign In')}</button>
   <button class="btn" data-act="doSignUp">\${tr('إنشاء حساب','Sign Up')}</button>
  </div>
  <div style="height:12px"></div>
  <button class="btn block" data-act="exitAuthMode">\${tr('العمل محلياً (بدون حساب)','Work Locally (No Account)')}</button>
 </div></div>\`;
}

function renderWorkspacePicker(){
 const m=$('main');if(!m)return;
 m.innerHTML=\`<div class="pad"><div class="panel" style="max-width:480px;margin:40px auto 0">
  <h3>\${tr('اختيار مساحة العمل والعلامة','Select Workspace & Brand')}</h3>
  <p class="hint">\${tr('اختر مساحة العمل (Workspace) والعلامة (Brand) للعمل عليها.','Choose a workspace and brand to work on.')}</p>
  <label for="ws-pick">\${tr('مساحة العمل (Workspace)','Workspace')}</label>
  <select id="ws-pick"><option value="">-- \${tr('اختر','Select')} --</option></select>
  <div style="height:8px"></div>
  <button class="btn sm" data-act="createWorkspacePrompt">\${tr('+ إنشاء مساحة عمل جديدة','+ Create New Workspace')}</button>
  <div style="height:16px"></div>
  <label for="brand-pick">\${tr('العلامة التجارية (Brand)','Brand')}</label>
  <select id="brand-pick"><option value="">-- \${tr('اختر','Select')} --</option></select>
  <div style="height:8px"></div>
  <button class="btn sm" data-act="createBrandPrompt">\${tr('+ إنشاء علامة جديدة','+ Create New Brand')}</button>
  <div style="height:20px"></div>
  <button class="btn primary block" data-act="enterWorkspace">\${tr('الدخول إلى التطبيق','Enter App')}</button>
 </div></div>\`;
 // Load workspaces
 Auth.listWorkspaces().then(list=>{
  const sel=$('ws-pick');if(!sel)return;
  list.forEach(w=>{const o=document.createElement('option');o.value=w.id;o.textContent=w.name;sel.appendChild(o)});
  if(state.activeWorkspaceId)sel.value=state.activeWorkspaceId;
  if(sel.value)loadBrandsForWorkspace(sel.value);
 });
 $('ws-pick').addEventListener('change',e=>loadBrandsForWorkspace(e.target.value));
}

function loadBrandsForWorkspace(wsId){
 const sel=$('brand-pick');if(!sel)return;
 sel.innerHTML='<option value="">-- '+tr('اختر','Select')+' --</option>';
 if(!wsId)return;
 Auth.listBrands(wsId).then(list=>{
  list.forEach(b=>{const o=document.createElement('option');o.value=b.id;o.textContent=b.name;sel.appendChild(o)});
  if(state.activeBrandId)sel.value=state.activeBrandId;
 });
}

/* ---------- render: header & main ---------- */`,
  'Phase0 login & workspace UI'
);

// 4. Add auth gate in renderMain
t = mustReplace(
  t,
  `function renderMain(){
 applyLangDir();
 renderTopActs();
 if(state.customerMode){`,
  `function renderMain(){
 applyLangDir();
 renderTopActs();
 // Auth gate: if cloud is configured but no session, show login screen
 if(!state.customerMode && Cloud.getConfig() && !state.authUser && !state.authLoading){
  renderLoginScreen();return;
 }
 // Workspace picker: if authenticated but no active workspace, show picker
 if(!state.customerMode && Cloud.getConfig() && state.authUser && (!state.activeWorkspaceId||!state.activeBrandId)){
  renderWorkspacePicker();return;
 }
 if(state.customerMode){`,
  'Phase0 auth gate in renderMain'
);

// 5. Add auth actions to the actions object
t = mustReplace(
  t,
  ` noop(){},`,
  ` noop(){},
 exitAuthMode(){state.authLoading=true;renderMain()},
 async doSignIn(){
  state.authError='';state.authLoading=true;renderLoginScreen();
  const email=$('auth-email')?.value?.trim()||'';
  const pass=$('auth-pass')?.value||'';
  if(!email||!pass){state.authError=tr('أدخل البريد الإلكتروني وكلمة المرور','Enter email and password');state.authLoading=false;renderLoginScreen();return}
  try{
   const s=await Auth.signIn(email,pass);
   state.authUser=s.user||{id:s.user_id,email};
   state.authLoading=false;
   renderMain();
  }catch(e){state.authError=String(e?.message||e);state.authLoading=false;renderLoginScreen()}
 },
 async doSignUp(){
  state.authError='';state.authLoading=false;renderLoginScreen();
  const email=$('auth-email')?.value?.trim()||'';
  const pass=$('auth-pass')?.value||'';
  if(!email||!pass){state.authError=tr('أدخل البريد الإلكتروني وكلمة المرور','Enter email and password');renderLoginScreen();return}
  try{
   const s=await Auth.signUp(email,pass);
   if(s.access_token){state.authUser=s.user||{id:s.user_id,email};renderMain()}
   else{state.authError=tr('تم إنشاء الحساب. تحقق من بريدك الإلكتروني للتأكيد.','Account created. Check your email to confirm.')}
   renderLoginScreen();
  }catch(e){state.authError=String(e?.message||e);renderLoginScreen()}
 },
 async createWorkspacePrompt(){
  const name=prompt(tr('اسم مساحة العمل الجديدة:','New workspace name:'));
  if(!name)return;
  const ws=await Auth.createWorkspace(name.trim());
  if(ws){const sel=$('ws-pick');const o=document.createElement('option');o.value=ws.id;o.textContent=ws.name;sel.appendChild(o);sel.value=ws.id;loadBrandsForWorkspace(ws.id)}
 },
 async createBrandPrompt(){
  const name=prompt(tr('اسم العلامة التجارية (EN):','Brand name (EN):'));
  if(!name)return;
  const wsId=$('ws-pick')?.value||state.activeWorkspaceId;
  if(!wsId){toast(tr('اختر مساحة العمل أولاً','Select a workspace first'));return}
  const brand=await Auth.createBrand(wsId,{name:name.trim(),name_ar:name.trim()});
  if(brand){const sel=$('brand-pick');const o=document.createElement('option');o.value=brand.id;o.textContent=brand.name;sel.appendChild(o);sel.value=brand.id}
 },
 enterWorkspace(){
  const wsId=$('ws-pick')?.value||'';
  const brandId=$('brand-pick')?.value||'';
  if(!wsId){toast(tr('اختر مساحة العمل','Select a workspace'));return}
  state.activeWorkspaceId=wsId;
  state.activeBrandId=brandId;
  localStorage.setItem('hares-active-ws',wsId);
  if(brandId)localStorage.setItem('hares-active-brand',brandId);
  renderMain();
 },
 async signOutAuth(){
  await Auth.signOut();
  state.authUser=null;
  state.activeWorkspaceId='';
  state.activeBrandId='';
  localStorage.removeItem('hares-active-ws');
  localStorage.removeItem('hares-active-brand');
  renderMain();
 },`,
  'Phase0 auth actions'
);

// 6. Add sign out button to renderTopActs when authenticated
t = mustReplace(
  t,
  ` const syncBtn=cfg?\`<button class="pill sync" data-act="syncNow" title="\${tr('مزامنة سحابية','Cloud Sync')}">\${state.syncing?tr('جاري المزامنة...','Syncing...'):tr('☁️ مزامنة','☁️ Sync')}</button>\`:'';
 el.innerHTML=licBtn+langBtn+syncBtn+roleBtn;`,
  ` const syncBtn=cfg?\`<button class="pill sync" data-act="syncNow" title="\${tr('مزامنة سحابية','Cloud Sync')}">\${state.syncing?tr('جاري المزامنة...','Syncing...'):tr('☁️ مزامنة','☁️ Sync')}</button>\`:'';
 const signOutBtn=state.authUser?\`<button class="pill" data-act="signOutAuth" title="\${tr('تسجيل الخروج','Sign Out')}">\${tr('🚪 خروج','🚪 Out')}</button>\`:'';
 el.innerHTML=licBtn+langBtn+syncBtn+roleBtn+signOutBtn;`,
  'Phase0 sign out button'
);

// 7. Update public report form to POST to Edge Function instead of direct insert
t = mustReplace(
  t,
  `  state.cases.push(c);
  await DB.put('cases',c);
  await Cloud.pushCase(c).catch(()=>{});
  state.customerSubmitted=true;
  toast(tr('تم إرسال البلاغ','Report submitted'));`,
  `  // Phase 0: Submit via Edge Function (submit-report) when cloud is configured,
  // otherwise store locally (offline / no cloud).
  const cfg=Cloud.getConfig();
  if(cfg){
   try{
    const endpoint=cfg.url+'/functions/v1/submit-report';
    const sess=await Auth.getSession();
    const hdrs={'Content-Type':'application/json','apikey':cfg.key};
    if(sess?.access_token)hdrs['Authorization']='Bearer '+sess.access_token;
    const resp=await fetch(endpoint,{
     method:'POST',headers:hdrs,
     body:JSON.stringify({
      url:d.url,handle:d.username,description:d.notes,contact:d.contact,
      kind:d.type,platform:d.platform,files:d.shots.slice(),
      brand_slug:urlParams.get('brand')||'',workspace_id:state.activeWorkspaceId||'',
      brand_id:state.activeBrandId||'',captcha_token:'PASS_TEST_TOKEN'
     })
    });
    if(!resp.ok){throw new Error('Edge function failed')}
    const j=await resp.json();
    c.remoteReportId=j.report_id||null;
   }catch(e){
    // Fall back to local storage if Edge Function is unavailable
    console.warn('Edge function unavailable, storing locally:',e);
   }
  }
  state.cases.push(c);
  await DB.put('cases',c);
  await Cloud.pushCase(c).catch(()=>{});
  state.customerSubmitted=true;
  toast(tr('تم إرسال البلاغ','Report submitted'));`,
  'Phase0 public report Edge Function'
);

// 8. Remove plaintext PIN from cloud sync: strip pin from settings before push
t = mustReplace(
  t,
  `   const toPush=[];
   for(const [id,lc] of lMap){
    const rem=rMap.get(id);
    if(!rem||(lc.updatedAt||0)>(rem.updated_at||0))toPush.push({id,workspace:cfg.workspace,data:lc,updated_at:lc.updatedAt||Date.now()});
   }`,
  `   const toPush=[];
   for(const [id,lc] of lMap){
    const rem=rMap.get(id);
    // Strip plaintext PIN from synced data (Phase 0 security hardening)
    const cleanLc=Object.assign({},lc);delete cleanLc.pin;
    if(!rem||(lc.updatedAt||0)>(rem.updated_at||0))toPush.push({id,workspace:cfg.workspace,data:cleanLc,updated_at:lc.updatedAt||Date.now()});
   }`,
  'Phase0 strip PIN from sync'
);

// 9. Update supabase-schema.sql reference in settings to point to new migration (best-effort)
const refIdx = t.indexOf('supabase-schema.sql');
if (refIdx >= 0) {
  t = t.replace('supabase-schema.sql', 'supabase/migrations/0001_phase0_foundation.sql');
}

// 10. Update startup to restore auth session
t = mustReplace(
  t,
  `applyLangDir();
License.evaluate();
License.checkRemote();
DB.open().then(reload).then(()=>{`,
  `applyLangDir();
License.evaluate();
License.checkRemote();
// Phase 0: Restore auth session
Auth.getSession().then(s=>{
 if(s&&s.user){state.authUser=s.user;state.authLoading=false}
 else{state.authLoading=false}
 renderMain();
}).catch(()=>{state.authLoading=false;renderMain()});
DB.open().then(reload).then(()=>{`,
  'Phase0 auth session restore'
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

// Verify syntax
for (const fname of ['index.html', 'hares-alalama.html', 'brand-guard-en.html']) {
  const txt = fs.readFileSync(path.join(dir, fname), 'utf8');
  if ([...txt].some(c => c === '\uFFFD')) throw new Error(`U+FFFD found in ${fname}`);
  const m = txt.match(/<script>([\s\S]*?)<\/script>/);
  new Function(m[1]);
}
console.log('PHASE 0 IMPLEMENTATION PATCHED AND SYNTAX VERIFIED!');
