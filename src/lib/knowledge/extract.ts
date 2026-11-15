import "server-only";
import mammoth from "mammoth";

export async function extractTextFromBuffer(buffer: Buffer, sourceType: string, mimeType: string): Promise<{ text: string; meta?: Record<string, unknown> }> {
  const t = sourceType.toLowerCase();
  if (t === "text" || t === "txt" || mimeType === "text/plain") {
    return { text: buffer.toString("utf8") };
  }
  if (t === "markdown" || t === "md" || mimeType === "text/markdown" || mimeType === "text/x-markdown") {
    return { text: buffer.toString("utf8") };
  }
  if (t === "pdf" || mimeType === "application/pdf") {
    try {
      const mod: any = await import("pdf-parse");
      const pdfParse = mod.default || mod;
      const data = await pdfParse(buffer);
      return { text: data?.text || "", meta: { pages: data?.numpages } };
    } catch (e) {
      throw new Error(`PDF extraction failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (t === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const res = await mammoth.extractRawText({ buffer });
    return { text: res.value || "", meta: { messages: res.messages } };
  }
  throw new Error(`Unsupported document type: ${sourceType}`);
}
