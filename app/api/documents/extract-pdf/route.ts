import { createHash } from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const runtime = "nodejs";

type ExtractedPdfMetadata = {
  title: string;
  documentNumber: string;
  effectiveDate: string;
  revisionNumber: string;
  revisionDate: string;
  contentText: string;
};

type PdfRouteDiagnostics = {
  fileName: string;
  fileSize: number;
  sha256: string;
  parserMode: string;
  extractedCharacters: number;
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Extract text directly with PDF.js. This avoids spawning a child process,
 * which is unreliable in some serverless deployments, and provides a second
 * parser path when the legacy pdf-parse wrapper returns no usable text.
 */
async function extractPdfJsText(pdfBytes: Uint8Array): Promise<string> {
  const loadingTask = getDocument({
    data: pdfBytes,
    useSystemFonts: true,
    isEvalSupported: false,
  });

  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
        .filter(Boolean)
        .join(" ");
      if (pageText.trim()) pageTexts.push(pageText);
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }

  return pageTexts.join("\n").replace(/[\t\r ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

async function extractPdfText(pdfBuffer: Buffer): Promise<{ text: string; parserMode: string }> {
  // Keep the existing parser as the first pass for compatibility.
  try {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = pdfParseModule.default;
    const parsed = await pdfParse(pdfBuffer);
    const text = (parsed.text || "").replace(/\s+/g, " ").trim();
    if (text.length >= 20) return { text, parserMode: "pdf-parse" };
  } catch {
    // Fall through to PDF.js rather than failing the upload-time extraction.
  }

  const text = await extractPdfJsText(new Uint8Array(pdfBuffer));
  if (text.length < 20) {
    throw new Error(
      "No selectable text was found in this PDF. It may be a scanned/image-only document; OCR is required before its contents can be searched.",
    );
  }
  return { text, parserMode: "pdfjs-fallback" };
}

function extractMetadataFromText(textForSearch: string, fileName: string): ExtractedPdfMetadata {
  const documentNumberMatch =
    textForSearch.match(/(?:SOP|OPS|POLICY|PROTOCOL|STANDARD\s+OPERATING\s+PROCEDURE|EMS)[\s\-#:]*[A-Z0-9-]+(?:\d+[A-Z0-9-]*)?/i) ||
    textForSearch.match(/(?:SOP\s*[-#:]?\s*\d+[A-Z0-9-]*)/i) ||
    textForSearch.match(/(?:Document\s*Number\s*[:#-]?\s*[A-Z0-9-]+)/i);

  const revisionMatch = textForSearch.match(/(?:revision|rev\.)\s*[:#-]?\s*(\d+)/i);
  const dateMatch = textForSearch.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{1,2}\/\d{2})\b/);
  const fallbackTitle = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();

  return {
    title: fallbackTitle || "Untitled document",
    documentNumber: documentNumberMatch
      ? documentNumberMatch[0].replace(/^.*?(SOP|OPS|POLICY|PROTOCOL|EMS|Document\s*Number)/i, "$1").trim()
      : "",
    effectiveDate: dateMatch ? dateMatch[1] : "",
    revisionNumber: revisionMatch ? revisionMatch[1] : "",
    revisionDate: dateMatch ? dateMatch[1] : "",
    contentText: textForSearch,
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonResponse({ ok: false, error: "A PDF file is required." }, 400);
    }

    if (file.size === 0 || file.size > 50 * 1024 * 1024) {
      return jsonResponse({ ok: false, error: "The PDF must be between 1 byte and 50 MB." }, 400);
    }

    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractPdfText(pdfBuffer);
    const metadata = extractMetadataFromText(extracted.text, file.name);
    const diagnostics: PdfRouteDiagnostics = {
      fileName: file.name,
      fileSize: file.size,
      sha256: createHash("sha256").update(pdfBuffer).digest("hex"),
      parserMode: extracted.parserMode,
      extractedCharacters: extracted.text.length,
    };

    if (process.env.PDF_EXTRACT_DEBUG === "1") {
      console.info("[extract-pdf] diagnostics", diagnostics);
    }

    return jsonResponse(
      process.env.PDF_EXTRACT_DEBUG === "1"
        ? { ok: true, data: metadata, diagnostics }
        : { ok: true, data: metadata },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to extract text from PDF.";
    return jsonResponse({ ok: false, error: message }, 200);
  }
}
