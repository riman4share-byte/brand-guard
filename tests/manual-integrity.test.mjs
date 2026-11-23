import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const htmlPath = path.join(root, 'client-manual.html');
const markdownPath = path.join(root, 'CLIENT-MANUAL.md');
const html = fs.readFileSync(htmlPath, 'utf8');
const markdown = fs.readFileSync(markdownPath, 'utf8');

const count = (needle) => html.split(needle).length - 1;
const sectionIds = [...html.matchAll(/<section\s+class="sec"\s+id="([^"]+)"/g)].map((m) => m[1]);
const allIds = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

assert.equal(html.includes('\uFFFD'), false, 'Manual contains a Unicode replacement character');
assert.equal(sectionIds.length, 30, `Expected 30 manual sections, found ${sectionIds.length}`);
assert.equal(new Set(allIds).size, allIds.length, 'Manual contains duplicate HTML IDs');

for (const lang of ['ar', 'en']) {
  for (let number = 1; number <= 15; number += 1) {
    const id = `${lang}-${number}`;
    assert.equal(count(`id="${id}"`), 1, `Expected exactly one section target: ${id}`);
    assert.equal(sectionIds.includes(id), true, `Missing manual section: ${id}`);
  }
}

const tocTargets = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
for (const target of tocTargets) {
  assert.equal(allIds.includes(target), true, `Broken table-of-contents link: #${target}`);
}

const blockArStart = html.indexOf('<div id="block-ar"');
const dividerStart = html.indexOf('<!-- ==================== DIVIDER ==================== -->');
const blockEnStart = html.indexOf('<div id="block-en"');
const footerStart = html.indexOf('<div style="text-align:center;margin-top:40px');

assert.ok(blockArStart > 0, 'Arabic manual block is missing');
assert.ok(dividerStart > blockArStart, 'Language divider is missing or misplaced');
assert.ok(blockEnStart > dividerStart, 'English manual block is missing or misplaced');
assert.ok(footerStart > blockEnStart, 'Manual footer is missing or misplaced');

for (let number = 1; number <= 15; number += 1) {
  const ar = html.indexOf(`id="ar-${number}"`);
  const en = html.indexOf(`id="en-${number}"`);
  assert.ok(ar > blockArStart && ar < dividerStart, `Arabic section ${number} is outside the Arabic block`);
  assert.ok(en > blockEnStart && en < footerStart, `English section ${number} is outside the English block`);
}

for (const match of html.matchAll(/<img\s+[^>]*src="([^"]+)"/g)) {
  const src = match[1];
  if (/^(data:|https?:)/i.test(src)) continue;
  assert.equal(fs.existsSync(path.join(root, src)), true, `Missing manual image: ${src}`);
}

for (const screenshot of [
  'manual-screenshots/01-dashboard-ar.png',
  'manual-screenshots/02-dashboard-en.png',
  'manual-screenshots/08-scan-tab-ar.png',
  'manual-screenshots/12-suspected-inbox-ar.png',
  'manual-screenshots/12-suspected-inbox-en.png',
  'manual-screenshots/13-sweep-verify-ar.png',
  'manual-screenshots/13-sweep-verify-en.png',
  'manual-screenshots/13b-verify-page-ar.png',
  'manual-screenshots/14-analytics-ar.png',
  'manual-screenshots/14-analytics-en.png',
  'manual-screenshots/15-advanced-settings-ar.png',
  'manual-screenshots/15-advanced-settings-en.png',
  'manual-screenshots/15b-case-evidence-timeline-ar.png',
  'manual-screenshots/15b-case-evidence-timeline-en.png',
]) {
  assert.equal(fs.existsSync(path.join(root, screenshot)), true, `Missing current manual screenshot: ${screenshot}`);
}

for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  assert.doesNotThrow(() => new Function(match[1]), 'Inline script in the manual is invalid JavaScript');
}

for (const heading of [
  'تبويب «الرصد» (Suspected Inbox)',
  'تبويب «المسح» (Sweep)',
  'تبويب «التحليلات» (Analytics)',
  'الإعدادات المتقدمة',
  '"Suspected" Tab (Inbox)',
  '"Sweep" Tab',
  '"Analytics" Tab',
  'Advanced Settings: White-Label',
]) {
  assert.equal(html.includes(heading), true, `Missing manual content: ${heading}`);
  assert.equal(markdown.includes(heading), true, `Markdown manual is out of sync: ${heading}`);
}

console.log('Manual integrity checks passed.');
