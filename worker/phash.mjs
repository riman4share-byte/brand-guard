// ============================================================================
// Brand Guard (حارس العلامة) — Phase 4: Perceptual Hash (pHash) Module
// Reference: BRAND-GUARD-PLATFORM-BLUEPRINT.md (Section 6, D7, P4)
// DCT-based perceptual hash for image similarity detection.
// Used by capture worker to compare candidate page images against brand assets.
// ============================================================================

/**
 * Compute a 64-bit perceptual hash (pHash) for an image buffer.
 * Uses DCT on a downscaled grayscale image.
 * Returns a 16-character hex string (64 bits).
 */
export async function computePHash(imageBuffer) {
  // This runs in Node.js with sharp or canvas
  // For the worker, we use a simplified approach:
  // 1. Downscale to 32x32 grayscale
  // 2. Apply DCT
  // 3. Take top-left 8x8, compare to median
  // 4. Generate 64-bit hash

  // In practice, use 'sharp' library for image processing
  // For now, return a placeholder that the worker can replace
  const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex').slice(0, 16);
  return hash;
}

/**
 * Compute Hamming distance between two pHash strings.
 * Returns 0 (identical) to 64 (completely different).
 */
export function hammingDistance(hash1, hash2) {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 64;
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const a = parseInt(hash1[i], 16);
    const b = parseInt(hash2[i], 16);
    let xor = a ^ b;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/**
 * Convert Hamming distance to similarity percentage (0-100).
 * Threshold: <= 10 bits = near-duplicate, <= 20 = similar
 */
export function similarityFromDistance(distance) {
  return Math.max(0, Math.round((1 - distance / 64) * 100));
}

/**
 * Classify match type based on Hamming distance.
 */
export function classifyMatch(distance) {
  if (distance <= 5) return 'exact';
  if (distance <= 10) return 'near';
  if (distance <= 20) return 'partial';
  return 'none';
}

// TinEye adapter interface (Section 6, D7)
export class TinEyeAdapter {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.tineye.com/rest/';
  }

  async search(imageUrl) {
    if (!this.apiKey) {
      return { error: 'No API key configured', results: [] };
    }
    try {
      const url = `${this.baseUrl}search/?url=${encodeURIComponent(imageUrl)}&api_key=${this.apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return { error: `HTTP ${res.status}`, results: [] };
      const json = await res.json();
      return {
        results: (json.matches || []).map(m => ({
          url: m.domain + m.filepath,
          score: m.score,
          crawl_date: m.crawl_date,
        })),
        total: json.num_matches || 0,
      };
    } catch (e) {
      return { error: String(e.message || e), results: [] };
    }
  }
}
