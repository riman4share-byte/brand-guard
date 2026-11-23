import fs from 'node:fs';
import path from 'node:path';

const dir = process.cwd();
const t = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
fs.writeFileSync(path.join(dir, 'hares-alalama.html'), t, 'utf8');

const en = t
  .replace('<html lang="ar" dir="rtl">', '<html lang="en" dir="ltr">')
  .replace('<title>حارس العلامة — Brand Guard</title>', '<title>Brand Guard — حارس العلامة</title>')
  .replace(
    "const defaultLang=window.__HARES_DEFAULT_LANG__||urlParams.get('lang')||localStorage.getItem('hares-lang')||'ar';",
    "window.__HARES_DEFAULT_LANG__='en';\nconst defaultLang=urlParams.get('lang')||window.__HARES_DEFAULT_LANG__||'en';"
  );
fs.writeFileSync(path.join(dir, 'brand-guard-en.html'), en, 'utf8');

for (const fname of ['index.html', 'hares-alalama.html', 'brand-guard-en.html']) {
  const txt = fs.readFileSync(path.join(dir, fname), 'utf8');
  if ([...txt].some(c => c === '\uFFFD')) throw new Error(`U+FFFD found in ${fname}`);
  const m = txt.match(/<script>([\s\S]*?)<\/script>/);
  new Function(m[1]);
}
console.log('Synced & syntax verified: PASS');
process.exit(0);
