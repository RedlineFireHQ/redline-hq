"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PumpTestAttachmentPicker from "@/components/apparatus/PumpTestAttachmentPicker";
import { addAttachmentsToPumpTest } from "@/lib/pump-tests/client-upload";

export default function PumpTestAddAttachments({ pumpTestId }: { pumpTestId: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleUpload() {
    setIsUploading(true);
    setErrors([]);
    const { failures, attachedIndexes } = await addAttachmentsToPumpTest(pumpTestId, files);
    setIsUploading(false);
    setErrors(failures);
    // Keep only the files that did not attach, so a retry cannot create duplicates of the ones that did.
    setFiles(files.filter((_, index) => !attachedIndexes.includes(index)));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <PumpTestAttachmentPicker files={files} onChange={setFiles} disabled={isUploading} />
      {errors.length > 0 ? <p className="text-sm text-red-300">{errors.join(" ")}</p> : null}
      {files.length > 0 ? (
        <button
          type="button"
          disabled={isUploading}
          onClick={handleUpload}
          className="rounded-lg border border-emerald-500/40 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-70"
        >
          {isUploading ? "Uploading..." : `Upload ${files.length} ${files.length === 1 ? "file" : "files"}`}
        </button>
      ) : null}
    </div>
  );
}
