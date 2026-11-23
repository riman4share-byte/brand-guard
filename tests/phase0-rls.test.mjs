// ============================================================================
// Brand Guard (حارس العلامة) — Phase 0 RLS & Tenant Isolation Tests
// Reference: BRAND-GUARD-PLATFORM-BLUEPRINT.md (Section 18)
// Run with: node tests/phase0-rls.test.mjs
// Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.log('⚠️  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not set. Skipping live RLS tests.');
  console.log('   Set these env vars to run against a real Supabase instance.');
  console.log('   SQL migration file: supabase/migrations/0001_phase0_foundation.sql');
  console.log('   Edge Function: supabase/functions/submit-report/index.ts');
  process.exit(0);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.log(`  ❌ ${message}`);
  }
}

async function runTests() {
  console.log('=== Phase 0 RLS & Tenant Isolation Tests ===\n');

  // Test 1: Anon key cannot read any table
  console.log('Test 1: Anon cannot read tables');
  if (ANON_KEY) {
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const tables = ['workspaces', 'members', 'brands', 'brand_assets', 'candidates', 'cases', 'case_events', 'evidence', 'customer_reports', 'audit_log'];
    for (const table of tables) {
      const { data, error } = await anonClient.from(table).select('*').limit(1);
      assert(error !== null || (data && data.length === 0), `anon cannot read ${table}`);
    }
  } else {
    console.log('  ⚠️  SUPABASE_ANON_KEY not set, skipping anon read tests');
  }

  // Test 2: Anon key cannot insert into any table
  console.log('\nTest 2: Anon cannot insert into tables');
  if (ANON_KEY) {
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: wsErr } = await anonClient.from('workspaces').insert({ name: 'Test Anon WS' });
    assert(wsErr !== null, 'anon cannot insert into workspaces');

    const { error: caseErr } = await anonClient.from('cases').insert({ workspace_id: '00000000-0000-0000-0000-000000000000', brand_id: '00000000-0000-0000-0000-000000000000', kind: 'profile' });
    assert(caseErr !== null, 'anon cannot insert into cases');
  }

  // Test 3: Immutability of evidence and case_events
  console.log('\nTest 3: Evidence and case_events are immutable (no update/delete)');
  // Create a test workspace and case first
  const { data: testWs } = await admin.from('workspaces').insert({ name: 'RLS Test Workspace' }).select('id').single();
  if (testWs?.id) {
    const { data: testBrand } = await admin.from('brands').insert({
      workspace_id: testWs.id,
      name: 'Test Brand',
    }).select('id').single();

    if (testBrand?.id) {
      const { data: testCase } = await admin.from('cases').insert({
        workspace_id: testWs.id,
        brand_id: testBrand.id,
        kind: 'profile',
      }).select('id').single();

      if (testCase?.id) {
        const { data: ev } = await admin.from('evidence').insert({
          workspace_id: testWs.id,
          case_id: testCase.id,
          kind: 'screenshot',
          storage_path: 'test/path.png',
          sha256: 'abc123',
        }).select('id').single();

        if (ev?.id) {
          const { error: updErr } = await admin.from('evidence').update({ sha256: 'changed' }).eq('id', ev.id);
          assert(updErr !== null, 'evidence rows cannot be updated');
          const { error: delErr } = await admin.from('evidence').delete().eq('id', ev.id);
          assert(delErr !== null, 'evidence rows cannot be deleted');
        }
      }
    }
    // Cleanup
    await admin.from('workspaces').delete().eq('id', testWs.id);
  }

  // Test 4: Tenant isolation (user A cannot see user B's workspace)
  console.log('\nTest 4: Tenant isolation (cross-workspace access denied)');
  console.log('  ⚠️  Requires two authenticated test users. Skipping in automated run.');
  console.log('  Manual: Sign in as User A (Workspace 1) and User B (Workspace 2).');
  console.log('  User A SELECT on Workspace 2 tables must return 0 rows.');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
