import { supabase } from "@/lib/supabase";
import { PUMP_TEST_ATTACHMENTS_BUCKET, resolveDeclaredContentType } from "@/lib/pump-tests/attachments";

type UploadSlot = { index: number; path: string; token: string };

export type AttachmentUploadResult = {
  // Human-readable problems, one per file that did not end up attached.
  failures: string[];
  // Positions (in the files array that was passed in) of files that are now attached.
  attachedIndexes: number[];
};

// Sends files straight to storage using one-time slots from the server, then asks the server to verify and register them.
// Never throws: every problem comes back as a readable message so the caller can keep the saved pump test.
export async function uploadAndRegisterAttachments(pumpTestId: string, files: File[], slots: UploadSlot[]): Promise<AttachmentUploadResult> {
  const failures: string[] = [];
  const attachedIndexes: number[] = [];
  const uploaded: Array<{ path: string; name: string; type: string; index: number }> = [];

  for (const slot of slots) {
    const file = files[slot.index];
    if (!file) continue;

    // Browsers often report HEIC photos with an empty type; storage only accepts a known one.
    const contentType = resolveDeclaredContentType(file.name, file.type) ?? file.type;

    try {
      const { error } = await supabase.storage
        .from(PUMP_TEST_ATTACHMENTS_BUCKET)
        .uploadToSignedUrl(slot.path, slot.token, file, { contentType });

      if (error) {
        failures.push(`${file.name}: upload failed.`);
        continue;
      }
    } catch {
      failures.push(`${file.name}: upload failed.`);
      continue;
    }

    uploaded.push({ path: slot.path, name: file.name, type: contentType, index: slot.index });
  }

  if (uploaded.length > 0) {
    try {
      const response = await fetch(`/api/apparatus/pump-tests/${pumpTestId}/attachments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files: uploaded.map(({ path, name, type }) => ({ path, name, type })) }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        attached?: Array<{ id: string; name: string }>;
        failed?: Array<{ name: string; path: string | null; error: string }>;
      } | null;

      if (result && Array.isArray(result.failed)) {
        const failedPaths = new Set(result.failed.map((item) => item.path));
        failures.push(...result.failed.map((item) => `${item.name}: ${item.error}`));
        attachedIndexes.push(...uploaded.filter((item) => !failedPaths.has(item.path)).map((item) => item.index));
      } else if (response.ok) {
        attachedIndexes.push(...uploaded.map((item) => item.index));
      } else {
        failures.push(result?.error || "Unable to save attachments.");
      }
    } catch {
      failures.push("Unable to confirm the attachments. Open the pump test to check which files were saved.");
    }
  }

  return { failures, attachedIndexes };
}

export async function addAttachmentsToPumpTest(pumpTestId: string, files: File[]): Promise<AttachmentUploadResult> {
  try {
    const response = await fetch(`/api/apparatus/pump-tests/${pumpTestId}/attachments/uploads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ files: files.map((file) => ({ name: file.name, type: file.type, size: file.size })) }),
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; uploads?: UploadSlot[] } | null;

    if (!response.ok || !result?.ok || !result.uploads) {
      return { failures: [result?.error || "Unable to prepare file upload."], attachedIndexes: [] };
    }

    return await uploadAndRegisterAttachments(pumpTestId, files, result.uploads);
  } catch {
    return { failures: ["Unable to reach the server. Check your connection and try again."], attachedIndexes: [] };
  }
}
