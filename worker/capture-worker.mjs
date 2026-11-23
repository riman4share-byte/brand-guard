// ============================================================================
// Brand Guard (حارس العلامة) — Phase 2: Capture Worker (Playwright)
// Reference: BRAND-GUARD-PLATFORM-BLUEPRINT.md (Section 3, 11, 18)
// Polls capture_jobs queue, captures screenshots + HTML, computes SHA-256,
// stores immutable evidence, submits to Wayback Machine (optional).
// SSRF protection: blocks private IP ranges, metadata endpoints, non-http(s).
// ============================================================================

import { chromium } from 'playwright';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.log('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Exiting.');
  process.exit(0);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB
const PAGE_TIMEOUT_MS = 30000;
const MAX_ATTEMPTS = 3;

// --- SSRF Protection (Section 15) ---
function isPrivateOrBlocked(hostname) {
  // Block localhost, private IPs, metadata endpoints
  const blocked = [
    'localhost', '127.0.0.1', '0.0.0.0', '::1',
    '169.254.169.254', 'metadata.google.internal',
    'metadata', '10.', '172.16.', '172.17.', '172.18.', '172.19.',
    '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
    '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.',
    '192.168.', 'fc00:', 'fd00:', 'fe80:',
  ];
  const lower = hostname.toLowerCase();
  return blocked.some(b => lower === b || lower.startsWith(b) || lower.endsWith('.' + b));
}

function isAllowedUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (isPrivateOrBlocked(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function processJob(job) {
  const { id, url, workspace_id, case_id } = job;
  console.log(`Processing job ${id}: ${url}`);

  // SSRF check
  if (!isAllowedUrl(url)) {
    await admin.from('capture_jobs').update({
      status: 'failed',
      error: 'SSRF: URL blocked (private IP, metadata endpoint, or non-http scheme)',
      finished_at: new Date().toISOString(),
    }).eq('id', id);
    return;
  }

  // Mark as processing
  await admin.from('capture_jobs').update({
    status: 'processing',
    started_at: new Date().toISOString(),
    attempts: job.attempts + 1,
  }).eq('id', id);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'BrandGuard-CaptureWorker/1.0 (+https://github.com/riman4share-byte/brand-guard)',
      viewport: { width: 1440, height: 900 },
    });

    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: PAGE_TIMEOUT_MS });

    // Capture desktop screenshot
    const desktopScreenshot = await page.screenshot({ fullPage: true, type: 'png' });
    const desktopHash = sha256(desktopScreenshot);

    // Capture mobile screenshot
    const mobilePage = await context.newPage();
    await mobilePage.setViewportSize({ width: 390, height: 844 });
    await mobilePage.goto(url, { waitUntil: 'networkidle', timeout: PAGE_TIMEOUT_MS });
    const mobileScreenshot = await mobilePage.screenshot({ fullPage: true, type: 'png' });
    const mobileHash = sha256(mobileScreenshot);

    // Capture rendered HTML
    const html = await page.content();
    const htmlBuffer = Buffer.from(html, 'utf-8');
    const htmlHash = sha256(htmlBuffer);

    // Get final URL after redirects
    const finalUrl = page.url();

    // Upload to Supabase Storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const basePath = `${workspace_id}/${case_id || 'unknown'}/${timestamp}`;

    const { error: desktopUploadErr } = await admin.storage
      .from('evidence')
      .upload(`${basePath}/desktop.png`, desktopScreenshot, { contentType: 'image/png', upsert: false });

    const { error: mobileUploadErr } = await admin.storage
      .from('evidence')
      .upload(`${basePath}/mobile.png`, mobileScreenshot, { contentType: 'image/png', upsert: false });

    const { error: htmlUploadErr } = await admin.storage
      .from('evidence')
      .upload(`${basePath}/page.html`, htmlBuffer, { contentType: 'text/html', upsert: false });

    // Create evidence rows (immutable — insert only)
    const evidenceRows = [];
    if (!desktopUploadErr) {
      evidenceRows.push({
        workspace_id,
        case_id,
        kind: 'screenshot',
        storage_path: `${basePath}/desktop.png`,
        sha256: desktopHash,
        source_url: finalUrl,
        captured_at: new Date().toISOString(),
        capture_method: 'worker-playwright',
      });
    }
    if (!mobileUploadErr) {
      evidenceRows.push({
        workspace_id,
        case_id,
        kind: 'screenshot',
        storage_path: `${basePath}/mobile.png`,
        sha256: mobileHash,
        source_url: finalUrl,
        captured_at: new Date().toISOString(),
        capture_method: 'worker-playwright',
      });
    }
    if (!htmlUploadErr) {
      evidenceRows.push({
        workspace_id,
        case_id,
        kind: 'html',
        storage_path: `${basePath}/page.html`,
        sha256: htmlHash,
        source_url: finalUrl,
        captured_at: new Date().toISOString(),
        capture_method: 'worker-playwright',
      });
    }

    if (evidenceRows.length > 0) {
      await admin.from('evidence').insert(evidenceRows);
    }

    // Optional: Submit to Wayback Machine (Save Page Now)
    try {
      const waybackRes = await fetch(`https://web.archive.org/save/${encodeURIComponent(finalUrl)}`, {
        method: 'GET',
        headers: { 'User-Agent': 'BrandGuard-CaptureWorker/1.0' },
      });
      if (waybackRes.ok) {
        const archiveUrl = waybackRes.url;
        // Update evidence rows with archive_url (only on insert, not update — append new row)
        if (evidenceRows.length > 0) {
          await admin.from('evidence').insert({
            workspace_id,
            case_id,
            kind: 'html',
            storage_path: `${basePath}/wayback.txt`,
            sha256: sha256(Buffer.from(archiveUrl)),
            source_url: finalUrl,
            captured_at: new Date().toISOString(),
            capture_method: 'worker-playwright',
            archive_url: archiveUrl,
          });
        }
      }
    } catch (e) {
      console.log('Wayback Machine submission failed (non-critical):', e.message);
    }

    // Update case status to evidence_ready
    if (case_id) {
      await admin.from('cases').update({
        status: 'evidence_ready',
        updated_at: new Date().toISOString(),
      }).eq('id', case_id).eq('status', 'detected');

      // Add case_event
      await admin.from('case_events').insert({
        workspace_id,
        case_id,
        type: 'evidence_added',
        data: {
          capture_job_id: id,
          desktop_hash: desktopHash,
          mobile_hash: mobileHash,
          html_hash: htmlHash,
          final_url: finalUrl,
          evidence_count: evidenceRows.length,
        },
      });
    }

    // Mark job as done
    await admin.from('capture_jobs').update({
      status: 'done',
      finished_at: new Date().toISOString(),
    }).eq('id', id);

    console.log(`Job ${id} completed: ${evidenceRows.length} evidence items captured`);

    await context.close();
  } catch (err) {
    console.error(`Job ${id} failed:`, err.message);
    const newAttempts = (job.attempts || 0) + 1;
    const newStatus = newAttempts >= MAX_ATTEMPTS ? 'failed' : 'queued';
    await admin.from('capture_jobs').update({
      status: newStatus,
      error: String(err.message || err),
      finished_at: newStatus === 'failed' ? new Date().toISOString() : null,
      attempts: newAttempts,
    }).eq('id', id);
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  console.log('Capture worker starting...');

  // Fetch queued jobs (priority desc, then oldest first)
  const { data: jobs, error } = await admin
    .from('capture_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(5);

  if (error) {
    console.error('Failed to fetch capture jobs:', error);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log('No queued capture jobs. Exiting.');
    process.exit(0);
  }

  console.log(`Found ${jobs.length} queued job(s). Processing...`);

  for (const job of jobs) {
    await processJob(job);
  }

  console.log('Capture worker finished.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
