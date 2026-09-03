"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PdfTextHighlightViewerProps } from "./PdfTextHighlightViewer";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type MatchLocation = {
  index: number;
  pageNumber: number;
  itemIndex: number;
};

type PdfTextItemLike = {
  str?: string;
};

type DocumentLoadSuccessHandler = NonNullable<ComponentProps<typeof Document>["onLoadSuccess"]>;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const ZOOM_MIN = 0.7;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.15;

export default function PdfTextHighlightViewerInner({
  fileUrl,
  title,
  query,
  selectedMatchIndex,
}: PdfTextHighlightViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.15);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [matchLocations, setMatchLocations] = useState<MatchLocation[]>([]);
  const [highlightsByItem, setHighlightsByItem] = useState<Record<string, number[]>>({});
  const [activeMatchIndex, setActiveMatchIndex] = useState(() => Math.max(0, selectedMatchIndex));
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const normalizedQuery = query.trim();
  const hasQuery = normalizedQuery.length > 0;

  const totalMatches = matchLocations.length;

  const scrollToPage = useCallback((pageNumber: number) => {
    const target = pageRefs.current[pageNumber];
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrentPage(pageNumber);
  }, []);

  const scrollToMatch = useCallback((matchIndex: number) => {
    const target = matchLocations[matchIndex];
    if (!target) {
      return;
    }

    const selector = `[data-rhq-match-index='${target.index}']`;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const activeElement = document.querySelector(selector);
        if (!activeElement) {
          return;
        }

        activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }, [matchLocations]);

  useEffect(() => {
    if (!hasQuery || totalMatches <= 0) {
      return;
    }

    scrollToMatch(activeMatchIndex);
  }, [activeMatchIndex, hasQuery, scrollToMatch, totalMatches]);

  const handleDocumentLoadSuccess: DocumentLoadSuccessHandler = useCallback(async (pdf) => {
    setLoadError(null);
    setNumPages(pdf.numPages);

    if (!hasQuery) {
      setMatchLocations([]);
      setHighlightsByItem({});
      return;
    }

    const needle = normalizedQuery.toLowerCase();
    const nextLocations: MatchLocation[] = [];
    const nextHighlightsByItem: Record<string, number[]> = {};

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = content.items as PdfTextItemLike[];

      items.forEach((item, itemIndex) => {
        const raw = typeof item.str === "string" ? item.str : "";
        if (!raw) {
          return;
        }

        const lowerRaw = raw.toLowerCase();
        let searchFrom = 0;

        while (searchFrom < lowerRaw.length) {
          const hitIndex = lowerRaw.indexOf(needle, searchFrom);
          if (hitIndex === -1) {
            break;
          }

          const globalIndex = nextLocations.length;
          nextLocations.push({
            index: globalIndex,
            pageNumber,
            itemIndex,
          });

          const itemKey = `${pageNumber}:${itemIndex}`;
          if (!nextHighlightsByItem[itemKey]) {
            nextHighlightsByItem[itemKey] = [];
          }
          nextHighlightsByItem[itemKey].push(globalIndex);

          searchFrom = hitIndex + needle.length;
        }
      });
    }

    setMatchLocations(nextLocations);
    setHighlightsByItem(nextHighlightsByItem);
  }, [hasQuery, normalizedQuery]);

  const handleDocumentLoadError = useCallback((error: Error) => {
    setLoadError(error.message || "Unable to preview this PDF.");
    setMatchLocations([]);
    setHighlightsByItem({});
  }, []);

  const textRendererByPage = useMemo(() => {
    const regex = hasQuery ? new RegExp(escapeRegExp(normalizedQuery), "gi") : null;

    return (pageNumber: number) => {
      return ({ str, itemIndex }: { str: string; itemIndex: number }) => {
        if (!regex || !str) {
          return escapeHtml(str || "");
        }

        const itemKey = `${pageNumber}:${itemIndex}`;
        const matchIndices = highlightsByItem[itemKey];
        if (!matchIndices || matchIndices.length === 0) {
          return escapeHtml(str);
        }

        regex.lastIndex = 0;
        let rendered = "";
        let cursor = 0;
        let localMatchCounter = 0;
        let match = regex.exec(str);

        while (match) {
          const start = match.index;
          const matchText = match[0] || "";
          const end = start + matchText.length;
          const globalMatchIndex = matchIndices[localMatchCounter] ?? -1;

          rendered += escapeHtml(str.slice(cursor, start));

          if (globalMatchIndex >= 0) {
            const isActive = globalMatchIndex === activeMatchIndex;
            rendered += `<mark data-rhq-match-index="${globalMatchIndex}" class="${
              isActive
                ? "rounded bg-red-500/80 px-0.5 text-white"
                : "rounded bg-yellow-300/85 px-0.5 text-black"
            }">${escapeHtml(matchText)}</mark>`;
          } else {
            rendered += escapeHtml(matchText);
          }

          cursor = end;
          localMatchCounter += 1;
          match = regex.exec(str);
        }

        rendered += escapeHtml(str.slice(cursor));
        return rendered;
      };
    };
  }, [activeMatchIndex, hasQuery, highlightsByItem, normalizedQuery]);

  const canMoveMatches = hasQuery && totalMatches > 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f0f0f] px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollToPage(clamp(currentPage - 1, 1, Math.max(1, numPages)))}
            disabled={numPages <= 0 || currentPage <= 1}
            className="rounded-lg border border-white/10 bg-[#181818] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev page
          </button>
          <button
            type="button"
            onClick={() => scrollToPage(clamp(currentPage + 1, 1, Math.max(1, numPages)))}
            disabled={numPages <= 0 || currentPage >= numPages}
            className="rounded-lg border border-white/10 bg-[#181818] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next page
          </button>
          <span className="text-xs font-medium text-neutral-300">
            Page {numPages > 0 ? currentPage : 0} of {numPages}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScale((prev) => clamp(Number((prev - ZOOM_STEP).toFixed(2)), ZOOM_MIN, ZOOM_MAX))}
            className="rounded-lg border border-white/10 bg-[#181818] px-3 py-1.5 text-xs font-semibold text-white"
          >
            -
          </button>
          <span className="min-w-12 text-center text-xs font-medium text-neutral-300">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={() => setScale((prev) => clamp(Number((prev + ZOOM_STEP).toFixed(2)), ZOOM_MIN, ZOOM_MAX))}
            className="rounded-lg border border-white/10 bg-[#181818] px-3 py-1.5 text-xs font-semibold text-white"
          >
            +
          </button>
        </div>
      </div>

      {hasQuery ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f0f0f] px-3 py-2">
          <span className="text-xs font-medium text-neutral-300">
            {totalMatches > 0
              ? `In-document highlights: ${activeMatchIndex + 1} of ${totalMatches}`
              : "No in-document highlights found in PDF text layer"}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!canMoveMatches) {
                  return;
                }
                const nextIndex = activeMatchIndex <= 0 ? totalMatches - 1 : activeMatchIndex - 1;
                setActiveMatchIndex(nextIndex);
              }}
              disabled={!canMoveMatches}
              className="rounded-lg border border-white/10 bg-[#181818] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev match
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canMoveMatches) {
                  return;
                }
                const nextIndex = activeMatchIndex >= totalMatches - 1 ? 0 : activeMatchIndex + 1;
                setActiveMatchIndex(nextIndex);
              }}
              disabled={!canMoveMatches}
              className="rounded-lg border border-white/10 bg-[#181818] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next match
            </button>
          </div>
        </div>
      ) : null}

      <div className="h-[760px] overflow-auto rounded-xl border border-white/10 bg-[#0a0a0a]">
        {loadError ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-red-200">
            {loadError}
          </div>
        ) : (
          <Document
            file={fileUrl}
            aria-label={title}
            loading={<div className="p-6 text-sm text-neutral-300">Loading document preview...</div>}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            error={<div className="p-6 text-sm text-red-200">Unable to render this PDF preview.</div>}
          >
            <div className="space-y-4 p-4">
              {Array.from({ length: numPages }, (_, index) => {
                const pageNumber = index + 1;
                return (
                  <div
                    key={pageNumber}
                    ref={(node) => {
                      pageRefs.current[pageNumber] = node;
                    }}
                    className="rounded-lg border border-white/10 bg-[#111111] p-2"
                  >
                    <Page
                      pageNumber={pageNumber}
                      scale={scale}
                      renderTextLayer
                      renderAnnotationLayer
                      customTextRenderer={textRendererByPage(pageNumber)}
                      className="mx-auto w-fit"
                      loading={<div className="p-3 text-xs text-neutral-400">Loading page {pageNumber}...</div>}
                    />
                  </div>
                );
              })}
            </div>
          </Document>
        )}
      </div>

      <p className="text-xs text-neutral-500">
        Use Ctrl/Cmd + mouse wheel to zoom browser content further if needed.
      </p>
    </div>
  );
}
