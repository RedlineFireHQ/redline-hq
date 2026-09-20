"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Search } from "lucide-react";
import type { SupplyItem } from "@/components/mobile/MobileEmsSupplies";

type Props = {
  onResolved: (item: SupplyItem) => void;
  onFallback: () => void;
  onFinish?: () => void;
  sessionCount?: number;
};

export default function MobileEmsQrScanner({ onResolved, onFallback, onFinish, sessionCount = 0 }: Props) {
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
        scanner = new Html5Qrcode("ems-supply-qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
          async (decodedText) => {
            if (!active || !scanner) return;
            setStatus("Supply found. Loading details...");
            try {
              const response = await fetch(`/api/ems/supplies/qr?value=${encodeURIComponent(decodedText)}`, { cache: "no-store" });
              const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; item?: SupplyItem; error?: string };
              if (!response.ok || !payload.ok || !payload.item) {
                setError("Supply QR not recognized.");
                setStatus("Ready to scan again.");
                return;
              }
              await scanner.stop();
              scanner.clear();
              scannerRef.current = null;
              onResolved(payload.item);
            } catch {
              setError("Supply QR not recognized.");
              setStatus("Ready to scan again.");
            }
          },
          () => undefined,
        );
        if (active) setStatus("Align the supply QR inside the frame.");
      } catch {
        if (active) {
          setError("Camera access is unavailable. Use Search Supplies instead.");
          setStatus("Camera unavailable");
        }
      }
    };

    void startScanner();
    return () => {
      active = false;
      const currentScanner = scannerRef.current;
      if (currentScanner) {
        void currentScanner.stop().catch(() => undefined).finally(() => currentScanner.clear());
        scannerRef.current = null;
      }
    };
  }, [onResolved]);

  return <main className="min-h-screen overflow-x-hidden bg-[#080808] px-4 py-5 text-white sm:px-6"><div className="mx-auto max-w-2xl space-y-4 pb-5"><div className="flex items-center justify-between gap-3"><button type="button" onClick={onFallback} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white/60"><ArrowLeft className="h-4 w-4" />Search Supplies Instead</button>{onFinish && sessionCount > 0 ? <button type="button" onClick={onFinish} className="min-h-11 rounded-xl border border-red-400/35 bg-red-500/12 px-3 text-xs font-black uppercase tracking-[0.08em] text-red-100">Finish Session</button> : null}</div><header><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff6565]">EMS Operations</p><h1 className="mt-2 text-3xl font-black">Scan Supply</h1><p className="mt-2 text-sm leading-6 text-white/55">Scan the next supply QR code.</p>{sessionCount > 0 ? <p className="mt-3 text-sm font-bold text-white/70">{sessionCount} {sessionCount === 1 ? "supply type" : "supply types"} in session</p> : null}</header>{error ? <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">{error}</div> : null}<section className="rounded-[24px] border border-white/12 bg-[#121212] p-4"><div className="relative overflow-hidden rounded-[20px] border border-red-400/30 bg-black"><div id="ems-supply-qr-reader" className="min-h-[290px] w-full" /><div className="pointer-events-none absolute inset-[12%] rounded-2xl border-2 border-red-400/70 shadow-[0_0_0_999px_rgba(0,0,0,0.38)]" /><span className="pointer-events-none absolute left-1/2 top-[12%] h-0.5 w-[66%] -translate-x-1/2 bg-red-400/80 shadow-[0_0_18px_rgba(248,113,113,0.75)]" /></div><div className="mt-4 flex items-center gap-3 text-sm text-white/60"><Camera className="h-5 w-5 shrink-0 text-[#ff6565]" /><span>{status}</span></div></section><button type="button" onClick={onFallback} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-[#151515] px-4 text-sm font-black uppercase tracking-[0.1em] text-white"><Search className="h-4 w-4" />Search Supplies Instead</button></div></main>;
}
