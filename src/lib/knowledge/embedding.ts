// Lightweight local deterministic embedding fallback (provider-independent, no paid API).
// Produces a fixed-dimension vector via token hashing; suitable for basic semantic-like similarity.

const DIMS = 128;

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).slice(0, 2000);
}

function hashToken(t: string) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function localEmbed(text: string): number[] {
  const vec = new Array<number>(DIMS).fill(0);
  const tokens = tokenize(text);
  for (const tok of tokens) {
    const h = hashToken(tok);
    const idx = h % DIMS;
    const sign = (h & 1) === 0 ? 1 : -1;
    vec[idx] += sign;
  }
  // l2 normalize
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export const LOCAL_EMBEDDING_PROVIDER = "local";
export const LOCAL_EMBEDDING_MODEL = "hash-128";
export const LOCAL_EMBEDDING_DIMS = DIMS;
