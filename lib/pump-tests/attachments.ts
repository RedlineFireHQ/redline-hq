export const PUMP_TEST_ATTACHMENTS_BUCKET = "pump-test-attachments";
export const PUMP_TEST_MAX_FILE_BYTES = 15 * 1024 * 1024;
export const PUMP_TEST_MAX_FILES = 10;
export const PUMP_TEST_MAX_ATTACHMENTS_PER_TEST = 25;
export const PUMP_TEST_SIGNED_URL_SECONDS = 120;

export type PumpTestFileType = {
  contentType: string;
  extension: string;
  kind: "photo" | "document";
};

const FILE_TYPES: Record<string, PumpTestFileType> = {
  "application/pdf": { contentType: "application/pdf", extension: "pdf", kind: "document" },
  "image/jpeg": { contentType: "image/jpeg", extension: "jpg", kind: "photo" },
  "image/png": { contentType: "image/png", extension: "png", kind: "photo" },
  "image/webp": { contentType: "image/webp", extension: "webp", kind: "photo" },
  "image/heic": { contentType: "image/heic", extension: "heic", kind: "photo" },
  "image/heif": { contentType: "image/heif", extension: "heif", kind: "photo" },
};

const EXTENSION_TO_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export const PUMP_TEST_ACCEPT_ATTRIBUTE = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif";
export const PUMP_TEST_LIMITS_TEXT = "PDF, JPG, PNG, WEBP or HEIC files. Up to 10 files, 15 MB each.";

export function getPumpTestFileType(contentType: string): PumpTestFileType | null {
  return FILE_TYPES[contentType.trim().toLowerCase()] ?? null;
}

// Browsers sometimes report an empty or generic type (common for HEIC), so fall back to the extension.
export function resolveDeclaredContentType(fileName: string, declaredType: string): string | null {
  const normalized = declaredType.trim().toLowerCase();
  if (FILE_TYPES[normalized]) {
    return normalized;
  }

  const extension = fileName.split(".").pop()?.trim().toLowerCase() ?? "";
  return EXTENSION_TO_TYPE[extension] ?? null;
}

// Identifies the real file type from its first bytes so a renamed file cannot pass as a PDF or image.
export function detectContentType(bytes: Uint8Array): string | null {
  const startsWith = (signature: number[], offset = 0) =>
    bytes.length >= offset + signature.length && signature.every((value, index) => bytes[offset + index] === value);

  if (startsWith([0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";

  if (startsWith([0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = String.fromCharCode(...Array.from(bytes.slice(8, 12)));
    if (["heic", "heix", "hevc", "hevx", "heim", "heis"].includes(brand)) return "image/heic";
    if (["mif1", "msf1", "heif"].includes(brand)) return "image/heif";
  }

  return null;
}

export function contentTypesMatch(declaredType: string, detectedType: string): boolean {
  const heicFamily = new Set(["image/heic", "image/heif"]);
  return declaredType === detectedType || (heicFamily.has(declaredType) && heicFamily.has(detectedType));
}

export function sanitizeDisplayFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>:|?*]/g, "").replace(/\s+/g, " ").trim();
  return (cleaned || "attachment").slice(0, 150);
}

export type DeclaredFile = { name: string; type: string; size: number };

export type ValidatedDeclaredFile = {
  originalName: string;
  contentType: string;
  extension: string;
  kind: "photo" | "document";
  size: number;
};

export function validateDeclaredFiles(files: unknown): { ok: true; files: ValidatedDeclaredFile[] } | { ok: false; error: string } {
  if (files === undefined || files === null) {
    return { ok: true, files: [] };
  }

  if (!Array.isArray(files)) {
    return { ok: false, error: "Files must be a list." };
  }

  if (files.length > PUMP_TEST_MAX_FILES) {
    return { ok: false, error: `You can attach at most ${PUMP_TEST_MAX_FILES} files at a time.` };
  }

  const validated: ValidatedDeclaredFile[] = [];

  for (const raw of files) {
    const file = raw as Partial<DeclaredFile> | null;
    const name = typeof file?.name === "string" ? file.name : "";
    const size = typeof file?.size === "number" ? file.size : Number.NaN;
    const resolvedType = resolveDeclaredContentType(name, typeof file?.type === "string" ? file.type : "");
    const fileType = resolvedType ? getPumpTestFileType(resolvedType) : null;
    const label = sanitizeDisplayFileName(name);

    if (!fileType) {
      return { ok: false, error: `"${label}" is not an allowed file type. ${PUMP_TEST_LIMITS_TEXT}` };
    }

    if (!Number.isFinite(size) || size <= 0) {
      return { ok: false, error: `"${label}" is empty.` };
    }

    if (size > PUMP_TEST_MAX_FILE_BYTES) {
      return { ok: false, error: `"${label}" is larger than the ${PUMP_TEST_MAX_FILE_BYTES / (1024 * 1024)} MB limit.` };
    }

    validated.push({ originalName: label, contentType: fileType.contentType, extension: fileType.extension, kind: fileType.kind, size });
  }

  return { ok: true, files: validated };
}

const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function buildPumpTestStoragePath(departmentId: string, pumpTestId: string, extension: string, fileId: string = crypto.randomUUID()) {
  return `${departmentId}/pump-tests/${pumpTestId}/${fileId}.${extension}`;
}

export function isPumpTestStoragePath(path: unknown, departmentId: string, pumpTestId: string): path is string {
  if (typeof path !== "string") {
    return false;
  }

  const expected = new RegExp(`^${departmentId}/pump-tests/${pumpTestId}/${UUID_PATTERN}\\.(pdf|jpg|png|webp|heic|heif)$`);
  return expected.test(path);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && new RegExp(`^${UUID_PATTERN}$`).test(value);
}
