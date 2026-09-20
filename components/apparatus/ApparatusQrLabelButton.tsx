"use client";

import { useState } from "react";
import QrLabelDialog from "@/components/qr/QrLabelDialog";
import { apparatusQrValue } from "@/lib/qr-identifiers";

type Props = { apparatusId: string; apparatusName: string };

export default function ApparatusQrLabelButton({ apparatusId, apparatusName }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const value = apparatusQrValue(apparatusId);

  return <>
    <button type="button" onClick={() => setIsOpen(true)} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800">QR Code</button>
    {isOpen ? <QrLabelDialog title={apparatusName} subtitle="Apparatus Check" value={value} onClose={() => setIsOpen(false)} /> : null}
  </>;
}