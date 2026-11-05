"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { startAndroidQrScanner, usesAndroidCanvasScanner } from "@/lib/mobile/android-qr-scanner";

type Options = {
  readerId: string;
  resolve: (text: string, signal: AbortSignal) => Promise<(() => void) | null>;
  onReady: () => void;
  onError: (error: unknown, phase: "camera" | "lookup" | "cleanup") => void;
};
const subscribePlatform = () => () => {};
const serverPlatform = () => false;

export function useAndroidQrScanner(options: Options): { android: boolean; retry: () => void } {
  const current = useRef(options);
  useEffect(() => { current.current = options; }, [options]);
  const android = useSyncExternalStore(subscribePlatform, usesAndroidCanvasScanner, serverPlatform);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!usesAndroidCanvasScanner()) return;
    const host = document.getElementById(options.readerId);
    if (!host) throw new Error("Android scanner preview container is missing.");
    let active = true;
    let mounted = true;
    const session = startAndroidQrScanner({
      host,
      resolve: async (text, signal) => {
        const resolved = await current.current.resolve(text, signal);
        return resolved ? () => { if (active) resolved(); } : null;
      },
      onReady: () => { if (active) current.current.onReady(); },
      onError: (error, phase) => { if (active) current.current.onError(error, phase); },
    });
    const stop = () => {
      active = false;
      void session.close().catch((error) => {
        console.error("Android QR scanner cleanup failed:", error);
        if (mounted) current.current.onError(error, "cleanup");
      });
    };
    const hidden = () => {
      if (document.hidden) {
        current.current.onError(new Error("Camera paused when Redline HQ left the screen. Tap Restart camera to continue."), "camera");
        stop();
      }
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", stop);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, [options.readerId, attempt]);
  return { android, retry: () => setAttempt((value) => value + 1) };
}
