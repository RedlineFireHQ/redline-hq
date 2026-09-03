"use client";

import dynamic from "next/dynamic";

export type PdfTextHighlightViewerProps = {
  fileUrl: string;
  title: string;
  query: string;
  selectedMatchIndex: number;
};

const PdfTextHighlightViewerInner = dynamic(
  () => import("@/components/documents/PdfTextHighlightViewerInner"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[760px] rounded-xl border border-white/10 bg-[#0a0a0a] p-6 text-sm text-neutral-300">
        Loading document preview...
      </div>
    ),
  },
);

export function PdfTextHighlightViewer({
  fileUrl,
  title,
  query,
  selectedMatchIndex,
}: PdfTextHighlightViewerProps) {
  return <PdfTextHighlightViewerInner fileUrl={fileUrl} title={title} query={query} selectedMatchIndex={selectedMatchIndex} />;
}
