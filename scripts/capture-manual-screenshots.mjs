import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/KAIS/OmniRoute/node_modules/playwright');

const root = path.resolve(import.meta.dirname, '..');
const outputDir = path.join(root, 'manual-screenshots');
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const viewport = { width: 512, height: 806 };

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json'],
]);

function createStaticServer() {
  return http.createServer((request, response) => {
    const requestPath = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    const relativePath = requestPath === '/' ? 'index.html' : decodeURIComponent(requestPath).replace(/^\/+/, '');
    const filePath = path.resolve(root, relativePath);

    if (!filePath.startsWith(root + path.sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404).end('Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(data);
    });
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start screenshot server.');
  return `http://127.0.0.1:${address.port}`;
}

async function waitForApp(page) {
  await page.waitForSelector('#main');
  await page.waitForFunction(() => typeof state === 'object' && Array.isArray(state.cases));
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(250);
}

async function saveViewport(page, filename) {
  await page.evaluate(() => {
    const toast = document.getElementById('toast');
    if (toast) toast.style.display = 'none';
  });
  const destination = path.join(outputDir, filename);
  await page.screenshot({ path: destination, fullPage: false });
  console.log(`Saved ${path.relative(root, destination)}`);
}

async function toggleLanguage(page) {
  await page.evaluate(() => actions.toggleLang());
  await page.waitForTimeout(200);
}

async function scrollToText(page, text) {
  const target = page.getByText(text, { exact: true }).first();
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
}

async function scrollHeadingToTop(page, text) {
  await page.evaluate((headingText) => {
    const heading = [...document.querySelectorAll('h3')].find((element) => element.textContent.includes(headingText));
    heading?.scrollIntoView({ block: 'start' });
  }, text);
  await page.waitForTimeout(120);
}

async function seedDemo(page) {
  await page.goto(`${baseUrl}/index.html?lang=ar`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  await page.locator('#t-settings').click();
  await page.getByRole('button', { name: /تحميل بيانات العرض التجريبي/ }).click();
  await page.waitForFunction(() => state.cases.length >= 4);

  await page.evaluate(async () => {
    const now = Date.now();
    const candidates = [
      {
        id: 'manual-detect-domain-1',
        type: 'domain',
        platform: 'website',
        username: 'mybrand-outlet.shop',
        url: 'https://mybrand-outlet.shop',
        source: 'detect-domains',
        candidateScore: 92,
        candidateStatus: 'new',
        status: 'found',
        foundAt: now - 36 * 60 * 1000,
        updatedAt: now - 36 * 60 * 1000,
        notes: 'lookalike domain flagged by the domain detector',
        shots: [],
      },
      {
        id: 'manual-detect-domain-2',
        type: 'domain',
        platform: 'website',
        username: 'mybrand-official-store.com',
        url: 'https://mybrand-official-store.com',
        source: 'detect-domains',
        candidateScore: 74,
        candidateStatus: 'new',
        status: 'found',
        foundAt: now - 54 * 60 * 1000,
        updatedAt: now - 54 * 60 * 1000,
        notes: 'registered lookalike domain awaiting human review',
        shots: [],
      },
    ];
    for (const candidate of candidates) await DB.put('cases', candidate);

    const sweepCoverage = {
      instagram: new Date(now - 2 * 86400000).toISOString(),
      tiktok: new Date(now - 4 * 86400000).toISOString(),
      facebook: new Date(now - 10 * 86400000).toISOString(),
      x: new Date(now - 6 * 86400000).toISOString(),
    };
    localStorage.setItem('hares-sweep', JSON.stringify(sweepCoverage));
    await reload();
  });
  await page.waitForTimeout(150);
}

async function captureCoreApplication(page) {
  await page.goto(`${baseUrl}/index.html?lang=ar`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  await saveViewport(page, '01-dashboard-ar.png');

  await toggleLanguage(page);
  await saveViewport(page, '02-dashboard-en.png');
  await toggleLanguage(page);

  await page.locator('#fabAdd').click();
  await page.waitForSelector('#f-type');
  await saveViewport(page, '03-add-case-ar.png');
  await page.locator('[data-act="closeSheet"]').first().click();

  await page.getByText('mybrand-outlet.shop', { exact: true }).first().click();
  await page.waitForSelector('#sheet:not([hidden])');
  await page.waitForTimeout(350);
  await saveViewport(page, '04-case-detail-whois-ar.png');

  await page.locator('#r-text').scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  await saveViewport(page, '05-case-report-forms-ar.png');

  await page.evaluate(() => document.getElementById('caseTimeline')?.closest('.panel')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(120);
  await saveViewport(page, '15b-case-evidence-timeline-ar.png');
  await toggleLanguage(page);
  await page.waitForTimeout(250);
  await page.evaluate(() => document.getElementById('caseTimeline')?.closest('.panel')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(120);
  await saveViewport(page, '15b-case-evidence-timeline-en.png');
  await toggleLanguage(page);
  await page.waitForTimeout(250);

  await scrollHeadingToTop(page, 'مركز التصعيد للجهات الرسمية');
  await saveViewport(page, '06-escalation-center-ar.png');

  await page.getByRole('button', { name: /إنشاء بطاقة تحذير للعملاء/ }).click();
  await page.waitForFunction(() => {
    const image = document.querySelector('#lightbox img');
    return image?.complete && image.naturalWidth > 0;
  });
  await saveViewport(page, '07-story-alert-card.png');
  await page.locator('#lbCloseBtn').click();

  await page.locator('[data-act="closeSheet"]').first().click();
  await page.locator('#t-variants').click();
  await page.waitForTimeout(150);
  await saveViewport(page, '08-scan-tab-ar.png');

  await page.locator('#t-settings').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(120);
  await saveViewport(page, '09-settings-top-ar.png');

  await scrollToText(page, 'عرض تجريبي للعملاء (Client Demo Preset)');
  await saveViewport(page, '10-settings-bottom-ar.png');

  await scrollToText(page, 'المزامنة السحابية (Supabase — اختياري)');
  await saveViewport(page, '10b-settings-cloud-dossier-ar.png');

  await scrollToText(page, 'نسخة احتياطية');
  await saveViewport(page, '10c-settings-backup-ar.png');
}

async function capturePhaseScreens(page) {
  await page.goto(`${baseUrl}/index.html?lang=ar`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);

  await page.locator('#t-suspected').click();
  await page.waitForTimeout(150);
  await saveViewport(page, '12-suspected-inbox-ar.png');
  await toggleLanguage(page);
  await saveViewport(page, '12-suspected-inbox-en.png');
  await toggleLanguage(page);

  await page.locator('#t-sweep').click();
  await page.waitForTimeout(150);
  await saveViewport(page, '13-sweep-verify-ar.png');
  await toggleLanguage(page);
  await saveViewport(page, '13-sweep-verify-en.png');
  await toggleLanguage(page);

  await page.goto(`${baseUrl}/index.html?verify=1&lang=ar&brand=${encodeURIComponent('My Brand')}`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  await saveViewport(page, '13b-verify-page-ar.png');

  await page.goto(`${baseUrl}/index.html?lang=ar`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  await page.locator('#t-analytics').click();
  await page.waitForTimeout(150);
  await saveViewport(page, '14-analytics-ar.png');
  await toggleLanguage(page);
  await saveViewport(page, '14-analytics-en.png');
  await toggleLanguage(page);

  await page.locator('#t-settings').click();
  await scrollHeadingToTop(page, 'إعدادات White-Label (للعملاء)');
  await saveViewport(page, '15-advanced-settings-ar.png');
  await toggleLanguage(page);
  await scrollHeadingToTop(page, 'White-Label Settings (For Clients)');
  await saveViewport(page, '15-advanced-settings-en.png');
}

async function capturePublicForms(page) {
  await page.goto(`${baseUrl}/index.html?report=1&lang=ar&brand=${encodeURIComponent('My Brand')}`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  await saveViewport(page, '11-customer-form-ar.png');
}

let baseUrl = '';
const server = createStaticServer();

try {
  fs.mkdirSync(outputDir, { recursive: true });
  baseUrl = await listen(server);

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--disable-gpu'],
  });

  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: 'en-US',
    colorScheme: 'light',
  });
  const page = await context.newPage();

  await seedDemo(page);
  await captureCoreApplication(page);
  await capturePhaseScreens(page);
  await capturePublicForms(page);

  await context.close();
  await browser.close();
  console.log('Manual screenshots captured successfully.');
} finally {
  await new Promise((resolve) => server.close(resolve));
}
