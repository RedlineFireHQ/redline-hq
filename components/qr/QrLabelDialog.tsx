"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type Props = {
  title: string;
  subtitle?: string | null;
  value: string;
  onClose: () => void;
};

type LabelPreset = "1" | "1.5" | "2" | "custom";

const PRESETS: Array<{ value: LabelPreset; label: string; inches: number }> = [
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
      width >= 1 &&
      height >= 1 &&
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

  function downloadLabel() {
    if (!dataUrl || !dimensions.valid) return;
    const dpi = 300;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(dimensions.width * dpi);
    canvas.height = Math.round(dimensions.height * dpi);
    const context = canvas.getContext("2d");
    if (!context) return;

    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#111";
    context.textAlign = "center";
    context.textBaseline = "top";

    const margin = Math.round(0.055 * dpi);
    const maxTextWidth = canvas.width - margin * 2;
    const fontSize = Math.max(20, Math.min(32, Math.round(dimensions.width * 18)));
    context.font = `700 ${fontSize}px Arial, sans-serif`;
    context.fillText(title, canvas.width / 2, margin, maxTextWidth);

    let textBottom = margin + fontSize + 3;
    if (subtitle?.trim()) {
      const subtitleSize = Math.max(18, Math.min(29, Math.round(dimensions.width * 16)));
      context.font = `600 ${subtitleSize}px Arial, sans-serif`;
      context.fillText(subtitle.trim(), canvas.width / 2, textBottom, maxTextWidth);
      textBottom += subtitleSize + 3;
    }

    const qrImage = new Image();
    qrImage.onload = () => {
      const availableHeight = canvas.height - textBottom - margin;
      const qrSize = Math.min(
        Math.round(Math.min(dimensions.width, dimensions.height) * dpi * 0.68),
        availableHeight,
        canvas.width - margin * 2,
      );
      if (qrSize < Math.round(0.6 * dpi)) return;
      const x = Math.round((canvas.width - qrSize) / 2);
      const y = textBottom + Math.max(0, Math.round((availableHeight - qrSize) / 2));
      context.imageSmoothingEnabled = false;
      context.drawImage(qrImage, x, y, qrSize, qrSize);
      const link = document.createElement("a");
      link.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-label.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    qrImage.src = dataUrl;
  }

  function printLabel() {
    if (!dataUrl || !dimensions.valid) return;
    const safeTitle = escapeHtml(title);
    const safeSubtitle = subtitle?.trim() ? escapeHtml(subtitle.trim()) : "";
    const width = dimensions.width;
    const height = dimensions.height;
    const qrSize = Math.max(0.68, Math.min(width, height) * 0.68);
    const printWindow = window.open("", "_blank", "width=520,height=680");
    if (!printWindow) return;

    printWindow.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${safeTitle} QR Label</title>
<style>
@page { size: ${width}in ${height}in; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; width: ${width}in; height: ${height}in; }
.label { width: ${width}in; height: ${height}in; padding: 0.055in; display: flex; flex-direction: column; align-items: center; justify-content: space-between; overflow: hidden; font-family: Arial, sans-serif; color: #111; text-align: center; }
.title, .subtitle { width: 100%; margin: 0; line-height: 1.05; overflow-wrap: anywhere; }
.title { font-size: ${Math.max(7, Math.min(11, width * 6.2))}pt; font-weight: 700; }
.subtitle { font-size: ${Math.max(7, Math.min(10, width * 5.7))}pt; font-weight: 600; }
.copy { width: 100%; display: flex; flex-direction: column; gap: 0.015in; flex: 0 0 auto; }
.qr { width: ${qrSize}in; height: ${qrSize}in; object-fit: contain; flex: 0 0 auto; }
@media screen { body { background: #eee; } .label { background: #fff; margin: 18px auto; box-shadow: 0 1px 8px #999; } }
</style></head><body>
<div class="label"><div class="copy"><p class="title">${safeTitle}</p>${safeSubtitle ? `<p class="subtitle">${safeSubtitle}</p>` : ""}</div>
<img class="qr" src="${dataUrl}" alt="QR code">
</div>
<script>window.addEventListener("load", () => { setTimeout(() => window.print(), 250); });</script>
</body></html>`);
    printWindow.document.close();
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
              <input type="number" min="1" max="4" step="0.1" value={customWidth} onChange={(event) => setCustomWidth(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-xs font-semibold text-white/70">Height (inches)
              <input type="number" min="1" max="4" step="0.1" value={customHeight} onChange={(event) => setCustomHeight(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
            </label>
          </div>
        ) : null}
        {!dimensions.valid ? <p className="mt-2 text-xs text-red-300">Enter a width and height from 1 to 4 inches.</p> : null}

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
          {dataUrl ? <button type="button" onClick={downloadLabel} disabled={!dimensions.valid} className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-black text-white disabled:opacity-40">Download Label</button> : null}
          <button type="button" onClick={printLabel} disabled={!dataUrl || !dimensions.valid} className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-red-600 px-3 text-sm font-black text-white disabled:bg-white/15 disabled:text-white/40">Print Label</button>
        </div>
      </section>
    </div>
  );
}
