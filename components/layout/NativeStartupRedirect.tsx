"use client";

import { Capacitor } from "@capacitor/core";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NativeStartupRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/" && Capacitor.isNativePlatform()) {
      router.replace("/mobile");
    }
  }, [pathname, router]);

  return null;
}