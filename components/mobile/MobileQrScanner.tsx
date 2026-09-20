"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Search } from "lucide-react";
import type { QrResolvedObject } from "@/lib/qr-identifiers";

type Props = {
  onResolved: (result: QrResolvedObject) => void;
  onFallback: () => void;
};

export default function MobileQrScanner({ onResolved, onFallback }: Props) {
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const [status, setStatus] = useState("Requesting camera access...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!active) return;
        scanner = new Html5Qrcode("mobile-qr-reader");
        scannerRef.current = scanner;
        await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 }, async (decodedText) => {
          if (!active || !scanner) return;
          setStatus("Code found. Loading field action...");
          try {
            const response = await fetch(`/api/mobile/qr/resolve?value=${encodeURIComponent(decodedText)}`, { cache: "no-store" });
            const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; result?: QrResolvedObject; error?: string };
            if (!response.ok || !payload.ok || !payload.result) {
              setError(payload.error || "QR code not recognized.");
              setStatus("Ready to scan again.");
              return;
            }
            await scanner.stop();
            scanner.clear();
            scannerRef.current = null;
            onResolved(payload.result);
          } catch {
            setError("QR code could not be resolved.");
            setStatus("Ready to scan again.");
          }
        }, () => undefined);
        if (active) setStatus("Align the QR code inside the frame.");
      } catch {
        if (active) {
          setError("Camera access is unavailable. Use the field actions below instead.");
          setStatus("Camera unavailable");
        }
      }
    };
    void startScanner();
    return () => {
      active = false;
      const currentScanner = scannerRef.current;
      if (currentScanner) void currentScanner.stop().catch(() => undefined).finally(() => currentScanner.clear());
      scannerRef.current = null;
    };
  }, [onResolved]);

  return <main className="min-h-screen overflow-x-hidden bg-[#080808] px-4 py-5 text-white sm:px-6"><div className="mx-auto max-w-2xl space-y-4 pb-5"><button type="button" onClick={onFallback} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white/60"><ArrowLeft className="h-4 w-4" />Back to Field Actions</button><header><p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-300">Field Tool</p><h1 className="mt-2 text-3xl font-black">Scan</h1><p className="mt-2 text-sm leading-6 text-white/55">Scan a supply or apparatus QR to open its field workflow.</p></header>{error ? <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">{error}</div> : null}<section className="rounded-[24px] border border-white/12 bg-[#121212] p-4"><div className="relative overflow-hidden rounded-[20px] border border-red-400/30 bg-black"><div id="mobile-qr-reader" className="min-h-[290px] w-full" /><div className="pointer-events-none absolute inset-[12%] rounded-2xl border-2 border-red-400/70 shadow-[0_0_0_999px_rgba(0,0,0,0.38)]" /></div><div className="mt-4 flex items-center gap-3 text-sm text-white/60"><Camera className="h-5 w-5 shrink-0 text-red-300" /><span>{status}</span></div></section><button type="button" onClick={onFallback} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-[#151515] px-4 text-sm font-black uppercase tracking-[0.1em] text-white"><Search className="h-4 w-4" />Back to Field Actions</button></div></main>;
}