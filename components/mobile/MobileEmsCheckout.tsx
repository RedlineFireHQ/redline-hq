"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  HeartPulse,
  Minus,
  Plus,
  Search,
  ScanLine,
  Trash2,
  X,
} from "lucide-react";
import { useMobileWorkflow } from "@/components/mobile/MobileShell";
import { useSearchParams } from "next/navigation";
import MobileEmsQrScanner from "@/components/mobile/MobileEmsQrScanner";
import {
  displayUnit,
  formatNumber,
  statusClasses,
  statusLabel,
  stockStatus,
  type StockStatus,
  type SupplyItem,
} from "@/components/mobile/MobileEmsSupplies";

type DestinationType =
  "Apparatus" | "Station" | "SupplyRoom" | "Other" | "None";
type ApparatusOption = { id: string; name: string };
type CheckoutLine = { supply: SupplyItem; quantity: number };
type Props = { apparatusOptions: ApparatusOption[]; canAudit: boolean };

function parsePositive(value: string) {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const CHECKOUT_SESSION_STORAGE_KEY = "redline-mobile-ems-checkout-session";

function destinationLabel(
  type: DestinationType,
  apparatus: ApparatusOption[],
  apparatusId: string,
  label: string,
) {
  if (type === "None") return "None";
  if (type === "Apparatus")
    return (
      apparatus.find((option) => option.id === apparatusId)?.name || "Apparatus"
    );
  if (type === "SupplyRoom") return label.trim() || "Supply Room";
  if (type === "Station") return label.trim() || "Station";
  return label.trim() || "Other";
}

function SupplyCard({
  item,
  actionLabel,
  onSelect,
}: {
  item: SupplyItem;
  actionLabel: string;
  onSelect: () => void;
}) {
  const status = stockStatus(item);
  return (
    <article className="rounded-[20px] border border-white/12 bg-[#121212] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
      <Link
        href={`/mobile/ems-supplies/${item.id}`}
        className="flex items-start justify-between gap-3"
      >
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef2b2d]">
            {item.item_category || "EMS supply"}
          </p>
          <h2 className="mt-1 break-words text-[17px] font-black leading-tight text-white">
            {item.item_name}
          </h2>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-white/35" />
      </Link>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="label">Available</p>
          <p className="mt-1 font-bold">
            {formatNumber(item.quantity_on_hand)} {displayUnit(item)}
          </p>
        </div>
        <div>
          <p className="label">Status</p>
          <span
            className={`mt-1 inline-flex rounded-full border px-2 py-1 text-xs font-bold ${statusClasses(status)}`}
          >
            {statusLabel(status)}
          </span>
        </div>
        <div className="col-span-2">
          <p className="label">Location</p>
          <p className="mt-1 truncate text-white/70">
            {item.location || "Location not recorded"}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#ef2b2d] px-4 text-sm font-black uppercase tracking-[0.1em] text-white"
      >
        <Plus className="h-4 w-4" />
        {actionLabel}
      </button>
    </article>
  );
}

function ReferenceSupplyCard({ item }: { item: SupplyItem }) {
  const status = stockStatus(item);
  return (
    <Link
      href={`/mobile/ems-supplies/${item.id}`}
      className="flex min-h-20 items-center justify-between gap-4 border-b border-white/10 px-1 py-4"
    >
      <div className="min-w-0">
        <h2 className="break-words text-base font-black text-white">
          {item.item_name}
        </h2>
        <p className="mt-1 text-sm text-white/60">
          {formatNumber(item.quantity_on_hand)} {displayUnit(item)} ·{" "}
          {statusLabel(status)}
          {item.location ? ` · ${item.location}` : ""}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-white/35" />
    </Link>
  );
}

function SessionCard({
  line,
  onRemove,
  onAdjust,
}: {
  line: CheckoutLine;
  onRemove: () => void;
  onAdjust: (delta: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#151515] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black">{line.supply.item_name}</p>
          <p className="mt-1 text-xs text-white/45">
            {formatNumber(line.quantity)} {displayUnit(line.supply)}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${line.supply.item_name}`}
          className="icon-button"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-white/45">
          Current: {formatNumber(line.supply.quantity_on_hand)}{" "}
          {displayUnit(line.supply)}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAdjust(-1)}
            aria-label={`Decrease ${line.supply.item_name}`}
            className="icon-button"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-8 text-center font-black">
            {formatNumber(line.quantity)}
          </span>
          <button
            type="button"
            onClick={() => onAdjust(1)}
            aria-label={`Increase ${line.supply.item_name}`}
            className="icon-button"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DestinationFields({
  type,
  setType,
  apparatusId,
  setApparatusId,
  label,
  setLabel,
  apparatus,
}: {
  type: DestinationType;
  setType: (value: DestinationType) => void;
  apparatusId: string;
  setApparatusId: (value: string) => void;
  label: string;
  setLabel: (value: string) => void;
  apparatus: ApparatusOption[];
}) {
  return (
    <section className="panel">
      <p className="eyebrow-muted">Checkout destination</p>
      <select
        value={type}
        onChange={(event) => setType(event.target.value as DestinationType)}
        className="field mt-3"
      >
        <option value="None">No destination</option>
        <option value="Apparatus">Apparatus</option>
        <option value="Station">Station</option>
        <option value="SupplyRoom">Supply Room</option>
        <option value="Other">Other</option>
      </select>
      {type === "Apparatus" ? (
        <select
          value={apparatusId}
          onChange={(event) => setApparatusId(event.target.value)}
          className="field mt-3"
        >
          <option value="">Select apparatus</option>
          {apparatus.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      ) : null}
      {type === "Station" || type === "SupplyRoom" || type === "Other" ? (
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={
            type === "Other" ? "Enter destination" : "Optional label"
          }
          className="field mt-3"
        />
      ) : null}
    </section>
  );
}

export default function MobileEmsCheckout({
  apparatusOptions,
  canAudit,
}: Props) {
  const setWorkflowFocused = useMobileWorkflow();
  const searchParams = useSearchParams();
  const manualCheckout = Boolean(searchParams.get("manual"));
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | StockStatus>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [referenceBrowser, setReferenceBrowser] = useState(false);
  const [scannedSupply, setScannedSupply] = useState<SupplyItem | null>(null);
  const [scannedQuantity, setScannedQuantity] = useState("");
  const [scanConfirmation, setScanConfirmation] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [lines, setLines] = useState<CheckoutLine[]>([]);
  const [linesHydrated, setLinesHydrated] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [destinationType, setDestinationType] =
    useState<DestinationType>("None");
  const [destinationApparatusId, setDestinationApparatusId] = useState("");
  const [destinationText, setDestinationText] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [auditMode, setAuditMode] = useState(false);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [physicalCount, setPhysicalCount] = useState("");
  const [auditReason, setAuditReason] = useState("");
  const [auditNotes, setAuditNotes] = useState("");
  const [auditSaving, setAuditSaving] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditSuccess, setAuditSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const manualReturn = manualCheckout || referenceBrowser;

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(CHECKOUT_SESSION_STORAGE_KEY);
      if (stored) setLines(JSON.parse(stored) as CheckoutLine[]);
    } catch {
      // Ignore unavailable or malformed session storage.
    } finally {
      setLinesHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!linesHydrated) return;
    try {
      if (lines.length) {
        window.sessionStorage.setItem(CHECKOUT_SESSION_STORAGE_KEY, JSON.stringify(lines));
      } else {
        window.sessionStorage.removeItem(CHECKOUT_SESSION_STORAGE_KEY);
      }
    } catch {
      // Keep the in-memory session usable when storage is unavailable.
    }
  }, [lines, linesHydrated]);

  const focused =
    checkoutMode ||
    reviewMode ||
    scannerOpen ||
    auditMode ||
    Boolean(scannedSupply) ||
    Boolean(scanConfirmation);
  useEffect(() => {
    setWorkflowFocused?.(focused);
    return () => setWorkflowFocused?.(false);
  }, [focused, setWorkflowFocused]);

  const loadItems = async (): Promise<SupplyItem[]> => {
    const response = await fetch("/api/ems/supplies", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      rows?: SupplyItem[];
      error?: string;
    };
    if (!response.ok || !payload.ok)
      throw new Error(payload.error || "Unable to load EMS supplies.");
    const next = (payload.rows || []).filter(
      (item) => item.status === "Active",
    );
    setItems(next);
    return next;
  };
  useEffect(() => {
    let active = true;
    loadItems()
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load EMS supplies.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const qrValue = searchParams.get("qr")?.trim();
    if (!qrValue) return;
    let active = true;
    void fetch(`/api/ems/supplies/qr?value=${encodeURIComponent(qrValue)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          item?: SupplyItem;
          error?: string;
        };
        if (!active) return;
        if (!response.ok || !payload.ok || !payload.item) {
          setError(payload.error || "Supply QR not recognized.");
          return;
        }
        setItems((current) =>
          current.some((item) => item.id === payload.item?.id)
            ? current.map((item) =>
                item.id === payload.item?.id
                  ? (payload.item as SupplyItem)
                  : item,
              )
            : [...current, payload.item as SupplyItem],
        );
        setScannedSupply(payload.item);
        setScannedQuantity("");
        setError(null);
      })
      .catch(() => {
        if (active) setError("Supply QR could not be resolved.");
      });
    return () => {
      active = false;
    };
  }, [searchParams]);

  useEffect(() => {
    const manualId = searchParams.get("manual")?.trim();
    if (!manualId) return;
    let active = true;
    void fetch(`/api/ems/supplies/${encodeURIComponent(manualId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          item?: SupplyItem;
          error?: string;
        };
        if (!active) return;
        if (!response.ok || !payload.ok || !payload.item) {
          setError(payload.error || "Supply not found.");
          return;
        }
        setItems((current) =>
          current.some((item) => item.id === payload.item?.id)
            ? current.map((item) =>
                item.id === payload.item?.id
                  ? (payload.item as SupplyItem)
                  : item,
              )
            : [...current, payload.item as SupplyItem],
        );
        setScannedSupply(payload.item);
        setScannedQuantity("");
        setError(null);
      })
      .catch(() => {
        if (active) setError("Supply could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [searchParams]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        (filter === "All" || stockStatus(item) === filter) &&
        (!text ||
          `${item.item_name} ${item.item_category || ""}`
            .toLowerCase()
            .includes(text)),
    );
  }, [filter, items, query]);
  const selected = selectedId
    ? items.find((item) => item.id === selectedId) || null
    : null;
  const auditSupply = auditId
    ? items.find((item) => item.id === auditId) || null
    : null;
  const parsedPhysical = physicalCount.trim() ? Number(physicalCount) : NaN;
  const difference =
    auditSupply && Number.isFinite(parsedPhysical) && parsedPhysical >= 0
      ? parsedPhysical - Number(auditSupply.quantity_on_hand)
      : null;
  const destinationError =
    destinationType === "Apparatus" && !destinationApparatusId
      ? "Select an apparatus destination."
      : destinationType === "Other" && !destinationText.trim()
        ? "Enter a destination for Other."
        : null;

  const resetCheckout = () => {
    setCheckoutMode(false);
    setReviewMode(false);
    setSelectedId(null);
    setQuantity("");
    setLines([]);
    setDestinationType("None");
    setDestinationApparatusId("");
    setDestinationText("");
    setCheckoutNotes("");
    setError(null);
  };
  const startCheckout = () => {
    setAuditMode(false);
    setCheckoutMode(true);
    setSuccess(null);
    setError(null);
  };
  const selectSupply = (item: SupplyItem) => {
    setCheckoutMode(true);
    setSelectedId(item.id);
    setQuantity("");
    setError(null);
  };
  const handleScan = (item: SupplyItem) => {
    setItems((current) =>
      current.some((entry) => entry.id === item.id)
        ? current.map((entry) => (entry.id === item.id ? item : entry))
        : [...current, item],
    );
    setScannerOpen(false);
    setScannedSupply(item);
    setScannedQuantity("");
    setError(null);
  };
  const addToSession = () => {
    if (!selected) return setError("Select an EMS supply first.");
    const amount = parsePositive(quantity);
    if (amount === null) return setError("Enter a quantity greater than zero.");
    setLines((current) => {
      const existing = current.find((line) => line.supply.id === selected.id);
      return existing
        ? current.map((line) =>
            line.supply.id === selected.id
              ? { ...line, quantity: line.quantity + amount }
              : line,
          )
        : [...current, { supply: selected, quantity: amount }];
    });
    setSelectedId(null);
    setQuantity("");
    setError(null);
  };
  const addScannedToSession = () => {
    if (!scannedSupply) return;
    const amountText = scannedQuantity.trim();
    const amount = Number(amountText);
    if (!/^\d+$/.test(amountText) || amount <= 0) {
      setError("Enter a quantity greater than 0.");
      return;
    }
    if (amount > Number(scannedSupply.quantity_on_hand)) {
      setError(
        `Only ${formatNumber(scannedSupply.quantity_on_hand)} ${displayUnit(scannedSupply)} available.`,
      );
      return;
    }
    const existingLine = lines.find(
      (line) => line.supply.id === scannedSupply.id,
    );
    if (
      existingLine &&
      existingLine.quantity + amount > Number(scannedSupply.quantity_on_hand)
    ) {
      setError(
        `Only ${formatNumber(Math.max(0, Number(scannedSupply.quantity_on_hand) - existingLine.quantity))} ${displayUnit(scannedSupply)} remaining for this session.`,
      );
      return;
    }
    setLines((current) => {
      const existing = current.find(
        (line) => line.supply.id === scannedSupply.id,
      );
      return existing
        ? current.map((line) =>
            line.supply.id === scannedSupply.id
              ? { ...line, quantity: line.quantity + amount }
              : line,
          )
        : [...current, { supply: scannedSupply, quantity: amount }];
    });
    setScannedSupply(null);
    setScannedQuantity("");
    setError(null);
    setScanConfirmation(
      `Added ${scannedSupply.item_name} · ${formatNumber(amount)} ${displayUnit(scannedSupply)}`,
    );
  };
  useEffect(() => {
    if (!scanConfirmation) return;
    const timeout = window.setTimeout(() => {
      setScanConfirmation(null);
      if (manualReturn) {
        setReferenceBrowser(true);
      } else {
        setScannerOpen(true);
      }
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [manualReturn, scanConfirmation]);
  const finishScanSession = () => {
    setScannerOpen(false);
    setScannedSupply(null);
    setScanConfirmation(null);
    setReviewMode(true);
  };
  const openReferenceBrowser = () => {
    setReferenceBrowser(true);
    setError(null);
  };
  const adjustLine = (id: string, delta: number) =>
    setLines((current) =>
      current.map((line) =>
        line.supply.id === id
          ? { ...line, quantity: Math.max(1, line.quantity + delta) }
          : line,
      ),
    );

  const submitCheckout = async () => {
    if (!lines.length || destinationError)
      return setError(
        destinationError || "Add at least one supply to the session.",
      );
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/ems/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transactionType: "Checkout",
          items: lines.map((line) => ({
            supplyItemId: line.supply.id,
            quantity: line.quantity,
          })),
          destinationType,
          destinationApparatusId:
            destinationType === "Apparatus" ? destinationApparatusId : null,
          destinationLabel:
            destinationType === "None"
              ? null
              : destinationType === "SupplyRoom"
                ? destinationText.trim() || "Supply Room"
                : destinationType === "Station"
                  ? destinationText.trim() || "Station"
                  : destinationText.trim() || null,
          notes: checkoutNotes.trim() || null,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        setError(
          (payload.error || "Checkout could not be completed.")
            .toLowerCase()
            .includes("insufficient")
            ? "Available stock changed. Checkout was not completed."
            : payload.error || "Checkout could not be completed.",
        );
        await loadItems().catch(() => undefined);
        return;
      }
      const count = lines.length;
      await loadItems();
      resetCheckout();
      setSuccess(
        `Checkout complete: ${count} ${count === 1 ? "supply type" : "supply types"}.`,
      );
    } catch {
      setError(
        "Checkout could not be completed. Your session is still available to retry.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const saveAudit = async () => {
    if (!auditSupply || !Number.isFinite(parsedPhysical) || parsedPhysical < 0)
      return setAuditError("Enter a valid physical count.");
    if (!auditReason.trim()) return setAuditError("Audit reason is required.");
    setAuditSaving(true);
    setAuditError(null);
    setAuditSuccess(null);
    try {
      const response = await fetch("/api/ems/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transactionType: "Correction",
          supplyItemId: auditSupply.id,
          newQuantity: parsedPhysical,
          reason: auditReason.trim(),
          notes: auditNotes.trim() || null,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        setAuditError(
          response.status === 401 || response.status === 403
            ? "You are not authorized to adjust inventory quantities."
            : payload.error || "Audit could not be saved.",
        );
        await loadItems().catch(() => undefined);
        return;
      }
      const refreshed = await loadItems();
      setPhysicalCount(
        String(
          refreshed.find((item) => item.id === auditSupply.id)
            ?.quantity_on_hand ?? parsedPhysical,
        ),
      );
      setAuditReason("");
      setAuditNotes("");
      setAuditSuccess(
        "Audit saved. The system quantity was refreshed from the server.",
      );
    } catch {
      setAuditError(
        "Audit could not be saved. Your form is still available to retry.",
      );
    } finally {
      setAuditSaving(false);
    }
  };

  if (
    !referenceBrowser &&
    !checkoutMode &&
    !auditMode &&
    !scannedSupply &&
    !scanConfirmation &&
    !reviewMode &&
    !scannerOpen
  )
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#080808] px-5 py-8 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col">
          <div className="flex flex-1 flex-col justify-center pb-16">
            <header>
              <h1 className="text-4xl font-black tracking-tight">
                EMS Supplies
              </h1>
              <p className="mt-3 text-base leading-6 text-white/55">
                Scan a supply to check it out.
              </p>
            </header>
            <div className="mt-10 space-y-4">
              <button
                type="button"
                onClick={() => {
                  setScannerOpen(true);
                  setAuditMode(false);
                  setError(null);
                }}
                className="flex min-h-28 w-full items-center justify-center gap-4 rounded-[24px] border border-red-300/30 bg-[#ef2b2d] px-6 text-xl font-black uppercase tracking-[0.08em] text-white shadow-[0_18px_40px_rgba(239,43,45,0.24)]"
              >
                <ScanLine className="h-8 w-8" />
                Scan Supply
              </button>
              <button
                type="button"
                onClick={openReferenceBrowser}
                className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/[0.04] px-5 text-base font-black text-white/85"
              >
                <Search className="h-5 w-5 text-white/55" />
                Find a Supply
              </button>
            </div>
            {error ? (
              <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-bold text-red-100">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </main>
    );
  if (scannerOpen)
    return (
      <MobileEmsQrScanner
        onResolved={handleScan}
        onFinish={finishScanSession}
        sessionCount={lines.length}
        onFallback={() => {
          setScannerOpen(false);
          setReferenceBrowser(true);
          setError(null);
        }}
      />
    );
  if (scannedSupply)
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#080808] px-5 py-6 text-white sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-2xl flex-col gap-5">
          <button type="button" onClick={() => { setScannedSupply(null); setScannedQuantity(""); setScannerOpen(true); }} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white/60">
            <ArrowLeft className="h-4 w-4" />
            Back to Scan
          </button>
          <header className="mt-8">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6565]">EMS Supplies</p>
            <h1 className="mt-3 break-words text-3xl font-black tracking-tight">{scannedSupply.item_name}</h1>
          </header>
          {error ? <div className="error-box">{error}</div> : null}
          <div className="mt-8 flex flex-1 flex-col">
            <section className="border-y border-white/10 py-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Available</p>
              <p className="mt-2 text-2xl font-black text-white">{formatNumber(scannedSupply.quantity_on_hand)} <span className="text-base text-white/50">{displayUnit(scannedSupply)}</span></p>
            </section>
            <section className="mt-10">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">How many are you taking?</p>
              <label className="mt-3 block">
                <span className="sr-only">Quantity</span>
                <input
                  autoFocus
                  type="number"
                  min="1"
                  max={scannedSupply.quantity_on_hand}
                  step="1"
                  inputMode="numeric"
                  value={scannedQuantity}
                  onChange={(event) => setScannedQuantity(event.target.value)}
                  className="min-h-24 w-full rounded-2xl border border-red-300/35 bg-[#151515] px-5 text-center text-5xl font-black text-white outline-none transition focus:border-[#ef2b2d]"
                />
              </label>
              <p className="mt-3 text-sm text-white/45">{Number(scannedQuantity) > 0 && Number(scannedQuantity) <= Number(scannedSupply.quantity_on_hand) ? `${formatNumber(Number(scannedSupply.quantity_on_hand) - Number(scannedQuantity))} ${displayUnit(scannedSupply)} remaining after checkout` : "Enter a whole quantity within available stock"}</p>
            </section>
            <div className="mt-auto space-y-3 pt-10">
              <button type="button" onClick={addScannedToSession} className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#ef2b2d] px-4 text-base font-black uppercase tracking-[0.08em] text-white shadow-[0_14px_30px_rgba(239,43,45,0.2)]">Add to Checkout</button>
              <button type="button" onClick={() => { setScannedSupply(null); setScannedQuantity(""); setScannerOpen(true); }} className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/12 bg-white/[0.03] px-4 text-sm font-black uppercase tracking-[0.08em] text-white/65">Scan Another Supply</button>
            </div>
          </div>
        </div>
      </main>
    );
  if (scanConfirmation)
    return (
      <main className="page">
        <div className="content flex min-h-[70vh] flex-col justify-center">
          <section className="success-box text-center">
            <Check className="mx-auto h-8 w-8" />
            <p className="mt-3 font-black">{scanConfirmation}</p>
            <p className="mt-2 text-sm text-white/60">Scan Next Supply</p>
          </section>
        </div>
      </main>
    );
  if (referenceBrowser && !checkoutMode && !auditMode)
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#080808] px-4 py-6 text-white sm:px-6">
        <div className="mx-auto w-full max-w-2xl space-y-5 pb-8">
          <button
            type="button"
            onClick={() => setReferenceBrowser(false)}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white/65"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <header>
            <h1 className="text-3xl font-black tracking-tight">
              Find a Supply
            </h1>
          </header>
          <label className="block">
            <span className="sr-only">Search supplies</span>
            <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/15 bg-[#121212] px-4 focus-within:border-[#ef2b2d]">
              <Search className="h-5 w-5 shrink-0 text-white/40" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search supplies..."
                className="min-h-12 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/35"
              />
            </div>
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(["All", "Low", "Critical", "Out"] as const).map((option) => {
              const filterValue =
                option === "All"
                  ? "All"
                  : option === "Low"
                    ? "Low"
                    : option === "Critical"
                      ? "Critical"
                      : "Out of Stock";
              const active = filter === filterValue;
              return (
                <button
                  type="button"
                  key={option}
                  onClick={() => setFilter(filterValue)}
                  className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm font-black ${active ? "border-[#ef2b2d] bg-[#ef2b2d]/15 text-white" : "border-white/12 bg-white/[0.04] text-white/55"}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {lines.length > 0 ? (
            <section className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-white">
                  {lines.length} {lines.length === 1 ? "supply type" : "supply types"} in checkout
                </p>
                <button type="button" onClick={() => { setReferenceBrowser(false); setReviewMode(true); }} className="min-h-11 rounded-xl bg-[#ef2b2d] px-4 text-xs font-black uppercase text-white">
                  Finish Session
                </button>
              </div>
            </section>
          ) : null}
          <section className="space-y-0">
            {loading ? (
              <p className="py-8 text-sm text-white/50">Loading supplies...</p>
            ) : (
              filtered.map((item) => (
                <ReferenceSupplyCard key={item.id} item={item} />
              ))
            )}
          </section>
          {canAudit ? (
            <button
              type="button"
              onClick={() => {
                setAuditMode(true);
                setAuditSuccess(null);
                setAuditError(null);
              }}
              className="text-xs font-bold text-white/35"
            >
              Inventory management
            </button>
          ) : null}
        </div>
      </main>
    );
  if (reviewMode)
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#080808] px-5 py-6 text-white sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col">
          <button type="button" onClick={() => setReviewMode(false)} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white/60">
            <ArrowLeft className="h-4 w-4" />
            Back to Scan
          </button>
          <header className="border-b border-white/10 pb-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6565]">Checkout Session</p>
            <div className="mt-2 flex items-end justify-between gap-4"><h1 className="text-3xl font-black tracking-tight">Confirm Checkout</h1><span className="text-sm font-black text-white/50">{lines.length} {lines.length === 1 ? "type" : "types"}</span></div>
            <p className="mt-2 text-sm text-white/50">Review what you are checking out before confirming.</p>
          </header>
          {error ? <div className="error-box">{error}</div> : null}
          <section className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/45">What I am checking out</p>
            <div className="space-y-3">
            {lines.map((line) => (
              <SessionCard
                key={line.supply.id}
                line={line}
                onRemove={() =>
                  setLines((current) =>
                    current.filter(
                      (entry) => entry.supply.id !== line.supply.id,
                    ),
                  )
                }
                onAdjust={(delta) => adjustLine(line.supply.id, delta)}
              />
            ))}
            </div>
          </section>
          <DestinationFields
            type={destinationType}
            setType={setDestinationType}
            apparatusId={destinationApparatusId}
            setApparatusId={setDestinationApparatusId}
            label={destinationText}
            setLabel={setDestinationText}
            apparatus={apparatusOptions}
          />
          <label className="panel label">
            Optional notes
            <textarea
              value={checkoutNotes}
              onChange={(event) => setCheckoutNotes(event.target.value)}
              rows={3}
              className="field mt-2"
            />
          </label>
          {destinationError ? (
            <p className="warning">{destinationError}</p>
          ) : null}
          <p className="supporting">
            Destination:{" "}
            <strong>
              {destinationLabel(
                destinationType,
                apparatusOptions,
                destinationApparatusId,
                destinationText,
              )}
            </strong>
          </p>
          <button
            type="button"
            onClick={submitCheckout}
            disabled={submitting || Boolean(destinationError)}
            className="mt-auto flex min-h-16 w-full items-center justify-center rounded-2xl bg-[#ef2b2d] px-4 text-base font-black uppercase tracking-[0.08em] text-white shadow-[0_16px_34px_rgba(239,43,45,0.22)] disabled:bg-white/15 disabled:text-white/40"
          >
            {submitting ? "Checking stock..." : "Confirm Checkout"}
            <Check className="h-5 w-5" />
          </button>
        </div>
      </main>
    );

  return (
    <main className="page">
      <div className="content">
        <div className="top-row">
          <Link href="/mobile" className="back-link">
            <ArrowLeft className="h-4 w-4" />
            Field Actions
          </Link>
          {focused ? (
            <button
              type="button"
              onClick={resetCheckout}
              className="subtle-button"
            >
              Exit Workflow
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <header className="hero">
          <div className="hero-title">
            <HeartPulse className="h-6 w-6 text-[#ff6565]" />
            <div>
              <p className="eyebrow">EMS Operations</p>
              <h1>EMS Supplies</h1>
            </div>
          </div>
          <p className="supporting">
            {focused
              ? "Add each supply you are taking, then review the complete checkout."
              : "Find a medical supply, check its availability, and see where it is stored."}
          </p>
          <div className="action-grid">
            <button
              type="button"
              onClick={() => {
                setScannerOpen(true);
                setAuditMode(false);
                setError(null);
              }}
              className="primary-button"
            >
              <ScanLine className="h-4 w-4" />
              Scan Supply
            </button>
            <button
              type="button"
              onClick={startCheckout}
              className="primary-button"
            >
              <Search className="h-4 w-4" />
              {focused ? "Add Supplies" : "Start Checkout"}
            </button>
          </div>
          {canAudit && !focused ? (
            <button
              type="button"
              onClick={() => {
                setAuditMode(true);
                setAuditSuccess(null);
                setAuditError(null);
              }}
              className="secondary-button mt-2"
            >
              Adjust Quantity
            </button>
          ) : null}
        </header>
        {success ? (
          <div className="success-box">
            <Check className="h-5 w-5" />
            {success}
          </div>
        ) : null}
        {error ? (
          <div className="error-box">
            <AlertTriangle className="h-5 w-5" />
            {error}
          </div>
        ) : null}
        {auditMode ? (
          <section className="audit-box">
            <div className="top-row">
              <div>
                <p className="eyebrow">Administrator audit</p>
                <h2>Adjust Quantity</h2>
              </div>
              <button
                type="button"
                onClick={() => setAuditMode(false)}
                className="icon-button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {auditSuccess ? (
              <p className="success-box mt-3">{auditSuccess}</p>
            ) : null}
            {auditError ? <p className="error-box mt-3">{auditError}</p> : null}
            {auditSupply ? (
              <div className="stack mt-3">
                <div className="panel">
                  <strong>{auditSupply.item_name}</strong>
                  <p className="supporting">
                    System Quantity:{" "}
                    {formatNumber(auditSupply.quantity_on_hand)}{" "}
                    {displayUnit(auditSupply)}
                  </p>
                </div>
                <label className="label">
                  Physical Count
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    step="any"
                    value={physicalCount}
                    onChange={(event) => setPhysicalCount(event.target.value)}
                    className="field mt-2"
                  />
                </label>
                <p className="panel">
                  Difference:{" "}
                  <strong>
                    {difference === null
                      ? "-"
                      : `${difference > 0 ? "+" : ""}${formatNumber(difference)} ${displayUnit(auditSupply)}`}
                  </strong>
                </p>
                <label className="label">
                  Reason <span className="warning">required</span>
                  <input
                    value={auditReason}
                    onChange={(event) => setAuditReason(event.target.value)}
                    placeholder="Why is the count changing?"
                    className="field mt-2"
                  />
                </label>
                <label className="label">
                  Notes <span className="supporting">optional</span>
                  <textarea
                    value={auditNotes}
                    onChange={(event) => setAuditNotes(event.target.value)}
                    rows={3}
                    className="field mt-2"
                  />
                </label>
                <button
                  type="button"
                  onClick={saveAudit}
                  disabled={auditSaving}
                  className="audit-button"
                >
                  {auditSaving ? "Saving Audit..." : "Save Audit"}
                  <Check className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <p className="supporting mt-3">
                Select a supply below to compare the system quantity with a
                physical count.
              </p>
            )}
          </section>
        ) : null}
        {checkoutMode ? (
          <section className="panel">
            <div className="top-row">
              <div>
                <p className="eyebrow">Current session</p>
                <h2>
                  {lines.length}{" "}
                  {lines.length === 1 ? "supply type" : "supply types"}
                </h2>
              </div>
              {lines.length ? (
                <button
                  type="button"
                  onClick={resetCheckout}
                  className="subtle-button"
                >
                  Clear
                </button>
              ) : null}
            </div>
            {lines.length ? (
              <div className="stack mt-3">
                {lines.map((line) => (
                  <SessionCard
                    key={line.supply.id}
                    line={line}
                    onRemove={() =>
                      setLines((current) =>
                        current.filter(
                          (entry) => entry.supply.id !== line.supply.id,
                        ),
                      )
                    }
                    onAdjust={(delta) => adjustLine(line.supply.id, delta)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setReviewMode(true)}
                  className="primary-button"
                >
                  Finish Session
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <p className="supporting mt-3">Select the next supply below.</p>
            )}
          </section>
        ) : null}
        {selected ? (
          <section className="selected-box">
            <div className="top-row">
              <div>
                <p className="eyebrow">Selected supply</p>
                <h2>{selected.item_name}</h2>
                <p className="supporting">
                  Current: {formatNumber(selected.quantity_on_hand)}{" "}
                  {displayUnit(selected)} ·{" "}
                  {selected.location || "Location not recorded"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="icon-button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="label mt-3">
              How many are you taking?
              <input
                autoFocus
                type="number"
                min="1"
                max={selected.quantity_on_hand}
                step="1"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="quantity-field mt-2"
              />
            </label>
            <button
              type="button"
              onClick={addToSession}
              className="primary-button mt-3"
            >
              Add to Session
              <Plus className="h-5 w-5" />
            </button>
          </section>
        ) : null}
        <section className="stack">
          <div className="top-row">
            <div>
              <p className="eyebrow">
                {auditMode
                  ? "Select supply for audit"
                  : focused
                    ? "Add supplies"
                    : "Reference browser"}
              </p>
              <h2>Find a supply</h2>
            </div>
            <span className="supporting">{filtered.length} shown</span>
          </div>
          <label className="search-field">
            <Search className="h-5 w-5" />
            <span className="sr-only">Search supplies</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or category"
            />
          </label>
          <div className="filter-row">
            {(["All", "Low", "Critical", "Out of Stock"] as const).map(
              (option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={filter === option ? "filter active" : "filter"}
                >
                  {option === "Low" ? "Low Stock" : option}
                </button>
              ),
            )}
          </div>
          {loading ? <div className="panel">Loading supplies...</div> : null}
          {!loading && !filtered.length ? (
            <div className="panel text-center">No supplies found.</div>
          ) : null}
          {filtered.map((item) => (
            <SupplyCard
              key={item.id}
              item={item}
              actionLabel={auditMode ? "Select for Audit" : "Add to Session"}
              onSelect={() =>
                auditMode
                  ? (setAuditId(item.id),
                    setPhysicalCount(String(item.quantity_on_hand)),
                    setAuditError(null))
                  : selectSupply(item)
              }
            />
          ))}
        </section>
      </div>
    </main>
  );
}
