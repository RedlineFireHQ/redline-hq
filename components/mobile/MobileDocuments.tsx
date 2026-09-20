"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { BookOpen, ExternalLink, FileText, Search, X } from "lucide-react";

type MobileDocument = {
  id: string;
  title: string;
  description: string | null;
  documentNumber: string | null;
  effectiveDate: string | null;
  category: string;
  categoryLabel: string;
  categoryFilter: string;
  revisionNumber: number | null;
  fileName: string | null;
  mimeType: string | null;
  revisionNotes: string | null;
  contentText: string | null;
  signedUrl: string | null;
};

type FilterOption = {
  id: string;
  label: string;
  count: number;
  description?: string | null;
};

type Props = {
  documents: MobileDocument[];
  categories: FilterOption[];
  folders: FilterOption[];
  initialError: string | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function revisionLabel(value: number | null) {
  return `V${value && value > 0 ? value : 1}`;
}

function countTextMatches(text: string | null, query: string) {
  const haystack = text?.toLowerCase() ?? "";
  const needle = query.trim().toLowerCase();
  if (!haystack || !needle) return 0;

  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

type TextBlock = {
  index: number;
  text: string;
};

type TextMatch = {
  index: number;
  blockIndex: number;
  start: number;
  end: number;
  context: string;
};

function splitDocumentText(text: string | null) {
  const normalized = (text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return [] as TextBlock[];

  return normalized
    .split(/ (?=\d+\.\s+[A-Z])/g)
    .map((block, index) => ({ index, text: block.trim() }))
    .filter((block) => block.text.length > 0);
}

function buildTextMatches(blocks: TextBlock[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [] as TextMatch[];

  const matches: TextMatch[] = [];
  for (const block of blocks) {
    const lowerBlock = block.text.toLowerCase();
    let index = lowerBlock.indexOf(needle);

    while (index !== -1) {
      const contextStart = Math.max(0, index - 90);
      const contextEnd = Math.min(block.text.length, index + needle.length + 130);
      matches.push({
        index: matches.length,
        blockIndex: block.index,
        start: index,
        end: index + needle.length,
        context: block.text.slice(contextStart, contextEnd).trim(),
      });
      index = lowerBlock.indexOf(needle, index + needle.length);
    }
  }

  return matches;
}

export default function MobileDocuments({ documents, categories, folders, initialError }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedDocument, setSelectedDocument] = useState<MobileDocument | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return documents.filter((document) => {
      if (selectedFilter !== "all") {
        if (selectedFilter === "department-documents") {
          if (document.category !== "Department Documents") return false;
        } else if (document.categoryFilter !== selectedFilter) {
          return false;
        }
      }

      if (!query) return true;
      return [
        document.title,
        document.category,
        document.categoryLabel,
        document.documentNumber,
        document.description,
        document.fileName,
        document.revisionNotes,
        document.contentText,
      ].some((value) => normalize(value).includes(query));
    });
  }, [documents, searchQuery, selectedFilter]);

  function openDocument(document: MobileDocument) {
    setOpenError(null);
    if (!document.signedUrl) {
      setOpenError("Unable to open this document right now. Please try again.");
      return;
    }
    window.open(document.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#080808] px-4 py-5 text-white sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-10">
        <Link href="/mobile" className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">Back to Field Actions</Link>

        {selectedDocument ? (
          <DocumentDetail document={selectedDocument} openError={openError} onBack={() => { setSelectedDocument(null); setOpenError(null); }} onOpen={openDocument} />
        ) : (
          <>
            <header className="rounded-[24px] border border-white/12 bg-[linear-gradient(145deg,rgba(35,35,35,0.98),rgba(10,10,10,0.98))] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.36)]">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ef2b2d]">Field Reference</p>
              <h1 className="mt-2 text-3xl font-black uppercase tracking-tight">Documents</h1>
              <p className="mt-2 text-sm leading-6 text-white/62">Find, open, and read department reference documents.</p>
              <label className="mt-5 block text-sm font-black text-white/80">
                Search documents
                <div className="mt-2 flex min-h-14 items-center gap-2 rounded-2xl border border-white/15 bg-[#080808] px-4 focus-within:border-[#ef2b2d]">
                  <Search className="h-4 w-4 text-white/35" />
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search documents..." className="min-h-12 flex-1 bg-transparent text-base text-white outline-none" />
                  {searchQuery ? <button type="button" onClick={() => setSearchQuery("")} className="flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-white/10 text-white/55" aria-label="Clear document search"><X className="h-4 w-4" /></button> : null}
                </div>
              </label>
            </header>

            {initialError ? <div className="rounded-2xl border border-red-400/25 bg-red-500/12 p-4 text-sm font-bold text-red-100">Unable to load documents right now. Please try again.</div> : null}

            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/80">Categories</h2>
                <span className="text-xs font-bold text-white/45">{documents.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <FilterButton label="All" count={documents.length} active={selectedFilter === "all"} onClick={() => setSelectedFilter("all")} />
                {categories.map((category) => <FilterButton key={category.id} label={category.label} count={category.count} active={selectedFilter === category.id} onClick={() => setSelectedFilter(category.id)} />)}
              </div>
            </section>

            {folders.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/80">Department Documents</h2>
                  <span className="text-xs font-bold text-white/45">Folders</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {folders.map((folder) => <FilterButton key={folder.id} label={folder.label} count={folder.count} active={selectedFilter === folder.id} onClick={() => setSelectedFilter(folder.id)} />)}
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/80">Documents</h2>
                <span className="text-xs font-bold text-white/45">{filteredDocuments.length}</span>
              </div>
              {filteredDocuments.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm font-bold text-white/45">
                  {searchQuery ? "No documents match your search." : selectedFilter === "all" ? "No documents found." : "No documents are currently available in this category."}
                </div>
              ) : null}
              {filteredDocuments.map((document) => <DocumentCard key={document.id} document={document} onOpen={setSelectedDocument} />)}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function FilterButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-14 rounded-2xl border px-3 py-3 text-left ${active ? "border-[#ef2b2d] bg-[#ef2b2d]/18 text-white" : "border-white/10 bg-[#121212] text-white/70"}`}>
      <span className="block text-sm font-black leading-tight">{label}</span>
      <span className="mt-1 block text-xs font-bold text-white/42">{count} document{count === 1 ? "" : "s"}</span>
    </button>
  );
}

function DocumentCard({ document, onOpen }: { document: MobileDocument; onOpen: (document: MobileDocument) => void }) {
  return (
    <button type="button" onClick={() => onOpen(document)} className="w-full rounded-2xl border border-white/12 bg-[#121212] p-4 text-left shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/12 text-red-100">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-black leading-5 text-white">{document.title}</h3>
          <p className="mt-1 text-sm font-bold text-white/55">{document.categoryLabel}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-white/46">
            {document.documentNumber ? <span>{document.documentNumber}</span> : null}
            {document.effectiveDate ? <span>Effective {formatDate(document.effectiveDate)}</span> : null}
            <span>{revisionLabel(document.revisionNumber)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function DocumentDetail({ document, openError, onBack, onOpen }: { document: MobileDocument; openError: string | null; onBack: () => void; onOpen: (document: MobileDocument) => void }) {
  const [documentSearchQuery, setDocumentSearchQuery] = useState("");
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
  const blockRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const normalizedQuery = documentSearchQuery.trim();
  const textBlocks = useMemo(() => splitDocumentText(document.contentText), [document.contentText]);
  const textMatches = useMemo(() => buildTextMatches(textBlocks, normalizedQuery), [textBlocks, normalizedQuery]);
  const matchCount = textMatches.length || countTextMatches(document.contentText, normalizedQuery);
  const selectedMatch = textMatches[selectedMatchIndex] ?? null;
  const canMoveMatches = matchCount > 1;

  function updateDocumentSearch(value: string) {
    setDocumentSearchQuery(value);
    setSelectedMatchIndex(0);
  }

  function selectMatch(index: number) {
    const match = textMatches[index];
    setSelectedMatchIndex(index);
    if (!match) return;

    window.requestAnimationFrame(() => {
      blockRefs.current[match.blockIndex]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function moveMatch(direction: -1 | 1) {
    if (!canMoveMatches) return;
    const nextIndex = direction === 1
      ? selectedMatchIndex >= matchCount - 1 ? 0 : selectedMatchIndex + 1
      : selectedMatchIndex <= 0 ? matchCount - 1 : selectedMatchIndex - 1;
    selectMatch(nextIndex);
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-[24px] border border-white/12 bg-[#111111] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.36)]">
      <button type="button" onClick={onBack} className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">Back to Documents</button>
      <div className="mt-5 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/12 text-red-100">
          <BookOpen className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ef2b2d]">{document.categoryLabel}</p>
          <h1 className="mt-2 text-2xl font-black leading-tight">{document.title}</h1>
        </div>
      </div>

      {openError ? <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/12 p-4 text-sm font-bold text-red-100">{openError}</div> : null}

      <dl className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
        {document.documentNumber ? <DetailRow label="Document Number" value={document.documentNumber} /> : null}
        {document.effectiveDate ? <DetailRow label="Effective Date" value={formatDate(document.effectiveDate)} /> : null}
        <DetailRow label="Current Revision" value={revisionLabel(document.revisionNumber)} />
        {document.fileName ? <DetailRow label="File" value={document.fileName} /> : null}
      </dl>

      {document.description ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-[#080808] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-white/35">Description</p>
          <p className="mt-2 text-sm leading-6 text-white/75">{document.description}</p>
        </div>
      ) : null}

      <section className="mt-5 rounded-2xl border border-white/10 bg-[#080808] p-4">
        <label className="block text-sm font-black text-white/80">
          Search in document
          <div className="mt-2 flex min-h-14 items-center gap-2 rounded-2xl border border-white/15 bg-[#111111] px-4 focus-within:border-[#ef2b2d]">
            <Search className="h-4 w-4 text-white/35" />
            <input value={documentSearchQuery} onChange={(event) => updateDocumentSearch(event.target.value)} placeholder="Search in document..." className="min-h-12 flex-1 bg-transparent text-base text-white outline-none" />
            {documentSearchQuery ? <button type="button" onClick={() => updateDocumentSearch("")} className="flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-white/10 text-white/55" aria-label="Clear document text search"><X className="h-4 w-4" /></button> : null}
          </div>
        </label>

        {normalizedQuery ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-sm font-bold text-white/70">
              {matchCount > 0 ? `${selectedMatchIndex + 1} of ${matchCount} matches` : "No matches found in searchable text."}
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={!canMoveMatches} onClick={() => moveMatch(-1)} className="min-h-10 rounded-xl border border-white/12 px-3 text-xs font-black uppercase text-white/70 disabled:opacity-40">Prev</button>
              <button type="button" disabled={!canMoveMatches} onClick={() => moveMatch(1)} className="min-h-10 rounded-xl border border-white/12 px-3 text-xs font-black uppercase text-white/70 disabled:opacity-40">Next</button>
            </div>
          </div>
        ) : null}

        {normalizedQuery && textMatches.length > 0 ? (
          <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-[#111111] p-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/35">Matches</p>
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {textMatches.map((match) => (
                <button key={match.index} type="button" onClick={() => selectMatch(match.index)} className={`min-h-12 w-full rounded-xl border p-3 text-left text-sm leading-5 ${selectedMatchIndex === match.index ? "border-[#ef2b2d] bg-[#ef2b2d]/18 text-white" : "border-white/10 bg-[#080808] text-white/65"}`}>
                  <span className="block text-xs font-black uppercase tracking-[0.12em] text-white/35">Match {match.index + 1}</span>
                  <span className="mt-1 line-clamp-2 block">{match.context}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {textBlocks.length > 0 ? (
        <section className="mt-5 rounded-2xl border border-white/10 bg-[#080808] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white/75">Document Text</h2>
            {selectedMatch ? <span className="text-xs font-bold text-[#ef2b2d]">Match {selectedMatch.index + 1}</span> : null}
          </div>
          <div className="mt-4 max-h-[62vh] space-y-3 overflow-y-auto pr-1">
            {textBlocks.map((block) => {
              const blockMatches = textMatches.filter((match) => match.blockIndex === block.index);
              const isActiveBlock = selectedMatch?.blockIndex === block.index;
              return (
                <div
                  key={block.index}
                  ref={(node) => {
                    blockRefs.current[block.index] = node;
                  }}
                  className={`rounded-2xl border p-4 ${isActiveBlock ? "border-[#ef2b2d]/70 bg-[#ef2b2d]/10" : "border-white/10 bg-[#111111]"}`}
                >
                  <HighlightedBlock text={block.text} matches={blockMatches} activeMatchIndex={selectedMatchIndex} />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <button type="button" onClick={() => onOpen(document)} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#ef2b2d] px-4 text-base font-black uppercase tracking-wide text-white">
        Open Document
        <ExternalLink className="h-5 w-5" />
      </button>

    </section>
  );
}

function HighlightedBlock({ text, matches, activeMatchIndex }: { text: string; matches: TextMatch[]; activeMatchIndex: number }) {
  if (matches.length === 0) {
    return <p className="whitespace-pre-wrap text-base leading-7 text-white/78">{text}</p>;
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    parts.push(text.slice(cursor, match.start));
    parts.push(
      <mark key={match.index} className={match.index === activeMatchIndex ? "rounded bg-red-500/80 px-1 text-white" : "rounded bg-yellow-300/85 px-1 text-black"}>
        {text.slice(match.start, match.end)}
      </mark>,
    );
    cursor = match.end;
  }
  parts.push(text.slice(cursor));

  return <p className="whitespace-pre-wrap text-base leading-7 text-white/78">{parts}</p>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-[#080808] p-3">
      <dt className="text-xs font-black uppercase tracking-[0.14em] text-white/35">{label}</dt>
      <dd className="mt-1 break-words text-sm font-bold text-white/80">{value}</dd>
    </div>
  );
}