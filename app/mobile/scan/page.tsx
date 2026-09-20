"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import MobileQrScanner from "@/components/mobile/MobileQrScanner";
import type { QrResolvedObject } from "@/lib/qr-identifiers";

export default function MobileScanPage() {
  const router = useRouter();
  const handleResolved = useCallback((result: QrResolvedObject) => {
    if (result.type === "apparatus") {
      router.push(`/mobile/apparatus-checks/${result.id}`);
      return;
    }

    router.push(`/mobile/ems-supplies?qr=${encodeURIComponent(result.value)}`);
  }, [router]);
  const handleFallback = useCallback(() => router.push("/mobile"), [router]);

  return <MobileQrScanner onResolved={handleResolved} onFallback={handleFallback} />;
}