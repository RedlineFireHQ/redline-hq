"use client";

import { useSyncExternalStore } from "react";

const dateOptions: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

export default function InspectionDateTime({ value }: { value: string | null }) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return <>Unknown</>;
  // The first browser render must match the server regardless of host timezone.
  const text = parsed.toLocaleString("en-US", { ...dateOptions, timeZone: hydrated ? undefined : "UTC" });
  return <time dateTime={parsed.toISOString()}>{text}</time>;
}

function subscribe() {
  return () => {};
}
