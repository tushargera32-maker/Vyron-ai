export interface ChunkInput { content: string; content_raw?: string | null; token_estimate?: number | null; page_start?: number | null; page_end?: number | null; metadata_json?: string }

export function chunkText(text: string, opts?: { maxChars?: number; overlap?: number }): ChunkInput[] {
  const cleaned = (text || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!cleaned) return [];
  const maxChars = opts?.maxChars ?? 1200;
  const overlap = opts?.overlap ?? 150;
  const paragraphs = cleaned.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    const para = p.trim();
    if (!para) continue;
    if ((current + "\n\n" + para).trim().length <= maxChars) {
      current = (current ? current + "\n\n" : "") + para;
    } else {
      if (current) chunks.push(current.trim());
      if (para.length <= maxChars) {
        current = para;
      } else {
        // hard split long paragraph
        let i = 0;
        while (i < para.length) {
          const part = para.slice(i, i + maxChars);
          chunks.push(part.trim());
          i += Math.max(1, maxChars - overlap);
        }
        current = "";
      }
    }
  }
  if (current) chunks.push(current.trim());
  // add overlap between chunks
  if (overlap > 0 && chunks.length > 1) {
    const out: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      let c = chunks[i];
      if (i > 0) {
        const prev = chunks[i - 1];
        c = (prev.slice(-overlap) + "\n" + c).trim();
      }
      out.push(c);
    }
    return out.map((c) => ({ content: c, token_estimate: Math.ceil(c.length / 4) }));
  }
  return chunks.map((c) => ({ content: c, token_estimate: Math.ceil(c.length / 4) }));
}
