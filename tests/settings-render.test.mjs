import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/KAIS/OmniRoute/node_modules/playwright');
const root = path.resolve(import.meta.dirname, '..');

const server = http.createServer((request, response) => {
  const requestPath = new URL(request.url || '/', 'http://127.0.0.1').pathname;
  const filePath = path.resolve(root, requestPath === '/' ? 'index.html' : decodeURIComponent(requestPath).replace(/^\/+/, ''));
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': filePath.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    response.end(data);
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 512, height: 806 } });
  await page.goto(`${baseUrl}/index.html?lang=ar`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#t-settings');
  await page.locator('#t-settings').click();
  await page.waitForSelector('#s-brand');

  for (const id of ['s-aliases', 's-keywords', 's-official-phones', 's-tg-token', 's-tg-chat', 's-alert-email']) {
    assert.equal(await page.locator(`#${id}`).count(), 1, `Settings field is not rendered: #${id}`);
  }

  const settingsText = await page.locator('#main').innerText();
  assert.equal(settingsText.includes("f('s-"), false, 'Settings renders a literal template-helper call instead of form fields');
  console.log('Settings render checks passed.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
