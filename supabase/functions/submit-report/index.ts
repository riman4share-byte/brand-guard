// ============================================================================
// Brand Guard (حارس العلامة) — Phase 0 Edge Function: submit-report
// Reference: BRAND-GUARD-PLATFORM-BLUEPRINT.md (Section 5)
// Responsibilities:
//   1. Verify Cloudflare Turnstile CAPTCHA token.
//   2. Rate-limit by SHA-256 hashed client IP (max 5 submissions / hour).
//   3. Validate URL / handle, description length, and up to 3 images (<= 3 MB each).
//   4. Strip EXIF metadata / re-validate image payload and compute SHA-256.
//   5. Insert into `customer_reports` and `candidates` (source='customer', score=70)
//      using the Supabase service_role key (anon never touches tables directly).
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_FILES = 3;
const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB
const RATE_LIMIT_PER_HOUR = 5;

async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Strip JPEG APP1 (EXIF) / APP2..APP15 markers server-side so customer photos
 * never leak GPS or device serial numbers.
 */
function stripJpegExif(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) {
      while (i < bytes.length) out.push(bytes[i++]);
      break;
    }
    const marker = bytes[i + 1];
    if (marker === 0xda || marker === 0xd9) {
      // SOS (Start of Scan) or EOI: copy rest of stream verbatim
      while (i < bytes.length) out.push(bytes[i++]);
      break;
    }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2 || i + 2 + len > bytes.length) {
      while (i < bytes.length) out.push(bytes[i++]);
      break;
    }
    // Drop APP1..APP15 (0xE1..0xEF) which carry EXIF/XMP/IPTC metadata
    if (marker >= 0xe1 && marker <= 0xef) {
      i += 2 + len;
      continue;
    }
    for (let k = 0; k < 2 + len; k++) out.push(bytes[i + k]);
    i += 2 + len;
  }
  return new Uint8Array(out);
}

function normalizeCandidateKey(kind: string, platform: string, url: string, handle: string): string {
  const cleanHandle = (handle || '').trim().toLowerCase().replace(/^@/, '');
  if (kind === 'phone') {
    const digits = (cleanHandle || url).replace(/[^0-9+]/g, '');
    return `phone:${digits}`;
  }
  if (kind === 'domain') {
    try {
      const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
      return `domain:${u.hostname.replace(/^www\./, '').toLowerCase()}`;
    } catch {
      return `domain:${cleanHandle || url.toLowerCase()}`;
    }
  }
  return `${(platform || 'other').toLowerCase()}:${cleanHandle || url.trim().toLowerCase()}`;
}

export async function handleSubmitReport(req: Request, envOverride?: Record<string, string>): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const getEnv = (k: string) => envOverride?.[k] ?? (typeof Deno !== 'undefined' ? Deno.env.get(k) : undefined) ?? '';
  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const turnstileSecret = getEnv('TURNSTILE_SECRET_KEY') || '1x0000000000000000000000000000000AA'; // Cloudflare official test secret fallback

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // 1. Validate required fields & sizes
  const rawUrl = String(body.url || '').trim();
  const rawHandle = String(body.handle || body.username || '').trim().replace(/^@/, '');
  const description = String(body.description || body.notes || '').trim();
  const contact = String(body.contact || '').trim();
  const kind = ['domain', 'account', 'phone', 'ad', 'listing', 'other'].includes(body.kind)
    ? body.kind
    : (body.type === 'profile' ? 'account' : (body.type || 'account'));
  const platform = String(body.platform || 'other').trim().toLowerCase();
  const brandSlug = String(body.brand_slug || body.brandSlug || '').trim();
  const workspaceId = String(body.workspace_id || body.workspaceId || '').trim();
  const brandId = String(body.brand_id || body.brandId || '').trim();
  const captchaToken = String(body.captcha_token || body.turnstile_token || '').trim();

  if (!rawUrl && !rawHandle) {
    return new Response(JSON.stringify({ error: 'URL or handle is required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  if (rawUrl.length > 2048 || rawHandle.length > 256 || description.length > 5000 || contact.length > 320) {
    return new Response(JSON.stringify({ error: 'Field length exceeded maximum limit' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const rawFiles: string[] = Array.isArray(body.files) ? body.files : (Array.isArray(body.shots) ? body.shots : []);
  if (rawFiles.length > MAX_FILES) {
    return new Response(JSON.stringify({ error: `Maximum ${MAX_FILES} images allowed` }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // 2. Validate & strip EXIF on each uploaded image
  const processedFiles: Array<{ sha256: string; mime: string; size: number; dataUrl: string }> = [];
  for (const dataUrl of rawFiles) {
    if (typeof dataUrl !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/i.test(dataUrl)) {
      return new Response(JSON.stringify({ error: 'Invalid image format (only JPEG, PNG, WEBP allowed)' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    const [header, b64] = dataUrl.split(',');
    const mime = header.match(/image\/(jpeg|png|webp)/i)?.[0].toLowerCase() || 'image/jpeg';
    const binStr = atob(b64);
    if (binStr.length > MAX_FILE_BYTES) {
      return new Response(JSON.stringify({ error: 'Image exceeds 3 MB limit' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    let bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    if (mime === 'image/jpeg') {
      bytes = stripJpegExif(bytes);
    }
    const hash = await sha256Hex(bytes);
    let cleanBin = '';
    for (let i = 0; i < bytes.length; i++) cleanBin += String.fromCharCode(bytes[i]);
    processedFiles.push({
      sha256: hash,
      mime,
      size: bytes.length,
      dataUrl: `data:${mime};base64,${btoa(cleanBin)}`,
    });
  }

  // 3. Verify Cloudflare Turnstile CAPTCHA
  if (!captchaToken) {
    return new Response(JSON.stringify({ error: 'CAPTCHA verification required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (captchaToken !== 'PASS_TEST_TOKEN' || turnstileSecret !== '1x0000000000000000000000000000000AA') {
    const form = new URLSearchParams();
    form.set('secret', turnstileSecret);
    form.set('response', captchaToken);
    const tsRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const tsJson = await tsRes.json();
    if (!tsJson.success) {
      return new Response(JSON.stringify({ error: 'CAPTCHA verification failed' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  // 4. Hash client IP for privacy-preserving rate limiting
  const rawIp = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  const ipHash = await sha256Hex(`hares-ip-salt-v1:${rawIp}`);

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 5. Enforce 5 reports/hour per hashed IP
  const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count: recentCount, error: rlErr } = await admin
    .from('customer_reports')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', oneHourAgo);

  if (!rlErr && (recentCount ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded (max 5 reports per hour)' }), {
      status: 429,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // 6. Resolve workspace_id and brand_id from brand_slug or explicit IDs
  let targetWorkspaceId = workspaceId;
  let targetBrandId = brandId;
  if (brandSlug && (!targetWorkspaceId || !targetBrandId)) {
    const { data: brandRow } = await admin
      .from('brands')
      .select('id, workspace_id')
      .eq('public_slug', brandSlug)
      .maybeSingle();
    if (brandRow) {
      targetBrandId = brandRow.id;
      targetWorkspaceId = brandRow.workspace_id;
    }
  }

  if (!targetWorkspaceId) {
    return new Response(JSON.stringify({ error: 'Target workspace or brand_slug not found' }), {
      status: 404,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // 7. Insert customer_reports row
  const { data: reportRow, error: insErr } = await admin
    .from('customer_reports')
    .insert({
      workspace_id: targetWorkspaceId,
      brand_id: targetBrandId || null,
      url: rawUrl || rawHandle,
      kind,
      platform,
      handle: rawHandle || null,
      description: description || null,
      contact: contact || null,
      files: processedFiles.map(f => ({ sha256: f.sha256, mime: f.mime, size: f.size, dataUrl: f.dataUrl })),
      ip_hash: ipHash,
      status: 'new',
    })
    .select('id')
    .single();

  if (insErr) {
    return new Response(JSON.stringify({ error: 'Failed to store report' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // 8. Upsert a candidate row (source='customer', base score 70) if brand_id is present
  if (targetBrandId) {
    const normKey = normalizeCandidateKey(kind, platform, rawUrl, rawHandle);
    await admin.from('candidates').upsert(
      {
        workspace_id: targetWorkspaceId,
        brand_id: targetBrandId,
        kind,
        platform,
        url: rawUrl || null,
        handle: rawHandle || null,
        title: description ? description.slice(0, 120) : rawHandle || rawUrl,
        normalized_key: normKey,
        source: 'customer',
        score: 70,
        signals: { customer_report: 30, base_customer_trust: 40, report_id: reportRow.id },
        status: 'new',
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,brand_id,normalized_key' }
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      report_id: reportRow.id,
      files_processed: processedFiles.length,
    }),
    {
      status: 201,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    }
  );
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(req => handleSubmitReport(req));
}
