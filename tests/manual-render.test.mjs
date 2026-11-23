import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/KAIS/OmniRoute/node_modules/playwright');
const root = path.resolve(import.meta.dirname, '..');

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
]);

const server = http.createServer((request, response) => {
  const requestPath = new URL(request.url || '/', 'http://127.0.0.1').pathname;
  const filePath = path.resolve(root, requestPath === '/' ? 'client-manual.html' : decodeURIComponent(requestPath).replace(/^\/+/, ''));
  if (!filePath.startsWith(root + path.sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(data);
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const pageErrors = [];

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.goto(`${baseUrl}/client-manual.html`, { waitUntil: 'load' });

  assert.equal(await page.locator('section.sec').count(), 30, 'Rendered manual must contain 30 sections');

  const brokenImages = await page.evaluate(() => [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.getAttribute('src')));
  assert.deepEqual(brokenImages, [], 'All manual images must load');

  await page.evaluate(() => setView('ar'));
  assert.equal(await page.locator('#block-ar').isVisible(), true, 'Arabic block should be visible in Arabic mode');
  assert.equal(await page.locator('#block-en').isVisible(), false, 'English block should be hidden in Arabic mode');

  await page.evaluate(() => setView('en'));
  assert.equal(await page.locator('#block-ar').isVisible(), false, 'Arabic block should be hidden in English mode');
  assert.equal(await page.locator('#block-en').isVisible(), true, 'English block should be visible in English mode');

  await page.evaluate(() => setView('both'));
  assert.equal(await page.locator('#block-ar').isVisible(), true, 'Arabic block should be visible in both mode');
  assert.equal(await page.locator('#block-en').isVisible(), true, 'English block should be visible in both mode');

  for (const target of ['ar-12', 'ar-15', 'en-10', 'en-12', 'en-15']) {
    await page.evaluate((id) => {
      setView(id.startsWith('ar') ? 'ar' : 'en');
      document.getElementById(id).scrollIntoView();
    }, target);
    assert.equal(await page.locator(`#${target}`).isVisible(), true, `Section should be reachable: ${target}`);
  }

  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.top-nav').isVisible(), false, 'Top navigation should be hidden in print media');
  await page.emulateMedia({ media: 'screen' });

  assert.deepEqual(pageErrors, [], 'Manual should not produce page errors');
  console.log('Manual render checks passed.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
