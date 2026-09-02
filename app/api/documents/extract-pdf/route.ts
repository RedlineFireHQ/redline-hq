import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

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
  arrayBufferByteLength: number;
  bufferByteLength: number;
  first16Hex: string;
  sha256: string;
  parserMode: string;
};

type ChildParsePayload = {
  ok: boolean;
  text?: string;
  error?: string;
};

function firstBytesHex(bytes: Uint8Array, count = 16): string {
  return Array.from(bytes.slice(0, count))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

async function parsePdfInIsolatedNodeProcess(pdfBuffer: Buffer): Promise<string> {
  const script = [
    "const inputBase64 = process.argv[1] || '';",
    "const inputBuffer = Buffer.from(inputBase64, 'base64');",
    "(async () => {",
    "  try {",
    "    const pdfParse = require('pdf-parse');",
    "    const parsed = await pdfParse(inputBuffer);",
    "    process.stdout.write(JSON.stringify({ ok: true, text: parsed.text || '' }));",
    "  } catch (error) {",
    "    const message = error instanceof Error ? error.message : String(error);",
    "    process.stdout.write(JSON.stringify({ ok: false, error: message }));",
    "    process.exitCode = 1;",
    "  }",
    "})();",
  ].join("\n");

  const { stdout, stderr } = await execFileAsync(process.execPath, ["-e", script, pdfBuffer.toString("base64")], {
    maxBuffer: 20 * 1024 * 1024,
  });

  const payload = JSON.parse(stdout || "{}") as ChildParsePayload;
  if (!payload.ok) {
    throw new Error(payload.error || stderr || "Unable to extract text from PDF.");
  }

  return (payload.text || "").replace(/\s+/g, " ").trim();
}

function extractMetadataFromText(textForSearch: string, fileName: string): ExtractedPdfMetadata {
  const documentNumberMatch =
    textForSearch.match(/(?:SOP|OPS|POLICY|PROTOCOL|STANDARD\s+OPERATING\s+PROCEDURE|EMS)[\s\-#:]*[A-Z0-9-]+(?:\d+[A-Z0-9-]*)?/i) ||
    textForSearch.match(/(?:SOP\s*[-#:]?\s*\d+[A-Z0-9-]*)/i) ||
    textForSearch.match(/(?:Document\s*Number\s*[:#-]?\s*[A-Z0-9-]+)/i);

  const revisionMatch = textForSearch.match(/(?:revision|rev\.)\s*[:#-]?\s*(\d+)/i);
  const dateMatch = textForSearch.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{1,2}\/\d{2})\b/);

  const fallbackTitle = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  const title = fallbackTitle || "Untitled document";

  const documentNumber = documentNumberMatch
    ? documentNumberMatch[0]
        .replace(/^.*?(SOP|OPS|POLICY|PROTOCOL|EMS|Document\s*Number)/i, "$1")
        .trim()
    : "";
  const effectiveDate = dateMatch ? dateMatch[1] : "";
  const revisionNumber = revisionMatch ? revisionMatch[1] : "";

  return {
    title,
    documentNumber,
    effectiveDate,
    revisionNumber,
    revisionDate: effectiveDate || "",
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

    const fileArrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(fileArrayBuffer);
    const diagnostics: PdfRouteDiagnostics = {
      fileName: file.name,
      fileSize: file.size,
      arrayBufferByteLength: fileArrayBuffer.byteLength,
      bufferByteLength: pdfBuffer.byteLength,
      first16Hex: firstBytesHex(pdfBuffer),
      sha256: createHash("sha256").update(pdfBuffer).digest("hex"),
      parserMode: "isolated-node-pdf-parse",
    };

    if (process.env.PDF_EXTRACT_DEBUG === "1") {
      console.info("[extract-pdf] diagnostics", diagnostics);
    }

    const contentText = await parsePdfInIsolatedNodeProcess(pdfBuffer);
    const metadata = extractMetadataFromText(contentText || "", file.name);

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
