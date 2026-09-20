"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  title: string;
  subtitle?: string | null;
  value: string;
  onClose: () => void;
};

export default function QrLabelDialog({ title, subtitle, value, onClose }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setDataUrl(null);
    setError(null);
    QRCode.toDataURL(value, { errorCorrectionLevel: "H", margin: 2, width: 420 })
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

  function printLabel() {
    if (!dataUrl) return;
    const printWindow = window.open("", "_blank", "width=520,height=680");
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:32px;color:#111}img{width:320px;height:320px}h1{font-size:24px;margin:0 0 8px}p{font-size:14px;margin:8px 0;word-break:break-all}</style></head><body><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ""}<img src="${dataUrl}" alt="QR code" /><p>${value}</p></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6" role="dialog" aria-modal="true" aria-label={`${title} QR code`}>
      <section className="w-full max-w-md rounded-2xl border border-white/12 bg-[#171717] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Redline HQ</p>
            <h2 className="mt-2 text-xl font-black text-white">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-white/60">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-xl border border-white/15 text-white/70" aria-label="Close QR label">X</button>
        </div>
        {error ? <p className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</p> : null}
        {dataUrl ? <div className="mt-5 rounded-xl bg-white p-4"><img src={dataUrl} alt={`${title} QR code`} className="mx-auto aspect-square w-full max-w-[320px]" /></div> : <p className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">Generating QR code...</p>}
        <p className="mt-4 break-all text-xs text-white/50">{value}</p>
        <div className="mt-5 flex gap-2">
          {dataUrl ? <a href={dataUrl} download={`${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-qr.png`} className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-black text-white">Download</a> : null}
          <button type="button" onClick={printLabel} disabled={!dataUrl} className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-red-600 px-3 text-sm font-black text-white disabled:bg-white/15 disabled:text-white/40">Print Label</button>
        </div>
      </section>
    </div>
  );
}