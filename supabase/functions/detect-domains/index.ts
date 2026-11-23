// ============================================================================
// Brand Guard (حارس العلامة) — Phase 1: detect-domains Edge Function
// Reference: BRAND-GUARD-PLATFORM-BLUEPRINT.md (Section 6, D1)
// Generates lookalike domain permutations, resolves via Cloudflare DoH,
// enriches via RDAP, scores candidates, and inserts into `candidates`.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// --- Permutation Generators (Section 6, D1) ---
function normalizeDomain(d: string): string {
  return d.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
}

function generatePermutations(brandName: string, officialDomain: string, aliases: string[], keywords: string[]): string[] {
  const set = new Set<string>();
  const name = normalizeDomain(officialDomain).split('.')[0];
  const origTld = officialDomain.split('.').slice(1).join('.') || 'com';
  if (name.length < 2) return [];

  const tlds = ['.com', '.ae', '.shop', '.store', '.net', '.org', '.online', '.site', '.xyz', '.co', '.sa', '.me', '.app', '.vip', '.top'];
  const suffixes = ['-shop', '-official', '-store', '-outlet', '-sale', '-uae', '-ae', 'shop', 'store', 'official', 'outlet'];
  const prefixes = ['official-', 'real-', 'my-', 'get-', 'the-', 'buy-'];
  const homoglyphs: [string, string][] = [['o', '0'], ['l', '1'], ['i', 'l'], ['e', '3'], ['a', '4'], ['s', '5'], ['g', '9']];

  // 1. TLD swaps
  tlds.forEach(t => {
    const tld = t.replace(/^\./, '');
    if (tld !== origTld) set.add(`${name}.${tld}`);
  });

  // 2. Suffixes / prefixes
  suffixes.forEach(s => set.add(`${name}${s}.${origTld}`));
  prefixes.forEach(p => set.add(`${p}${name}.${origTld}`));

  // 3. Character omissions
  for (let i = 0; i < name.length; i++) {
    if (name.length > 3) set.add(name.slice(0, i) + name.slice(i + 1) + '.' + origTld);
  }

  // 4. Adjacent transpositions
  for (let i = 0; i < name.length - 1; i++) {
    if (name[i] !== name[i + 1]) {
      set.add(name.slice(0, i) + name[i + 1] + name[i] + name.slice(i + 2) + '.' + origTld);
    }
  }

  // 5. Homoglyph replacements
  homoglyphs.forEach(([a, b]) => {
    if (name.includes(a)) set.add(name.split(a).join(b) + '.' + origTld);
  });

  // 6. Keyword combos (brand + keyword)
  keywords.forEach(kw => {
    const clean = kw.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean.length >= 2) {
      set.add(`${name}-${clean}.${origTld}`);
      set.add(`${name}${clean}.${origTld}`);
      set.add(`${clean}-${name}.${origTld}`);
    }
  });

  // 7. Alias-based permutations
  aliases.forEach(alias => {
    const clean = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean.length >= 2 && clean !== name) {
      set.add(`${clean}.${origTld}`);
      tlds.forEach(t => {
        const tld = t.replace(/^\./, '');
        if (tld !== origTld) set.add(`${clean}.${tld}`);
      });
    }
  });

  // 8. Arabic transliteration variants (manual via aliases)
  // (handled by aliases above)

  // Remove the official domain itself
  set.delete(`${name}.${origTld}`);

  // Cap at 3000 permutations
  const result = [...set].filter(d => /^[a-z0-9-]{2,40}\.[a-z.]{2,12}$/.test(d));
  return result.slice(0, 3000);
}

// --- Cloudflare DoH batch resolution ---
async function resolveDoH(domain: string): Promise<{ registered: boolean; ip: string; status: number }> {
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { 'Accept': 'application/dns-json' },
    });
    if (!r.ok) return { registered: false, ip: '', status: 0 };
    const j = await r.json();
    if (j.Status === 0 && Array.isArray(j.Answer) && j.Answer.length > 0) {
      const a = j.Answer.find((x: any) => x.type === 1) || j.Answer[0];
      return { registered: true, ip: a.data || '', status: j.Status };
    }
    return { registered: false, ip: '', status: j.Status || 3 };
  } catch {
    return { registered: false, ip: '', status: 0 };
  }
}

// --- RDAP enrichment ---
async function enrichRdap(domain: string): Promise<{ registrar: string; abuseEmail: string; created: string; nameservers: string[] }> {
  try {
    const r = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { 'Accept': 'application/rdap+json, application/json' },
    });
    if (!r.ok) return { registrar: 'Unknown', abuseEmail: '', created: '', nameservers: [] };
    const j = await r.json();
    let registrar = 'Unknown', abuseEmail = '', created = '';
    const walkEntities = (ents: any[]) => {
      if (!Array.isArray(ents)) return;
      for (const e of ents) {
        const roles = e.roles || [];
        const vcard = Array.isArray(e.vcardArray) && Array.isArray(e.vcardArray[1]) ? e.vcardArray[1] : [];
        const fn = vcard.find((x: any) => x[0] === 'fn');
        const em = vcard.find((x: any) => x[0] === 'email');
        if (roles.includes('registrar') && fn && fn[3] && registrar === 'Unknown') registrar = String(fn[3]);
        if (roles.includes('abuse') && em && em[3] && !abuseEmail) abuseEmail = String(em[3]);
        if (!abuseEmail && em && em[3]) abuseEmail = String(em[3]);
        if (e.entities) walkEntities(e.entities);
      }
    };
    walkEntities(j.entities);
    if (Array.isArray(j.events)) {
      const regEv = j.events.find((ev: any) => ev.eventAction === 'registration') || j.events[0];
      if (regEv?.eventDate) created = regEv.eventDate.slice(0, 10);
    }
    const nameservers = Array.isArray(j.nameservers) ? j.nameservers.map((n: any) => n.ldhName).filter(Boolean).slice(0, 4) : [];
    return { registrar, abuseEmail, created, nameservers };
  } catch {
    return { registrar: 'Unknown', abuseEmail: '', created: '', nameservers: [] };
  }
}

// --- HTTP enrichment ---
async function enrichHttp(domain: string): Promise<{ status: number; title: string; hasBrandWords: boolean; hasCheckout: boolean; hasWhatsApp: boolean }> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`https://${domain}`, { signal: ctrl.signal, redirect: 'follow' });
    clearTimeout(timer);
    const html = await r.text();
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().slice(0, 200) : '';
    const hasBrandWords = /brand|official|shop|store|outlet/i.test(html);
    const hasCheckout = /cart|checkout|buy now|add to cart/i.test(html);
    const hasWhatsApp = /wa\.me|whatsapp/i.test(html);
    return { status: r.status, title, hasBrandWords, hasCheckout, hasWhatsApp };
  } catch {
    return { status: 0, title: '', hasBrandWords: false, hasCheckout: false, hasWhatsApp: false };
  }
}

// --- Scoring (Section 7) ---
function scoreCandidate(signals: Record<string, boolean>, domainCreatedDays: number | null, isCustomerReport: boolean): { score: number; signals: Record<string, boolean> } {
  const s = { ...signals };
  let score = 0;

  if (s.allowlisted) return { score: 0, signals: s };

  if (s.exact_name_match) score += 25;
  if (s.edit_distance_le2) score += 20;
  if (s.homoglyph_match) score += 20;
  if (s.keyword_combo) score += 10;
  if (domainCreatedDays !== null) {
    if (domainCreatedDays < 30) score += 20;
    else if (domainCreatedDays < 90) score += 10;
  }
  if (s.cheap_registrar) score += 5;
  if (s.page_contains_brand) score += 20;
  if (s.logo_hash_match) score += 30;
  if (s.image_hash_match) score += 25;
  if (s.checkout_or_contact) score += 10;
  if (s.phone_mismatch) score += 15;
  if (isCustomerReport) score += 30;
  if (s.clustering_match) score += 15;
  if (s.fan_page) score -= 15;

  score = Math.max(0, Math.min(100, score));
  return { score, signals: s };
}

// --- Main handler ---
export async function handleDetectDomains(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const getEnv = (k: string) => (typeof Deno !== 'undefined' ? Deno.env.get(k) : undefined) ?? '';
  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const workspaceId = String(body.workspace_id || '').trim();
  const brandId = String(body.brand_id || '').trim();
  if (!workspaceId || !brandId) {
    return new Response(JSON.stringify({ error: 'workspace_id and brand_id required' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Fetch brand profile
  const { data: brand, error: brandErr } = await admin
    .from('brands')
    .select('name, aliases, keywords, official_domains, official_handles, official_phones, allowlist')
    .eq('id', brandId)
    .single();

  if (brandErr || !brand) {
    return new Response(JSON.stringify({ error: 'Brand not found' }), {
      status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const officialDomain = (brand.official_domains || [])[0] || '';
  if (!officialDomain) {
    return new Response(JSON.stringify({ error: 'Brand has no official domain configured' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Record detector run
  const { data: runRow } = await admin.from('detector_runs').insert({
    workspace_id: workspaceId,
    brand_id: brandId,
    detector: 'detect-domains',
    status: 'running',
    stats: { permutations_generated: 0, domains_checked: 0, registered_found: 0, candidates_created: 0 },
  }).select('id').single();

  const runId = runRow?.id;

  try {
    const permutations = generatePermutations(brand.name, officialDomain, brand.aliases || [], brand.keywords || []);
    const allowlist = new Set((brand.allowlist || []).map((e: any) => typeof e === 'string' ? e : e.domain || e.handle || ''));

    let registeredCount = 0;
    let candidatesCreated = 0;
    const BATCH_SIZE = 20;

    for (let i = 0; i < permutations.length; i += BATCH_SIZE) {
      const batch = permutations.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (domain) => {
        const dns = await resolveDoH(domain);
        if (!dns.registered) return null;
        registeredCount++;
        const rdap = await enrichRdap(domain);
        const http = await enrichHttp(domain);
        const isAllowlisted = allowlist.has(domain);

        // Compute signals
        const signals: Record<string, boolean> = {};
        const name = officialDomain.split('.')[0].toLowerCase();
        const permName = domain.split('.')[0].toLowerCase();

        // Exact name match
        signals.exact_name_match = permName.includes(name) || name.includes(permName);
        // Homoglyph check (simplified)
        signals.homoglyph_match = false;
        // Cheap registrar / TLD
        const cheapTlds = ['xyz', 'top', 'vip', 'site', 'online', 'co'];
        const tld = domain.split('.').pop() || '';
        signals.cheap_registrar = cheapTlds.includes(tld);
        // Page contains brand words
        signals.page_contains_brand = http.hasBrandWords;
        // Checkout or WhatsApp contact
        signals.checkout_or_contact = http.hasCheckout || http.hasWhatsApp;
        // Allowlisted
        signals.allowlisted = isAllowlisted;

        // Domain age in days
        let domainCreatedDays: number | null = null;
        if (rdap.created) {
          const createdDate = new Date(rdap.created);
          domainCreatedDays = Math.floor((Date.now() - createdDate.getTime()) / 86400000);
        }

        // Score
        const { score, signals: scoredSignals } = scoreCandidate(signals, domainCreatedDays, false);

        // Only create candidates for score >= 40 (review threshold)
        if (score < 40) return null;

        const normalizedKey = `domain:${domain}`;
        const { error: upsertErr } = await admin.from('candidates').upsert({
          workspace_id: workspaceId,
          brand_id: brandId,
          kind: 'domain',
          platform: 'website',
          url: `https://${domain}`,
          handle: domain,
          title: http.title || domain,
          normalized_key: normalizedKey,
          source: 'detect-domains',
          score,
          signals: scoredSignals,
          status: 'new',
          last_seen: new Date().toISOString(),
        }, { onConflict: 'workspace_id,brand_id,normalized_key' });

        if (!upsertErr) candidatesCreated++;

        return { domain, score, registered: true, registrar: rdap.registrar };
      }));

      // Throttle between batches (500ms)
      if (i + BATCH_SIZE < permutations.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Update detector run
    if (runId) {
      await admin.from('detector_runs').update({
        status: 'success',
        finished_at: new Date().toISOString(),
        stats: {
          permutations_generated: permutations.length,
          domains_checked: permutations.length,
          registered_found: registeredCount,
          candidates_created: candidatesCreated,
        },
      }).eq('id', runId);
    }

    return new Response(JSON.stringify({
      ok: true,
      run_id: runId,
      permutations: permutations.length,
      registered: registeredCount,
      candidates: candidatesCreated,
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    if (runId) {
      await admin.from('detector_runs').update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error: String(err?.message || err),
      }).eq('id', runId);
    }
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(req => handleDetectDomains(req));
}
