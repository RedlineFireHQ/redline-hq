"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PUMP_TEST_ACCEPT_ATTRIBUTE,
  PUMP_TEST_LIMITS_TEXT,
  PUMP_TEST_MAX_FILE_BYTES,
  PUMP_TEST_MAX_FILES,
  resolveDeclaredContentType,
} from "@/lib/pump-tests/attachments";

interface PumpTestAttachmentPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function PumpTestAttachmentPicker({ files, onChange, disabled }: PumpTestAttachmentPickerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const previews = useMemo(
    () => files.map((file) => (file.type.startsWith("image/") && file.type !== "image/heic" && file.type !== "image/heif" ? URL.createObjectURL(file) : null)),
    [files],
  );

  useEffect(() => () => previews.forEach((url) => url && URL.revokeObjectURL(url)), [previews]);

  function addFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;

    const accepted: File[] = [];
    const problems: string[] = [];

    for (const file of Array.from(selected)) {
      if (!resolveDeclaredContentType(file.name, file.type)) {
        problems.push(`${file.name} is not an allowed file type.`);
      } else if (file.size <= 0) {
        problems.push(`${file.name} is empty.`);
      } else if (file.size > PUMP_TEST_MAX_FILE_BYTES) {
        problems.push(`${file.name} is larger than ${PUMP_TEST_MAX_FILE_BYTES / (1024 * 1024)} MB.`);
      } else {
        accepted.push(file);
      }
    }

    const combined = [...files, ...accepted];
    if (combined.length > PUMP_TEST_MAX_FILES) {
      problems.push(`Only ${PUMP_TEST_MAX_FILES} files can be attached at a time.`);
    }

    onChange(combined.slice(0, PUMP_TEST_MAX_FILES));
    setMessage(problems.length > 0 ? problems.join(" ") : null);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Photos &amp; Documents</p>
      <p className="mt-1 text-xs text-neutral-400">Attach a photo of the pump-test certificate or report, or upload files. {PUMP_TEST_LIMITS_TEXT}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => cameraInputRef.current?.click()}
          className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
        >
          Take Photo
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
        >
          Choose Files
        </button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={PUMP_TEST_ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {message ? <p className="mt-3 text-xs text-amber-300">{message}</p> : null}

      {files.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#2E2E2E] p-2">
              {previews[index] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews[index] ?? ""} alt="" className="h-12 w-12 rounded object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded bg-neutral-800 text-[10px] font-semibold text-neutral-300">FILE</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">{file.name}</p>
                <p className="text-xs text-neutral-400">{formatSize(file.size)}</p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}
                className="rounded-lg border border-white/15 px-2 py-1 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-800 disabled:opacity-60"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
