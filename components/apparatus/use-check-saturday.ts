"use client";

import { useEffect, useState } from "react";
import { isSaturday } from "@/lib/apparatus/daily-checks";

export function useCheckSaturday(initialSaturday: boolean) {
  const [saturday, setSaturday] = useState(initialSaturday);
  useEffect(() => {
    const update = () => setSaturday(isSaturday());
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);
  return saturday;
}
