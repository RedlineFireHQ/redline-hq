"use client";

import { FileSearch } from "lucide-react";
import type { FormEvent } from "react";
import { useRef, useState } from "react";

const ROOT_SELECTOR = '[data-quick-view-root="true"]';
const TARGET_SELECTOR = '[data-quick-view-search-target="true"]';

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type PreviousHighlight = {
  element: HTMLElement;
  boxShadow: string;
  backgroundColor: string;
  borderRadius: string;
};

export default function QuickViewFindBar() {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const previousHighlightRef = useRef<PreviousHighlight | null>(null);
  const clearHighlightTimerRef = useRef<number | null>(null);

  const clearPreviousHighlight = () => {
    if (clearHighlightTimerRef.current) {
      window.clearTimeout(clearHighlightTimerRef.current);
      clearHighlightTimerRef.current = null;
    }

    if (!previousHighlightRef.current) {
      return;
    }

    const { element, boxShadow, backgroundColor, borderRadius } = previousHighlightRef.current;
    element.style.boxShadow = boxShadow;
    element.style.backgroundColor = backgroundColor;
    element.style.borderRadius = borderRadius;
    previousHighlightRef.current = null;
  };

  const highlightElement = (element: HTMLElement) => {
    clearPreviousHighlight();

    previousHighlightRef.current = {
      element,
      boxShadow: element.style.boxShadow,
      backgroundColor: element.style.backgroundColor,
      borderRadius: element.style.borderRadius,
    };

    element.style.backgroundColor = "rgba(220, 38, 38, 0.10)";
    element.style.boxShadow = "0 0 0 1px rgba(248, 113, 113, 0.45), 0 0 0 8px rgba(220, 38, 38, 0.08)";
    element.style.borderRadius = "0.9rem";

    element.scrollIntoView({ behavior: "smooth", block: "center" });

    clearHighlightTimerRef.current = window.setTimeout(() => {
      clearPreviousHighlight();
    }, 8000);
  };

  const runSearch = () => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      clearPreviousHighlight();
      setMessage(null);
      return;
    }

    const root = document.querySelector(ROOT_SELECTOR);
    if (!(root instanceof HTMLElement)) {
      setMessage("Quick View search is unavailable right now.");
      return;
    }

    const targets = Array.from(root.querySelectorAll<HTMLElement>(TARGET_SELECTOR));
    const queryPattern = new RegExp(`\\b${escapeRegExp(normalizedQuery)}`);

    const rankedMatches = targets
      .map((element) => {
        const searchableText = normalizeText(
          element.getAttribute("data-quick-view-search-text")
            ?? element.textContent
            ?? "",
        );

        if (!searchableText || !searchableText.includes(normalizedQuery)) {
          return null;
        }

        const priority = Number(element.getAttribute("data-quick-view-search-priority") ?? "0");
        const kind = element.getAttribute("data-quick-view-search-kind") ?? "section";
        const index = searchableText.indexOf(normalizedQuery);

        let score = priority * 100;
        if (searchableText === normalizedQuery) {
          score += 30;
        }
        if (searchableText.startsWith(normalizedQuery)) {
          score += 20;
        }
        if (queryPattern.test(searchableText)) {
          score += 12;
        }
        if (kind === "detail") {
          score += 8;
        } else if (kind === "card") {
          score += 4;
        }
        score += Math.max(0, 10 - Math.min(10, index));
        score -= Math.min(18, Math.floor(searchableText.length / 140));

        return { element, score };
      })
      .filter((match): match is { element: HTMLElement; score: number } => Boolean(match))
      .sort((left, right) => right.score - left.score);

    const bestMatch = rankedMatches[0];
    if (!bestMatch) {
      clearPreviousHighlight();
      setMessage("No match found in this pre-plan.");
      return;
    }

    highlightElement(bestMatch.element);
    setMessage(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runSearch();
  };

  return (
    <div className="w-full lg:w-auto lg:min-w-[420px]">
      <form onSubmit={handleSubmit} className="flex w-full gap-2" role="search" aria-label="Search this pre-plan">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search this pre-plan (Knox, FDC, propane...)"
          className="w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/60 focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex items-center rounded-lg border border-white/15 bg-[#1b1b1b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#242424]"
          aria-label="Find in this pre-plan"
        >
          <FileSearch className="h-4 w-4" />
        </button>
      </form>
      {message ? <p className="mt-2 text-sm text-neutral-400">{message}</p> : null}
    </div>
  );
}