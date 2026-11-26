"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type Props = {
  title: string;
  subtitle?: string | null;
  value: string;
  onClose: () => void;
};

type LabelPreset = "0.75" | "1" | "1.5" | "2" | "custom";

const PRESETS: Array<{ value: LabelPreset; label: string; inches: number }> = [
  { value: "0.75", label: "¾ × ¾ in", inches: 0.75 },
  { value: "1", label: "1 × 1 in", inches: 1 },
  { value: "1.5", label: "1.5 × 1.5 in", inches: 1.5 },
  { value: "2", label: "2 × 2 in", inches: 2 },
];

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

export default function QrLabelDialog({ title, subtitle, value, onClose }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<LabelPreset>("1.5");
  const [customWidth, setCustomWidth] = useState("1.5");
  const [customHeight, setCustomHeight] = useState("1.5");

  const dimensions = useMemo(() => {
    if (preset !== "custom") {
      const selected = PRESETS.find((item) => item.value === preset);
      return { width: selected?.inches ?? 1.5, height: selected?.inches ?? 1.5, valid: true };
    }
    const width = Number(customWidth);
    const height = Number(customHeight);
    const valid =
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width >= 0.5 &&
      height >= 0.5 &&
      width <= 4 &&
      height <= 4;
    return { width, height, valid };
  }, [preset, customWidth, customHeight]);

  useEffect(() => {
    let active = true;
    setDataUrl(null);
    setError(null);
    QRCode.toDataURL(value, { errorCorrectionLevel: "H", margin: 2, width: 600 })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setError("Unable to generate QR code.");
      });
    return () => {
      active = false;
    };
  }, [value]);

  function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.trim().split(/\\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function createLabelPdf(imageData: ImageData, widthInches: number, heightInches: number): Blob {
    const { width: pixelWidth, height: pixelHeight, data } = imageData;
    const rgb = new Uint8Array(pixelWidth * pixelHeight * 3);
    for (let source = 0, target = 0; source < data.length; source += 4) {
      rgb[target++] = data[source];
      rgb[target++] = data[source + 1];
      rgb[target++] = data[source + 2];
    }

    const pageWidth = widthInches * 72;
    const pageHeight = heightInches * 72;
    const content = `q\\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\\n/Im0 Do\\nQ\\n`;
    const encoder = new TextEncoder();
    const objects: Uint8Array[] = [];
    const stream = (header: string, bytes: Uint8Array) => {
      const prefix = encoder.encode(`${header}\\nstream\\n`);
      const suffix = encoder.encode("\\nendstream");
      const combined = new Uint8Array(prefix.length + bytes.length + suffix.length);
      combined.set(prefix, 0);
      combined.set(bytes, prefix.length);
      combined.set(suffix, prefix.length + bytes.length);
      return combined;
    };
    objects.push(encoder.encode("<< /Type /Catalog /Pages 2 0 R >>"));
    objects.push(encoder.encode("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"));
    objects.push(encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
    objects.push(stream(`<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${rgb.length} >>`, rgb));
    const contentBytes = encoder.encode(content);
    objects.push(stream(`<< /Length ${contentBytes.length} >>`, contentBytes));

    const chunks: Uint8Array[] = [encoder.encode("%PDF-1.4\\n% RedlineHQ\\n")];
    const offsets = [0];
    let length = chunks[0].length;
    objects.forEach((object, index) => {
      offsets.push(length);
      const chunk = new Uint8Array(encoder.encode(`${index + 1} 0 obj\\n`).length + object.length + encoder.encode("\\nendobj\\n").length);
      const head = encoder.encode(`${index + 1} 0 obj\\n`);
      const tail = encoder.encode("\\nendobj\\n");
      chunk.set(head, 0);
      chunk.set(object, head.length);
      chunk.set(tail, head.length + object.length);
      chunks.push(chunk);
      length += chunk.length;
    });
    const xrefOffset = length;
    let xref = `xref\\n0 ${objects.length + 1}\\n0000000000 65535 f \\n`;
    for (let index = 1; index < offsets.length; index++) {
      xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \\n`;
    }
    xref += `trailer\\n<< /Size ${objects.length + 1} /Root 1 0 R >>\\nstartxref\\n${xrefOffset}\\n%%EOF`;
    chunks.push(encoder.encode(xref));
    return new Blob(chunks.map((chunk) => chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer), { type: "application/pdf" });
  }

  function renderLabelPdf(onReady: (blob: Blob) => void) {
    if (!dataUrl || !dimensions.valid) return;
    const dpi = 300;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(dimensions.width * dpi);
    canvas.height = Math.round(dimensions.height * dpi);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const qr = new Image();
    qr.onload = () => {
      context.fillStyle = "#111";
      context.textAlign = "center";
      context.textBaseline = "top";
      const margin = Math.max(12, Math.round(0.045 * dpi));
      const maxTextWidth = canvas.width - margin * 2;
      const titleSize = Math.max(17, Math.min(29, Math.round(dimensions.width * 17)));
      context.font = `700 ${titleSize}px Arial, sans-serif`;
      let y = margin;
      for (const line of wrapCanvasText(context, title, maxTextWidth)) {
        context.fillText(line, canvas.width / 2, y, maxTextWidth);
        y += titleSize + 2;
      }
      if (subtitle?.trim()) {
        const subSize = Math.max(14, Math.round(titleSize * 0.8));
        context.font = `600 ${subSize}px Arial, sans-serif`;
        for (const line of wrapCanvasText(context, subtitle.trim(), maxTextWidth)) {
          context.fillText(line, canvas.width / 2, y, maxTextWidth);
          y += subSize + 2;
        }
      }
      const qrSize = Math.min(
        Math.round(Math.min(dimensions.width, dimensions.height) * dpi * 0.66),
        canvas.width - margin * 2,
        canvas.height - y - margin,
      );
      if (qrSize < Math.round(0.6 * dpi)) return;
      context.imageSmoothingEnabled = false;
      context.drawImage(qr, Math.round((canvas.width - qrSize) / 2), y + Math.max(0, Math.round((canvas.height - y - margin - qrSize) / 2)), qrSize, qrSize);
      const pdf = createLabelPdf(context.getImageData(0, 0, canvas.width, canvas.height), dimensions.width, dimensions.height);
      onReady(pdf);
    };
    qr.onerror = () => setError("Unable to prepare the QR label PDF.");
    qr.src = dataUrl;
  }

  function downloadLabel() {
    renderLabelPdf((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${dimensions.width}x${dimensions.height}-label.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    });
  }

  function printLabel() {
    renderLabelPdf((blob) => {
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, "_blank");
      if (!printWindow) {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${dimensions.width}x${dimensions.height}-label.pdf`;
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-6" role="dialog" aria-modal="true" aria-label={`${title} QR code`}>
      <section className="my-auto w-full max-w-xl rounded-2xl border border-white/12 bg-[#171717] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Redline HQ</p>
            <h2 className="mt-2 text-xl font-black text-white">QR Label</h2>
            <p className="mt-1 text-sm text-white/70">{title}</p>
            {subtitle?.trim() ? <p className="text-sm text-white/60">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-xl border border-white/15 text-white/70" aria-label="Close QR label">X</button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {PRESETS.map((item) => (
            <button key={item.value} type="button" onClick={() => setPreset(item.value)} aria-pressed={preset === item.value}
              className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${preset === item.value ? "border-red-400 bg-red-500/15 text-white" : "border-white/15 bg-white/5 text-white/70"}`}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <button type="button" onClick={() => setPreset("custom")} aria-pressed={preset === "custom"}
            className={`min-h-11 w-full rounded-lg border px-3 text-sm font-semibold ${preset === "custom" ? "border-red-400 bg-red-500/15 text-white" : "border-white/15 bg-white/5 text-white/70"}`}>
            Custom size
          </button>
        </div>
        {preset === "custom" ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-white/70">Width (inches)
              <input type="number" min="0.5" max="4" step="0.1" value={customWidth} onChange={(event) => setCustomWidth(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-xs font-semibold text-white/70">Height (inches)
              <input type="number" min="1" max="4" step="0.1" value={customHeight} onChange={(event) => setCustomHeight(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
            </label>
          </div>
        ) : null}
        {!dimensions.valid ? <p className="mt-2 text-xs text-red-300">Enter a width and height from ½ to 4 inches.</p> : null}

        <div className="mt-5 rounded-xl border border-white/10 bg-white p-4">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">Label preview · {dimensions.valid ? `${dimensions.width} × ${dimensions.height} in` : "Invalid size"}</p>
          <div className="mx-auto flex max-w-full flex-col items-center justify-between overflow-hidden bg-white p-2 text-center text-black shadow-sm transition-[width] duration-200"
            style={{
              width: dimensions.valid ? `${Math.min(280, Math.max(120, dimensions.width * 120))}px` : "180px",
              aspectRatio: dimensions.valid ? `${dimensions.width} / ${dimensions.height}` : "1 / 1",
            }}>
            <div className="w-full leading-tight">
              <p className="break-words text-sm font-bold">{title}</p>
              {subtitle?.trim() ? <p className="mt-0.5 break-words text-xs font-semibold">{subtitle}</p> : null}
            </div>
            {dataUrl ? <img src={dataUrl} alt={`${title} QR code`} className="my-1 aspect-square max-h-[72%] max-w-[72%] object-contain" /> : <p className="text-xs text-neutral-500">Generating QR code...</p>}
          </div>
        </div>
        {error ? <p className="mt-3 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</p> : null}
        <p className="mt-3 break-all text-xs text-white/40">QR data: {value}</p>
        <div className="mt-5 flex gap-2">
          {dataUrl ? <button type="button" onClick={downloadLabel} disabled={!dimensions.valid} className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-black text-white disabled:opacity-40">Download PDF</button> : null}
          <button type="button" onClick={printLabel} disabled={!dataUrl || !dimensions.valid} className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-red-600 px-3 text-sm font-black text-white disabled:bg-white/15 disabled:text-white/40">Print Label</button>
        </div>
      </section>
    </div>
  );
}
