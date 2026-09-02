"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type AssignedInventoryItem = {
  id: string;
  name: string;
  category: string;
  location: string;
  inspectionStatus: string;
  statusClass: string;
  lastInspection: string;
  linkHref?: string | null;
};

const INVENTORY_CATEGORY_OPTIONS = [
  {
    key: "fire-hose",
    label: "Fire Hose",
    href: "/inventory/fire-hose",
    description: "Hose inventory and testing",
  },
  {
    key: "ground-ladders",
    label: "Ground Ladders",
    href: "/inventory/ground-ladders",
    description: "Ladder assignments and service tests",
  },
  {
    key: "portable-radios",
    label: "Portable Radios",
    href: "/inventory/portable-radios",
    description: "Radio accountability and assignment",
  },
  {
    key: "thermal-cameras",
    label: "Thermal Imaging Cameras",
    href: "/inventory/thermal-cameras",
    description: "Camera status and apparatus assignment",
  },
  {
    key: "gas-monitors",
    label: "Gas Monitors",
    href: "/inventory/gas-monitors",
    description: "Calibration tracking and assignment",
  },
  {
    key: "batteries",
    label: "Batteries",
    href: "/inventory/batteries",
    description: "Battery assignment and service tracking",
  },
  {
    key: "pie",
    label: "PIE Equipment",
    href: "/inventory/pie",
    description: "PIE gear assignment and mobility equipment",
  },
  {
    key: "fire-extinguishers",
    label: "Fire Extinguishers",
    href: "/inventory/fire-extinguishers",
    description: "Extinguisher location and readiness",
  },
  {
    key: "misc-fire-equipment",
    label: "Miscellaneous Fire Equipment",
    href: "/inventory/misc-fire-equipment",
    description: "General tools and equipment",
  },
  {
    key: "rope",
    label: "Rope",
    href: "/inventory/rope",
    description: "Rope status and apparatus placement",
  },
] as const;

function buildCategoryHref(apparatusId: string, href: string) {
  const returnTo = `/apparatus/${encodeURIComponent(apparatusId)}`;
  const params = new URLSearchParams({
    apparatusId,
    returnTo,
  });

  return `${href}?${params.toString()}`;
}

export default function AssignedInventoryPanel({
  items,
  apparatusId,
}: {
  items: AssignedInventoryItem[];
  apparatusId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) => {
      const searchableText = [
        item.name,
        item.category,
        item.location,
        item.inspectionStatus,
        item.lastInspection,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [items, query]);

  return (
    <div className="rounded-2xl border border-red-900 bg-[#242424] p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Assigned Inventory</h2>
          <p className="mt-2 text-neutral-400">
            Current inventory assigned to this apparatus.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsSelectorOpen(true)}
          className="rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm font-semibold text-neutral-200 transition hover:border-red-500/40 hover:text-white"
        >
          + Add Inventory
        </button>
      </div>

      {isSelectorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#2a2a2a] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-white">Add Inventory</h3>
                <p className="mt-1 text-sm text-neutral-400">Choose an inventory category for this apparatus.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSelectorOpen(false)}
                className="rounded-lg border border-white/10 bg-[#1b1b1b] px-2.5 py-1.5 text-sm text-neutral-300 transition hover:border-red-500/40 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {INVENTORY_CATEGORY_OPTIONS.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => {
                    setIsSelectorOpen(false);
                    router.push(buildCategoryHref(apparatusId, category.href));
                  }}
                  className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4 text-left transition hover:border-red-500/40 hover:bg-[#1d1d1d]"
                >
                  <div className="text-base font-bold text-white">{category.label}</div>
                  <div className="mt-1 text-sm text-neutral-400">{category.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search assigned inventory"
          className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
        />
      </div>

      <div className="mt-6 max-h-[18rem] overflow-x-auto overflow-y-auto rounded-xl border border-white/10 bg-[#1b1b1b]">
        {filteredItems.length === 0 ? (
          <div className="flex min-h-full items-center justify-center px-6 py-8 text-center text-neutral-400">
            No assigned inventory matches this search.
          </div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="sticky top-0 border-b border-white/10 bg-[#1b1b1b] text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                <th className="px-4 py-3 font-semibold">Inventory Name</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Assigned Location</th>
                <th className="px-4 py-3 font-semibold">Inspection Status</th>
                <th className="px-4 py-3 font-semibold">Last Inspection</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5 text-neutral-300">
              {filteredItems.map((asset, index) => {
                const cellContent = (
                  <>
                    <td className="px-4 py-4 align-top text-white">
                      {asset.linkHref ? (
                        <Link href={asset.linkHref} className="hover:text-red-300">
                          {asset.name}
                        </Link>
                      ) : (
                        <span>{asset.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-neutral-300">
                      {asset.linkHref ? (
                        <Link href={asset.linkHref} className="hover:text-red-300">
                          {asset.category}
                        </Link>
                      ) : (
                        <span>{asset.category}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-neutral-300">
                      {asset.linkHref ? (
                        <Link href={asset.linkHref} className="hover:text-red-300">
                          {asset.location}
                        </Link>
                      ) : (
                        <span>{asset.location}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top">
                      {asset.linkHref ? (
                        <Link href={asset.linkHref} className={`hover:brightness-110 ${asset.statusClass}`}>
                          {asset.inspectionStatus}
                        </Link>
                      ) : (
                        <span className={asset.statusClass}>{asset.inspectionStatus}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-neutral-300">
                      {asset.linkHref ? (
                        <Link href={asset.linkHref} className="hover:text-red-300">
                          {asset.lastInspection}
                        </Link>
                      ) : (
                        <span>{asset.lastInspection}</span>
                      )}
                    </td>
                  </>
                );

                return (
                  <tr
                    key={asset.id}
                    className={`${index < filteredItems.length - 1 ? "border-b border-white/5" : ""} transition-colors hover:bg-white/[0.03]`}
                  >
                    {cellContent}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
