/**
 * Minimal BM25-style sparse encoder for Upstash Vector hybrid indexes.
 *
 * Each token is hashed to a dimension index. Documents store BM25-saturated
 * term frequencies; queries store 1 per term and rely on Upstash's
 * `WeightingStrategy.IDF` at query time to supply the IDF half of BM25.
 * Exact keyword matches (hero names, item names like "Silver Edge") get
 * boosted this way, which dense embeddings alone tend to blur.
 */
import type { SparseVector } from '@upstash/vector';

const K1 = 1.2;
const B = 0.75;

const STOPWORDS = new Set(
  'a an and are as at be but by for from has have in is it its of on or that the this to was were will with'.split(' '),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOPWORDS.has(t));
}

// FNV-1a 32-bit hash, kept in positive int32 range.
function hashToken(token: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) & 0x7fffffff;
}

function countTerms(tokens: string[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const t of tokens) {
    const idx = hashToken(t);
    counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }
  return counts;
}

/** Sparse vector for a stored chunk. `avgDocLength` is the corpus-wide average token count. */
export function documentSparseVector(text: string, avgDocLength: number): SparseVector {
  const tokens = tokenize(text);
  const norm = 1 - B + (B * tokens.length) / Math.max(avgDocLength, 1);
  const indices: number[] = [];
  const values: number[] = [];
  for (const [idx, tf] of countTerms(tokens)) {
    indices.push(idx);
    values.push((tf * (K1 + 1)) / (tf + K1 * norm));
  }
  return { indices, values };
}

/** Sparse vector for a search query. Pair with `weightingStrategy: WeightingStrategy.IDF`. */
export function querySparseVector(text: string): SparseVector {
  const indices = [...countTerms(tokenize(text)).keys()];
  return { indices, values: indices.map(() => 1) };
}
