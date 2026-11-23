// ============================================================================
// Brand Guard (حارس العلامة) — Phase 1 Scoring Engine Unit Tests
// Reference: BRAND-GUARD-PLATFORM-BLUEPRINT.md (Section 7)
// Run with: node tests/scorer.test.mjs
// ============================================================================

function scoreCandidate(signals, domainCreatedDays, isCustomerReport) {
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

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✅ ${message}`); }
  else { failed++; console.log(`  ❌ ${message}`); }
}

console.log('=== Phase 1 Scoring Engine Unit Tests ===\n');

// Test 1: True positive — high score
console.log('Test 1: True positive lookalike domain');
const tp = scoreCandidate({
  exact_name_match: true,
  keyword_combo: true,
  page_contains_brand: true,
  checkout_or_contact: true,
}, 5, false);
assert(tp.score >= 70, `High score for true positive (got ${tp.score})`);
assert(tp.score <= 100, `Score clamped to 100 (got ${tp.score})`);

// Test 2: Customer report bonus
console.log('\nTest 2: Customer report gets +30 bonus');
const cr = scoreCandidate({ exact_name_match: true }, 10, true);
assert(cr.score >= 55, `Customer report score >= 55 (got ${cr.score})`);
const noCr = scoreCandidate({ exact_name_match: true }, 10, false);
assert(cr.score === noCr.score + 30, `Customer report adds exactly 30 points`);

// Test 3: Allowlisted → score 0 (hard override)
console.log('\nTest 3: Allowlisted domain → score 0');
const al = scoreCandidate({ exact_name_match: true, allowlisted: true }, 5, false);
assert(al.score === 0, `Allowlisted score is 0 (got ${al.score})`);

// Test 4: Fan page reduces score
console.log('\nTest 4: Fan page reduces score');
const fan = scoreCandidate({ exact_name_match: true, fan_page: true }, 60, false);
const noFan = scoreCandidate({ exact_name_match: true, fan_page: false }, 60, false);
assert(fan.score === noFan.score - 15, `Fan page reduces by 15 (got ${fan.score} vs ${noFan.score})`);

// Test 5: Domain age scoring
console.log('\nTest 5: Domain age scoring');
const young = scoreCandidate({}, 5, false);
const mid = scoreCandidate({}, 60, false);
const old = scoreCandidate({}, 120, false);
assert(young.score === 20, `Domain < 30 days = +20 (got ${young.score})`);
assert(mid.score === 10, `Domain 30-90 days = +10 (got ${mid.score})`);
assert(old.score === 0, `Domain > 90 days = +0 (got ${old.score})`);

// Test 6: Clamping to 0..100
console.log('\nTest 6: Score clamping');
const maxAll = scoreCandidate({
  exact_name_match: true, edit_distance_le2: true, homoglyph_match: true,
  keyword_combo: true, page_contains_brand: true, logo_hash_match: true,
  image_hash_match: true, checkout_or_contact: true, phone_mismatch: true,
  clustering_match: true, cheap_registrar: true,
}, 5, true);
assert(maxAll.score === 100, `Max score clamped to 100 (got ${maxAll.score})`);

const negative = scoreCandidate({ fan_page: true }, null, false);
assert(negative.score === 0, `Negative score clamped to 0 (got ${negative.score})`);

// Test 7: Thresholds (≥70 high, 40-69 review, <40 hidden)
console.log('\nTest 7: Threshold classification');
const high = scoreCandidate({ exact_name_match: true, keyword_combo: true, page_contains_brand: true, checkout_or_contact: true }, 5, false);
assert(high.score >= 70, `High threshold ≥70 (got ${high.score})`);

const review = scoreCandidate({ exact_name_match: true, keyword_combo: true }, 60, false);
assert(review.score >= 40 && review.score < 70, `Review threshold 40-69 (got ${review.score})`);

const hidden = scoreCandidate({ fan_page: true }, 120, false);
assert(hidden.score < 40, `Hidden threshold <40 (got ${hidden.score})`);

// Test 8: Explainable signals preserved
console.log('\nTest 8: Signals preserved in output');
const sig = scoreCandidate({ exact_name_match: true, customer_report: false }, 10, false);
assert(sig.signals.exact_name_match === true, 'exact_name_match signal preserved');
assert(sig.signals.allowlisted !== true, 'allowlisted not set when not allowlisted');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
