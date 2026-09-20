"use client";

import Link from "next/link";
import { useMemo, useState, type ComponentType } from "react";
import {
  Activity,
  AlertTriangle,
  Ambulance,
  ArrowLeft,
  Boxes,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Gauge,
  Search,
  Truck,
  Users,
  Wrench,
} from "lucide-react";

import { REPORT_DATE_PRESETS, buildDateRangeFromPreset } from "@/lib/reports/date-range";
import { REPORT_SOURCES } from "@/lib/reports/registry";
import type {
  ReportCategoryKey,
  ReportDatePresetKey,
  ReportFilterDefinition,
  ReportResultPayload,
  ReportRunResponse,
} from "@/lib/reports/types";

type Option = { id: string; name: string };
type MemberOption = Option & { station?: string | null; shift?: string | null; active?: boolean | null; departmentRoleId?: string | null };

type Props = {
  members: MemberOption[];
  trainingCategories: Option[];
  apparatus: Option[];
  fireHose: Option[];
  scbaCylinders: Option[];
  scbaPacks: Option[];
  gasMonitors: Option[];
  ropeItems: Option[];
  groundLadders: Option[];
  emsSupplies: Option[];
  initialError: string | null;
};

type Step = "home" | "questions" | "filters" | "results" | "member-results" | "category-results";
type Icon = ComponentType<{ className?: string }>;

type Question = {
  key: string;
  name: string;
  question: string;
  sourceKey: ReportCategoryKey;
  icon: Icon;
  defaultFilters: Record<string, string>;
  filterKeys: string[];
  future?: boolean;
};

type Category = {
  key: ReportCategoryKey;
  name: string;
  description: string;
  question: string;
  icon: Icon;
  questions: Question[];
};

const categoryDefinitions: Category[] = [
  {
    key: "training",
    name: "Training",
    description: "Course records, attendance, and training-hour summaries.",
    question: "How much training have we completed?",
    icon: FileText,
    questions: [
      { key: "training-hours", name: "Training Hours", question: "How many hours have we completed?", sourceKey: "training", icon: Gauge, defaultFilters: { member_id: "all", category_id: "all" }, filterKeys: ["member_id", "category_id"] },
      { key: "training-records", name: "Training Records", question: "What training occurred?", sourceKey: "training", icon: FileText, defaultFilters: { member_id: "all", category_id: "all" }, filterKeys: ["member_id", "category_id"] },
      { key: "training-members", name: "Training by Member", question: "Who completed the training?", sourceKey: "training", icon: Users, defaultFilters: { member_id: "all", category_id: "all" }, filterKeys: ["member_id", "category_id"] },
      { key: "training-category", name: "Training by Category", question: "What subjects did we train on?", sourceKey: "training", icon: FileText, defaultFilters: { member_id: "all", category_id: "all" }, filterKeys: ["member_id", "category_id"] },
      { key: "training-sources", name: "Training Sources", question: "Where did the training come from?", sourceKey: "training", icon: FileText, defaultFilters: { member_id: "all", category_id: "all" }, filterKeys: ["member_id", "category_id"], future: true },
    ],
  },
  {
    key: "personnel",
    name: "Personnel",
    description: "Roster, active status, roles, stations, and shifts.",
    question: "How many active members do we have?",
    icon: Users,
    questions: [
      { key: "personnel-overview", name: "Personnel Overview", question: "How many members do we have?", sourceKey: "personnel", icon: Users, defaultFilters: { status: "active", role_id: "all", station: "all", shift: "all" }, filterKeys: ["status", "role_id", "station", "shift"] },
      { key: "personnel-roster", name: "Personnel Roster", question: "Who is on the department roster?", sourceKey: "personnel", icon: Users, defaultFilters: { status: "all", role_id: "all", station: "all", shift: "all" }, filterKeys: ["status", "role_id", "station", "shift"] },
      { key: "personnel-station", name: "Personnel by Station", question: "Who is assigned to each station?", sourceKey: "personnel", icon: Users, defaultFilters: { status: "active", role_id: "all", station: "all", shift: "all" }, filterKeys: ["status", "role_id", "station", "shift"] },
      { key: "personnel-shift", name: "Personnel by Shift", question: "Who is assigned to each shift?", sourceKey: "personnel", icon: Users, defaultFilters: { status: "active", role_id: "all", station: "all", shift: "all" }, filterKeys: ["status", "role_id", "station", "shift"] },
      { key: "personnel-role", name: "Personnel by Role", question: "Who holds each department role?", sourceKey: "personnel", icon: Users, defaultFilters: { status: "active", role_id: "all", station: "all", shift: "all" }, filterKeys: ["status", "role_id", "station", "shift"] },
      { key: "personnel-inactive", name: "Inactive Personnel", question: "Which members are inactive?", sourceKey: "personnel", icon: Users, defaultFilters: { status: "inactive", role_id: "all", station: "all", shift: "all" }, filterKeys: ["status", "role_id", "station", "shift"] },
    ],
  },
  {
    key: "certifications",
    name: "Certifications",
    description: "Certification status, expiration, and supporting evidence.",
    question: "What's expiring soon?",
    icon: FileText,
    questions: [
      { key: "certification-status", name: "Certification Status", question: "What is current, expiring, or expired?", sourceKey: "certifications", icon: FileText, defaultFilters: { member_id: "all", certification_id: "all", status: "all", expiration_window: "all", date_basis: "all-dates" }, filterKeys: ["member_id", "certification_id", "status", "expiration_window", "date_basis"] },
      { key: "certification-expiring", name: "Expiring Certifications", question: "What's expiring soon?", sourceKey: "certifications", icon: FileText, defaultFilters: { member_id: "all", certification_id: "all", status: "expiring", expiration_window: "next-90", date_basis: "all-dates" }, filterKeys: ["member_id", "certification_id", "status", "expiration_window", "date_basis"] },
      { key: "certification-expired", name: "Expired Certifications", question: "What has expired?", sourceKey: "certifications", icon: AlertTriangle, defaultFilters: { member_id: "all", certification_id: "all", status: "expired", expiration_window: "all", date_basis: "all-dates" }, filterKeys: ["member_id", "certification_id", "status", "expiration_window", "date_basis"] },
      { key: "certification-member", name: "Certifications by Member", question: "What certifications does each member hold?", sourceKey: "certifications", icon: Users, defaultFilters: { member_id: "all", certification_id: "all", status: "all", expiration_window: "all", date_basis: "all-dates" }, filterKeys: ["member_id", "certification_id", "status", "expiration_window", "date_basis"] },
      { key: "certification-type", name: "Certifications by Type", question: "Which certifications are represented?", sourceKey: "certifications", icon: FileText, defaultFilters: { member_id: "all", certification_id: "all", status: "all", expiration_window: "all", date_basis: "all-dates" }, filterKeys: ["member_id", "certification_id", "status", "expiration_window", "date_basis"] },
    ],
  },
  {
    key: "apparatus",
    name: "Apparatus",
    description: "Readiness, checks, mileage, pump tests, and linked signals.",
    question: "What's ready for service?",
    icon: Truck,
    questions: [
      { key: "apparatus-readiness", name: "Apparatus Readiness", question: "What's ready for service?", sourceKey: "apparatus", icon: Truck, defaultFilters: { report_type: "overview", apparatus_id: "all", apparatus_status: "all", check_status: "all", inspected_by: "all", check_activity: "all" }, filterKeys: ["report_type", "apparatus_id", "apparatus_status", "check_status", "inspected_by", "check_activity"] },
      { key: "apparatus-mileage", name: "Mileage and Engine Hours", question: "What readings were recorded?", sourceKey: "apparatus", icon: Gauge, defaultFilters: { report_type: "mileage-hours", apparatus_id: "all", inspected_by: "all" }, filterKeys: ["report_type", "apparatus_id", "inspected_by"] },
      { key: "apparatus-pump", name: "Pump Testing", question: "How did pump testing go?", sourceKey: "apparatus", icon: Gauge, defaultFilters: { report_type: "pump-testing", apparatus_id: "all" }, filterKeys: ["report_type", "apparatus_id"] },
      { key: "apparatus-deficiencies", name: "Apparatus Deficiencies", question: "Which apparatus has deficiencies?", sourceKey: "apparatus", icon: AlertTriangle, defaultFilters: { report_type: "overview", apparatus_id: "all", apparatus_status: "all", check_status: "all", inspected_by: "all", check_activity: "all" }, filterKeys: ["report_type", "apparatus_id", "apparatus_status", "check_status", "check_activity"] },
      { key: "apparatus-maintenance", name: "Apparatus Maintenance", question: "What maintenance occurred on apparatus?", sourceKey: "apparatus", icon: Wrench, defaultFilters: { report_type: "overview", apparatus_id: "all", apparatus_status: "all", check_status: "all", check_activity: "all" }, filterKeys: ["report_type", "apparatus_id", "apparatus_status", "check_activity"] },
    ],
  },
  {
    key: "maintenance",
    name: "Maintenance",
    description: "Maintenance schedules, completed work, and notes.",
    question: "What maintenance was completed?",
    icon: Wrench,
    questions: [{ key: "maintenance-completed", name: "Completed Maintenance", question: "What maintenance was completed?", sourceKey: "maintenance", icon: Wrench, defaultFilters: { apparatus_id: "all", maintenance_type: "all", completed_by: "all", linked_deficiency: "all" }, filterKeys: ["apparatus_id", "maintenance_type", "completed_by", "linked_deficiency"] }],
  },
  {
    key: "inspections",
    name: "Inspections",
    description: "Inspection and testing records across field equipment.",
    question: "What's due or overdue?",
    icon: ClipboardCheck,
    questions: [
      { key: "inspection-status", name: "Inspection Status", question: "What's due or overdue?", sourceKey: "inspections", icon: ClipboardCheck, defaultFilters: { report_type: "all-inspections", inspection_result: "all", due_status: "all" }, filterKeys: ["report_type", "inspection_result", "due_status"] },
      { key: "inspection-testing", name: "Inspection and Testing", question: "What inspections and tests occurred?", sourceKey: "inspections", icon: ClipboardCheck, defaultFilters: { report_type: "all-inspections", inspection_result: "all", due_status: "all" }, filterKeys: ["report_type", "inspection_result", "due_status"] },
    ],
  },
  {
    key: "deficiencies",
    name: "Deficiencies",
    description: "Status, priority, and equipment-linked deficiency records.",
    question: "What needs attention?",
    icon: AlertTriangle,
    questions: [{ key: "deficiency-attention", name: "Needs Attention", question: "What needs attention?", sourceKey: "deficiencies", icon: AlertTriangle, defaultFilters: { status: "open", priority: "all" }, filterKeys: ["status", "priority"] }],
  },
  {
    key: "inventory",
    name: "Inventory",
    description: "Equipment status, due dates, and open deficiency counts.",
    question: "What's low or out of service?",
    icon: Boxes,
    questions: [
      { key: "inventory-status", name: "Inventory Status", question: "What's low or out of service?", sourceKey: "inventory", icon: Boxes, defaultFilters: { inventory_category: "all", inventory_report_type: "inventory" }, filterKeys: ["inventory_category", "inventory_report_type"] },
      { key: "inventory-testing", name: "Inventory Testing and Inspections", question: "What equipment testing occurred?", sourceKey: "inventory", icon: ClipboardCheck, defaultFilters: { inventory_category: "all", inventory_report_type: "inventory" }, filterKeys: ["inventory_category", "inventory_report_type"] },
    ],
  },
  {
    key: "ems",
    name: "EMS",
    description: "EMS readiness, training, equipment, and supplies.",
    question: "How are we doing on EMS readiness?",
    icon: Ambulance,
    questions: [
      { key: "ems-readiness", name: "EMS Certification Readiness", question: "How are we doing on EMS readiness?", sourceKey: "ems", icon: Ambulance, defaultFilters: { report_type: "certification-status", report_scope: "iowa-and-nremt", member_id: "all", ems_level: "all", iowa_status: "all", nremt_maintained: "all", readiness_status: "all", expiration_window: "all" }, filterKeys: ["report_type", "report_scope", "member_id", "ems_level", "iowa_status", "nremt_maintained", "readiness_status", "expiration_window"] },
      { key: "ems-training", name: "EMS Training", question: "What EMS training occurred?", sourceKey: "ems", icon: FileText, defaultFilters: { report_type: "training", member_id: "all", training_category_id: "all" }, filterKeys: ["report_type", "member_id", "training_category_id"] },
      { key: "ems-equipment", name: "EMS Equipment", question: "What is the status of EMS equipment?", sourceKey: "ems", icon: Ambulance, defaultFilters: { report_type: "equipment", equipment_id: "all", equipment_status: "all" }, filterKeys: ["report_type", "equipment_id", "equipment_status"] },
      { key: "ems-supplies", name: "EMS Supplies", question: "What supplies are low or out?", sourceKey: "ems", icon: Boxes, defaultFilters: { report_type: "supplies", supply_id: "all", supply_status: "all", supply_stock_level: "all" }, filterKeys: ["report_type", "supply_id", "supply_status", "supply_stock_level"] },
    ],
  },
  {
    key: "activity",
    name: "Activity",
    description: "A timeline of recorded operational events.",
    question: "What's happened recently?",
    icon: Activity,
    questions: [
      { key: "activity-recent", name: "Recent Activity", question: "What's happened recently?", sourceKey: "activity", icon: Activity, defaultFilters: { member_id: "all", module: "all", action: "all" }, filterKeys: ["member_id", "module", "action"] },
      { key: "activity-by-member", name: "Activity by Member", question: "What has each member done recently?", sourceKey: "activity", icon: Users, defaultFilters: { member_id: "all", module: "all", action: "all" }, filterKeys: ["member_id", "module", "action"] },
    ],
  },
  {
    key: "pre-plans",
    name: "Pre-Plans",
    description: "Pre-plan records, site details, hazards, and hydrants.",
    question: "What pre-plans need attention?",
    icon: FileText,
    questions: [{ key: "pre-plan-updates", name: "Updated Pre-Plans", question: "What pre-plans need attention?", sourceKey: "pre-plans", icon: FileText, defaultFilters: {}, filterKeys: [] }],
  },
];

const preferredDatePresets: ReportDatePresetKey[] = ["this-year", "this-month", "last-month", "last-30-days", "last-90-days", "last-180-days", "last-year", "custom"];
const mobileControlClassName = "mt-2 min-h-14 w-full appearance-none rounded-2xl border border-white/15 bg-[#080808] px-4 text-base text-white outline-none transition [color-scheme:dark] focus:border-[#ef2b2d] disabled:bg-white/10 disabled:text-white/40";
const secondaryButtonClassName = "min-h-12 appearance-none rounded-xl border border-white/12 bg-[#080808] px-4 text-sm font-black uppercase text-white/70 transition [color-scheme:dark] hover:border-white/20 hover:bg-[#121212] active:scale-[0.99]";

function text(value: unknown) {
  if (typeof value === "number") return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "-";
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value);
}

function formatGenerated(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", day: "2-digit", hour: "numeric", minute: "2-digit" });
}

function dateRangeForQuestion(question: Question) {
  const preset = question.sourceKey === "training" ? "this-year" : "last-30-days";
  return { preset: preset as ReportDatePresetKey, ...buildDateRangeFromPreset(preset as ReportDatePresetKey) };
}

export default function MobileReports({ members, trainingCategories, apparatus, fireHose, scbaCylinders, scbaPacks, gasMonitors, ropeItems, groundLadders, emsSupplies, initialError }: Props) {
  const [step, setStep] = useState<Step>("home");
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<ReportCategoryKey | "">("");
  const [selectedQuestionKey, setSelectedQuestionKey] = useState("");
  const [dateRange, setDateRange] = useState({ preset: "this-year" as ReportDatePresetKey, ...buildDateRangeFromPreset("this-year") });
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [result, setResult] = useState<ReportResultPayload | null>(null);
  const [memberResult, setMemberResult] = useState<ReportResultPayload | null>(null);
  const [selectedMemberName, setSelectedMemberName] = useState<string | null>(null);
  const [categoryResult, setCategoryResult] = useState<ReportResultPayload | null>(null);
  const [selectedTrainingCategoryName, setSelectedTrainingCategoryName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const selectedCategory = categoryDefinitions.find((category) => category.key === selectedCategoryKey) ?? null;
  const selectedQuestion = selectedCategory?.questions.find((question) => question.key === selectedQuestionKey) ?? null;
  const selectedSource = selectedQuestion ? REPORT_SOURCES.find((source) => source.key === selectedQuestion.sourceKey) ?? null : null;

  const filterDefinitions = useMemo(() => {
    if (!selectedQuestion || !selectedSource) return [] as ReportFilterDefinition[];
    return selectedSource.filters.filter((filter) => selectedQuestion.filterKeys.includes(filter.key)).map((filter) => {
      if (filter.key === "apparatus_id") return { ...filter, options: [{ value: "all", label: "All Apparatus" }, ...apparatus.map((item) => ({ value: item.id, label: item.name }))] };
      if (["completed_by", "member_id", "inspected_by"].includes(filter.key)) return { ...filter, options: [{ value: "all", label: "All Members" }, ...members.map((item) => ({ value: item.id, label: item.name }))] };
      if (filter.key === "category_id" || filter.key === "training_category_id") return { ...filter, options: [{ value: "all", label: "All Categories" }, ...trainingCategories.map((item) => ({ value: item.id, label: item.name }))] };
      if (filter.key === "fire_hose_id") return { ...filter, options: [{ value: "all", label: "All Fire Hose" }, ...fireHose.map((item) => ({ value: item.id, label: item.name }))] };
      if (filter.key === "scba_cylinder_id") return { ...filter, options: [{ value: "all", label: "All SCBA Cylinders" }, ...scbaCylinders.map((item) => ({ value: item.id, label: item.name }))] };
      if (filter.key === "scba_pack_id") return { ...filter, options: [{ value: "all", label: "All SCBA Packs" }, ...scbaPacks.map((item) => ({ value: item.id, label: item.name }))] };
      if (filter.key === "gas_monitor_id") return { ...filter, options: [{ value: "all", label: "All Gas Monitors" }, ...gasMonitors.map((item) => ({ value: item.id, label: item.name }))] };
      if (filter.key === "rope_item_id") return { ...filter, options: [{ value: "all", label: "All Rope Items" }, ...ropeItems.map((item) => ({ value: item.id, label: item.name }))] };
      if (filter.key === "ground_ladder_id") return { ...filter, options: [{ value: "all", label: "All Ground Ladders" }, ...groundLadders.map((item) => ({ value: item.id, label: item.name }))] };
      if (filter.key === "supply_id") return { ...filter, options: [{ value: "all", label: "All Supplies" }, ...emsSupplies.map((item) => ({ value: item.id, label: item.name }))] };
      return filter;
    });
  }, [apparatus, emsSupplies, fireHose, gasMonitors, groundLadders, members, ropeItems, scbaCylinders, scbaPacks, selectedQuestion, selectedSource, trainingCategories]);

  function chooseCategory(category: Category) {
    setSelectedCategoryKey(category.key);
    setSelectedQuestionKey("");
    setResult(null);
    setMemberResult(null);
    setSelectedMemberName(null);
    setCategoryResult(null);
    setSelectedTrainingCategoryName(null);
    setError(null);
    setStep("questions");
  }

  function chooseQuestion(question: Question) {
    if (question.future) return;
    const isReturningToCurrentQuestion = selectedQuestionKey === question.key;
    setSelectedQuestionKey(question.key);
    if (!isReturningToCurrentQuestion) {
      setFilters(question.defaultFilters);
      setDateRange(dateRangeForQuestion(question));
      setSearchTerm("");
      setShowMoreFilters(false);
    }
    setResult(null);
    setMemberResult(null);
    setSelectedMemberName(null);
    setCategoryResult(null);
    setSelectedTrainingCategoryName(null);
    setError(null);
    setStep("filters");
  }

  function goBack() {
    if (step === "member-results") {
      setError(null);
      setStep("results");
      return;
    }
    if (step === "category-results") {
      setError(null);
      setStep("results");
      return;
    }
    if (step === "results") setStep("filters");
    else if (step === "filters") setStep("questions");
    else if (step === "questions") setStep("home");
  }

  function changePreset(preset: ReportDatePresetKey) {
    if (preset === "custom") {
      setDateRange((current) => ({ ...current, preset }));
      return;
    }
    setDateRange({ preset, ...buildDateRangeFromPreset(preset) });
  }

  async function runMobileReport() {
    if (!selectedQuestion) return;
    setIsRunning(true);
    setError(null);
    setResult(null);
    setExpandedRows(new Set());
    try {
      const response = await fetch("/api/reports/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: selectedQuestion.sourceKey, searchTerm, dateRange, filters: { ...selectedQuestion.defaultFilters, ...filters }, page: 1, pageSize: 50 }),
      });
      const body = (await response.json().catch(() => null)) as ReportRunResponse | null;
      if (!response.ok || !body || !body.ok) {
        setError(!body || body.ok ? "Unable to run report." : body.error);
        return;
      }
      setResult(body);
      setStep("results");
    } catch {
      setError("Unable to run report.");
    } finally {
      setIsRunning(false);
    }
  }

  async function openTrainingMember(memberId: string, memberName: string) {
    if (!selectedQuestion || selectedQuestion.sourceKey !== "training") return;

    setSelectedMemberName(memberName);
    setMemberResult(null);
    setError(null);
    setIsRunning(true);

    try {
      const response = await fetch("/api/reports/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: selectedQuestion.sourceKey,
          searchTerm,
          dateRange,
          filters: { ...selectedQuestion.defaultFilters, ...filters, member_id: memberId },
          page: 1,
          pageSize: 0,
        }),
      });
      const body = (await response.json().catch(() => null)) as ReportRunResponse | null;
      if (!response.ok || !body || !body.ok) {
        setError(!body || body.ok ? "Unable to load member training." : body.error);
        return;
      }
      setMemberResult(body);
      setExpandedRows(new Set());
      setStep("member-results");
    } catch {
      setError("Unable to load member training.");
    } finally {
      setIsRunning(false);
    }
  }

  async function openTrainingCategory(categoryId: string | null, categoryName: string) {
    if (!selectedQuestion || selectedQuestion.sourceKey !== "training") return;

    setSelectedTrainingCategoryName(categoryName);
    setCategoryResult(null);
    setError(null);
    setIsRunning(true);

    try {
      const response = await fetch("/api/reports/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: selectedQuestion.sourceKey,
          searchTerm,
          dateRange,
          filters: { ...selectedQuestion.defaultFilters, ...filters, category_id: categoryId ?? "all" },
          page: 1,
          pageSize: 0,
        }),
      });
      const body = (await response.json().catch(() => null)) as ReportRunResponse | null;
      if (!response.ok || !body || !body.ok) {
        setError(!body || body.ok ? "Unable to load category training." : body.error);
        return;
      }
      setCategoryResult(body);
      setExpandedRows(new Set());
      setStep("category-results");
    } catch {
      setError("Unable to load category training.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#080808] px-4 py-5 text-white [color-scheme:dark] sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-10">
        <div className="flex items-center justify-between gap-3">
          {step === "home" ? <Link href="/mobile" className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">Back to Field Actions</Link> : <button type="button" onClick={goBack} className="inline-flex min-h-12 items-center gap-2 text-sm font-bold text-white/65"><ArrowLeft className="h-4 w-4" /> Back</button>}
          <span className="text-xs font-black uppercase tracking-[0.18em] text-[#ef2b2d]">Reports</span>
        </div>
        {step === "home" ? <HomeScreen onChoose={chooseCategory} /> : null}
        {step === "questions" && selectedCategory ? <QuestionScreen category={selectedCategory} onChoose={chooseQuestion} /> : null}
        {isRunning ? <ReportLoading question={selectedMemberName ? `${selectedMemberName} Training` : selectedTrainingCategoryName ? `${selectedTrainingCategoryName} Training` : selectedQuestion?.name ?? "Report"} /> : null}
        {!isRunning && step === "filters" && selectedQuestion ? <FilterScreen question={selectedQuestion} dateRange={dateRange} onPresetChange={changePreset} onDateChange={(key, value) => setDateRange((current) => ({ ...current, preset: "custom", [key]: value }))} filterDefinitions={filterDefinitions} filters={filters} onFilterChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))} searchTerm={searchTerm} onSearchChange={setSearchTerm} showMoreFilters={showMoreFilters} onToggleMore={() => setShowMoreFilters((current) => !current)} onRun={() => void runMobileReport()} isRunning={isRunning} /> : null}
        {error ? <div className="rounded-2xl border border-red-400/25 bg-red-500/12 p-4 text-sm font-bold text-red-100">{error}</div> : null}
        {!isRunning && step === "results" && result ? <ReportOutput result={result} questionKey={selectedQuestionKey} expandedRows={expandedRows} setExpandedRows={setExpandedRows} onMemberSelect={selectedQuestionKey === "training-category" ? undefined : openTrainingMember} onCategorySelect={selectedQuestionKey === "training-category" ? openTrainingCategory : undefined} /> : null}
        {!isRunning && step === "member-results" && memberResult ? <ReportOutput result={memberResult} questionKey={selectedQuestionKey} memberName={selectedMemberName} expandedRows={expandedRows} setExpandedRows={setExpandedRows} /> : null}
        {!isRunning && step === "category-results" && categoryResult ? <ReportOutput result={categoryResult} questionKey={selectedQuestionKey} categoryName={selectedTrainingCategoryName} expandedRows={expandedRows} setExpandedRows={setExpandedRows} /> : null}
        {initialError && step === "home" ? <div className="rounded-2xl border border-red-400/25 bg-red-500/12 p-4 text-sm font-bold text-red-100">Some report filters could not be loaded. You can still run reports with the available options.</div> : null}
      </div>
    </main>
  );
}

function HomeScreen({ onChoose }: { onChoose: (category: Category) => void }) {
  return <><header className="rounded-[24px] border border-white/12 bg-[linear-gradient(145deg,rgba(35,35,35,0.98),rgba(10,10,10,0.98))] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.36)]"><p className="text-xs font-black uppercase tracking-[0.22em] text-[#ef2b2d]">Field Reference</p><h1 className="mt-2 text-3xl font-black uppercase tracking-tight">Reports</h1><p className="mt-2 text-sm leading-6 text-white/62">Answer department questions quickly.</p></header><section className="space-y-3"><div className="flex items-center justify-between px-1"><h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/80">Choose Area</h2><span className="text-xs font-bold text-white/45">{categoryDefinitions.length} areas</span></div><div className="grid gap-3 sm:grid-cols-2">{categoryDefinitions.map((category) => <CategoryCard key={category.key} category={category} onChoose={onChoose} />)}</div></section></>;
}

function CategoryCard({ category, onChoose }: { category: Category; onChoose: (category: Category) => void }) {
  const Icon = category.icon;
  return <button type="button" onClick={() => onChoose(category)} className="flex min-h-28 w-full items-start gap-3 rounded-2xl border border-white/10 bg-[#121212] p-4 text-left shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition hover:border-red-500/35 hover:bg-[#171717] active:scale-[0.99]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 text-[#ef2b2d]"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="text-base font-black text-white">{category.name}</span><ChevronRight className="h-4 w-4 shrink-0 text-white/35" /></span><span className="mt-1 block text-xs leading-4 text-white/40">{category.description}</span><span className="mt-1 block text-sm leading-5 text-white/65">{category.question}</span></span></button>;
}

function QuestionScreen({ category, onChoose }: { category: Category; onChoose: (question: Question) => void }) {
  return <><header className="border-b border-white/10 pb-5"><p className="text-xs font-black uppercase tracking-[0.22em] text-[#ef2b2d]">{category.name}</p><h1 className="mt-2 text-3xl font-black">Choose a Question</h1><p className="mt-2 text-sm leading-6 text-white/60">Start with the answer you need, then choose only the filters that matter.</p></header><section className="space-y-3">{category.questions.map((question) => <QuestionCard key={question.key} question={question} onChoose={onChoose} />)}</section></>;
}

function QuestionCard({ question, onChoose }: { question: Question; onChoose: (question: Question) => void }) {
  const Icon = question.icon;
  return <button type="button" disabled={question.future} onClick={() => onChoose(question)} className="flex min-h-20 w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#121212] p-4 text-left transition hover:border-red-500/35 hover:bg-[#171717] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#ef2b2d]"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="text-base font-black text-white">{question.name}</span>{question.future ? <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-200">Coming later</span> : null}</span><span className="mt-1 block text-sm leading-5 text-white/55">{question.question}</span></span>{question.future ? null : <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />}</button>;
}

function FilterScreen({ question, dateRange, onPresetChange, onDateChange, filterDefinitions, filters, onFilterChange, searchTerm, onSearchChange, showMoreFilters, onToggleMore, onRun, isRunning }: { question: Question; dateRange: { preset: ReportDatePresetKey; from: string; to: string }; onPresetChange: (preset: ReportDatePresetKey) => void; onDateChange: (key: "from" | "to", value: string) => void; filterDefinitions: ReportFilterDefinition[]; filters: Record<string, string>; onFilterChange: (key: string, value: string) => void; searchTerm: string; onSearchChange: (value: string) => void; showMoreFilters: boolean; onToggleMore: () => void; onRun: () => void; isRunning: boolean }) {
  const primaryFilters = filterDefinitions.slice(0, 2);
  const secondaryFilters = filterDefinitions.slice(2);
  return <><header className="border-b border-white/10 pb-5"><p className="text-xs font-black uppercase tracking-[0.22em] text-[#ef2b2d]">{question.name}</p><h1 className="mt-2 text-3xl font-black">Set Filters</h1><p className="mt-2 text-sm leading-6 text-white/60">{question.question}</p></header><section className="rounded-2xl border border-white/12 bg-[#111111] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.24)]"><label className="block text-sm font-black text-white/80">Date Range<select value={dateRange.preset} onChange={(event) => onPresetChange(event.target.value as ReportDatePresetKey)} className={mobileControlClassName}>{preferredDatePresets.map((key) => { const preset = REPORT_DATE_PRESETS.find((item) => item.key === key); return preset ? <option key={preset.key} value={preset.key}>{preset.label}</option> : null; })}</select></label>{dateRange.preset === "custom" ? <div className="mt-4 grid gap-4 sm:grid-cols-2"><DateInput label="From" value={dateRange.from} onChange={(value) => onDateChange("from", value)} /><DateInput label="To" value={dateRange.to} onChange={(value) => onDateChange("to", value)} /></div> : null}{primaryFilters.length > 0 ? <div className="mt-4 grid gap-4 sm:grid-cols-2">{primaryFilters.map((definition) => <FilterControl key={definition.key} definition={definition} value={filters[definition.key] ?? ""} onChange={(value) => onFilterChange(definition.key, value)} />)}</div> : null}{secondaryFilters.length > 0 || question.sourceKey === "activity" || question.sourceKey === "training" ? <button type="button" onClick={onToggleMore} className={`mt-4 w-full ${secondaryButtonClassName}`}>{showMoreFilters ? "Hide More Filters" : "More Filters"}</button> : null}{showMoreFilters ? <div className="mt-4 space-y-4">{secondaryFilters.map((definition) => <FilterControl key={definition.key} definition={definition} value={filters[definition.key] ?? ""} onChange={(value) => onFilterChange(definition.key, value)} />)}<label className="block text-sm font-black text-white/80">Search<div className="mt-2 flex min-h-14 items-center gap-2 rounded-2xl border border-white/15 bg-[#080808] px-4 focus-within:border-[#ef2b2d]"><Search className="h-4 w-4 text-white/35" /><input value={searchTerm} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search report records..." className="min-h-12 flex-1 bg-transparent text-base text-white outline-none" /></div></label></div> : null}<button type="button" onClick={onRun} disabled={isRunning} className="mt-5 min-h-14 w-full appearance-none rounded-2xl bg-[#ef2b2d] px-4 text-base font-black uppercase tracking-wide text-white [color-scheme:dark] disabled:bg-white/15 disabled:text-white/40">{isRunning ? "Generating..." : "Run Report"}</button></section></>;
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-black text-white/80">{label}<input type="date" value={value} onChange={(event) => onChange(event.target.value)} className={mobileControlClassName} /></label>;
}

function FilterControl({ definition, value, onChange }: { definition: ReportFilterDefinition; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-black text-white/80">{definition.label}{definition.type === "select" ? <select value={value} onChange={(event) => onChange(event.target.value)} className={mobileControlClassName}>{(definition.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={definition.placeholder ?? "Enter value"} className={mobileControlClassName} />}</label>;
}

function ReportLoading({ question }: { question: string }) {
  return <section className="rounded-[24px] border border-white/12 bg-[#111111] p-6 text-center shadow-[0_20px_44px_rgba(0,0,0,0.28)]"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-[#ef2b2d]" /><p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-[#ef2b2d]">{question}</p><h1 className="mt-2 text-2xl font-black">Building report</h1><p className="mt-2 text-sm leading-6 text-white/55">Reading the existing department report data.</p></section>;
}

function ReportOutput({ result, questionKey, memberName, categoryName, expandedRows, setExpandedRows, onMemberSelect, onCategorySelect }: { result: ReportResultPayload; questionKey?: string; memberName?: string | null; categoryName?: string | null; expandedRows: Set<number>; setExpandedRows: (value: Set<number>) => void; onMemberSelect?: (memberId: string, memberName: string) => void; onCategorySelect?: (categoryId: string | null, categoryName: string) => void }) {
  const primarySummary = questionKey === "training-records"
    ? result.summary?.find((item) => item.label === "Training Records") ?? result.summary?.[0] ?? null
    : result.summary?.[0] ?? null;
  const supportingSummaries = (result.summary?.slice(1) ?? []).filter((item) => !(result.source.key === "training" && item.label === "Top Member Totals"));
  const memberTotals = result.source.key === "training" && onMemberSelect
    ? (result.breakdowns?.members ?? []).map((member) => ({
      id: member.memberId,
      name: member.memberName,
      hours: `${member.totalHours.toFixed(2)} hrs · ${member.recordCount} record${member.recordCount === 1 ? "" : "s"}`,
    }))
    : [];
  const categoryTotals = result.source.key === "training" && onCategorySelect
    ? (result.breakdowns?.categories ?? []).map((category) => ({
      id: category.categoryId,
      name: category.categoryName,
      hours: `${category.totalHours.toFixed(2)} hrs · ${category.recordCount} record${category.recordCount === 1 ? "" : "s"}`,
    }))
    : [];
  const breakdownTotals = onCategorySelect ? categoryTotals : memberTotals;
  return <section className="space-y-4"><div className="rounded-[24px] border border-white/12 bg-[linear-gradient(145deg,rgba(35,35,35,0.98),rgba(10,10,10,0.98))] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.36)]"><p className="text-xs font-black uppercase tracking-[0.22em] text-[#ef2b2d]">{result.source.name}</p><h1 className="mt-2 text-3xl font-black uppercase tracking-tight">{categoryName ?? memberName ?? primarySummary?.label ?? "Report Results"}</h1>{categoryName ? <p className="mt-2 text-sm font-bold text-white/60">Training · {result.period.label}</p> : memberName ? <p className="mt-2 text-sm font-bold text-white/60">Training Hours · {result.period.label}</p> : <p className="mt-2 text-sm font-bold text-white/60">{result.period.label}</p>}{primarySummary ? <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-red-200">{categoryName ? "Category total" : memberName ? "Member total" : "Primary total"}</p><p className="mt-1 break-words text-4xl font-black leading-tight text-white">{primarySummary.value}</p></div> : <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-3xl font-black text-white">{result.totalRows} result{result.totalRows === 1 ? "" : "s"}</p></div>}<div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/70">{result.totalRows} record{result.totalRows === 1 ? "" : "s"}</span><span className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/70">{result.period.basisLabel}</span></div>{result.filtersApplied.length ? <p className="mt-3 text-xs font-bold leading-5 text-white/45">{result.filtersApplied.map((item) => `${item.label}: ${memberName && item.label === "Member" ? memberName : item.value}`).join(" · ")}</p> : null}</div>{breakdownTotals.length > 0 ? <section className="space-y-2"><div className="flex items-center justify-between px-1"><h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/45">{onCategorySelect ? "Training by Category" : "Training by Member"}</h2><span className="text-xs font-bold text-white/40">{breakdownTotals.length} {onCategorySelect ? "categories" : "members"}</span></div><div className="space-y-2">{breakdownTotals.map((member) => <button key={member.name} type="button" onClick={() => onCategorySelect ? onCategorySelect(member.id, member.name) : onMemberSelect?.(member.id ?? "", member.name)} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#121212] px-4 py-3 text-left transition hover:border-red-500/35 hover:bg-[#171717] active:scale-[0.99]"><span className="min-w-0"><span className="block truncate text-base font-black text-white">{member.name}</span><span className="mt-1 block text-xs font-bold uppercase tracking-wide text-white/40">Tap to view records</span></span><span className="shrink-0 text-base font-black text-white">{member.hours}</span></button>)}</div></section> : null}{supportingSummaries.length > 0 ? <section className="space-y-2"><h2 className="px-1 text-xs font-black uppercase tracking-[0.2em] text-white/45">Summary</h2><div className="grid gap-2 sm:grid-cols-2">{supportingSummaries.map((item) => <div key={`${item.label}:${item.value}`} className="rounded-2xl border border-white/10 bg-[#121212] p-4"><p className="text-xs font-black uppercase tracking-wide text-white/40">{item.label}</p><p className="mt-1 break-words text-base font-black leading-6 text-white">{item.value}</p></div>)}</div></section> : null}<section className="space-y-3"><div className="flex items-center justify-between px-1"><h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/45">Records</h2><span className="text-xs font-bold text-white/40">{result.rows.length} shown</span></div>{result.rows.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm font-bold leading-6 text-white/50">No records match the selected filters. Try a broader date range or remove a filter.</div> : result.rows.map((row, index) => <ResultCard key={index} result={result} row={row} index={index} expanded={expandedRows.has(index)} onToggle={() => { const next = new Set(expandedRows); if (next.has(index)) next.delete(index); else next.add(index); setExpandedRows(next); }} />)}</section></section>;
}

function ResultCard({ result, row, index, expanded, onToggle }: { result: ReportResultPayload; row: Record<string, string | number | null>; index: number; expanded: boolean; onToggle: () => void }) {
  const primary = pickFields(result.source.key, row);
  const shown = new Set(primary.map((item) => item.key));
  const secondary = result.columns.filter((column) => !shown.has(column.key)).map((column) => ({ label: column.label, value: text(row[column.key]) })).filter((item) => item.value !== "-");
  return <article className="rounded-2xl border border-white/12 bg-[#121212] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.22)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Record {index + 1}</p><h3 className="mt-1 break-words text-lg font-black leading-6 text-white">{primary[0]?.value ?? result.source.name}</h3></div>{secondary.length > 0 ? <button type="button" onClick={onToggle} className="min-h-11 shrink-0 rounded-xl border border-white/12 px-3 text-xs font-black uppercase text-white/65 transition hover:border-white/25 hover:bg-white/[0.04]" aria-expanded={expanded}>{expanded ? "Hide" : "Details"}</button> : null}</div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{primary.slice(1).map((item) => <p key={item.key} className="break-words text-white/65"><span className="text-white/35">{item.label}:</span> {item.value}</p>)}</div>{expanded ? <div className="mt-4 grid gap-2 border-t border-white/10 pt-3 text-sm sm:grid-cols-2">{secondary.map((item) => <p key={item.label} className="break-words text-white/58"><span className="text-white/35">{item.label}:</span> {item.value}</p>)}</div> : null}</article>;
}

function pickFields(sourceKey: string, row: Record<string, string | number | null>) {
  const fieldMap: Record<string, string[]> = {
    activity: ["description", "activity_date", "module", "action", "member_name", "related_item"],
    deficiencies: ["deficiency_number", "status_name", "priority_name", "category_name", "related_item", "reported_at", "description"],
    training: ["training_name", "training_date", "member_name", "category_name", "hours", "source_type"],
    personnel: ["member_name", "role_name", "status", "station", "shift", "email"],
    certifications: ["member_name", "certification_name", "status", "expires_at", "days_until_expiration"],
    apparatus: ["apparatus_name", "apparatus_status", "latest_check_status", "latest_check_at", "open_deficiencies", "latest_maintenance_date"],
    maintenance: ["maintenance_number", "apparatus_name", "maintenance_type", "service_date", "description", "performed_by"],
    inspections: ["item_name", "inspection_type", "result", "inspection_date", "item_status", "next_due_date"],
    inventory: ["item_name", "inventory_type", "identifier", "status", "due_date", "open_deficiencies"],
    ems: ["item_name", "category_name", "status", "location", "hours", "date"],
    "pre-plans": ["business_name", "address", "city", "last_verified_at", "hydrant_count", "hazard_count"],
  };
  const labels: Record<string, string> = { training_date: "Date", training_name: "Training", source_type: "Source", member_name: "Member", category_name: "Category", hours: "Hours", activity_date: "Date", module: "Module", action: "Action", description: "Description", related_item: "Related", deficiency_number: "Deficiency", status_name: "Status", priority_name: "Priority", reported_at: "Reported", apparatus_name: "Apparatus", apparatus_status: "Status", latest_check_status: "Latest Check", latest_check_at: "Latest Check", open_deficiencies: "Open Deficiencies", latest_maintenance_date: "Latest Maintenance", maintenance_number: "Record", maintenance_type: "Type", service_date: "Date", performed_by: "Performed By", item_name: "Item", inspection_type: "Inspection", result: "Result", inspection_date: "Date", item_status: "Status", next_due_date: "Next Due", inventory_type: "Type", identifier: "Identifier", due_date: "Due", status: "Status", location: "Location", date: "Date", business_name: "Business", address: "Address", city: "City", last_verified_at: "Last Verified", hydrant_count: "Hydrants", hazard_count: "Hazards", role_name: "Role", station: "Station", shift: "Shift", email: "Email", certification_name: "Certification", expires_at: "Expires", days_until_expiration: "Days Until Expiration" };
  const keys = fieldMap[sourceKey] ?? Object.keys(row).slice(0, 6);
  return keys
    .map((key) => ({ key, label: labels[key] ?? key, value: text(row[key]) }))
    .filter((item) => item.value !== "-")
    .filter((item) => !(sourceKey === "training" && item.key === "member_name" && isUuidLike(item.value)));
}
