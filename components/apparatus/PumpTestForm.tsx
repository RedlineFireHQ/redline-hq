"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ApparatusOption = {
  id: string;
  name: string;
  type: string | null;
};

type MemberOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

interface PumpTestFormProps {
  departmentId: string | null;
  apparatusOptions: ApparatusOption[];
}

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function PumpTestForm({ departmentId, apparatusOptions }: PumpTestFormProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedApparatusId, setSelectedApparatusId] = useState("");
  const [testDate, setTestDate] = useState(getTodayDate());
  const [testerType, setTesterType] = useState<"department_member" | "external_tester" | "">("");
  const [memberId, setMemberId] = useState("");
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  const [externalTesterName, setExternalTesterName] = useState("");
  const [externalTesterCompany, setExternalTesterCompany] = useState("");
  const [result, setResult] = useState<"Pass" | "Fail" | "">("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastSavedResult, setLastSavedResult] = useState<"Pass" | "Fail" | null>(null);
  const [lastSavedApparatusId, setLastSavedApparatusId] = useState<string | null>(null);

  useEffect(() => {
    if (!departmentId) {
      return;
    }

    let isMounted = true;

    void (async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, first_name, last_name")
        .eq("department_id", departmentId)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error("[pump-test] member load failed", error);
        setMemberOptions([]);
        return;
      }

      setMemberOptions((data ?? []) as MemberOption[]);
    })();

    return () => {
      isMounted = false;
    };
  }, [departmentId]);

  const filteredApparatus = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return apparatusOptions;
    }

    return apparatusOptions.filter((apparatus) => {
      const searchable = [apparatus.name, apparatus.type ?? ""].join(" ").toLowerCase();
      return searchable.includes(normalizedSearch);
    });
  }, [apparatusOptions, searchTerm]);

  const selectedApparatus = apparatusOptions.find((apparatus) => apparatus.id === selectedApparatusId) ?? null;

  const handleSave = async () => {
    if (!departmentId) {
      setErrorMessage("Unable to determine department context.");
      return;
    }

    if (!selectedApparatusId) {
      setErrorMessage("Select an apparatus unit before saving.");
      return;
    }

    if (!testDate) {
      setErrorMessage("Select a test date.");
      return;
    }

    if (!testerType) {
      setErrorMessage("Select who performed the pump test.");
      return;
    }

    if (testerType === "department_member" && !memberId) {
      setErrorMessage("Select the department member who completed the test.");
      return;
    }

    if (testerType === "external_tester" && !externalTesterName.trim()) {
      setErrorMessage("External tester name is required.");
      return;
    }

    if (!result) {
      setErrorMessage("Select Pass or Fail.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { error } = await supabase.from("apparatus_pump_tests").insert({
      department_id: departmentId,
      apparatus_id: selectedApparatusId,
      test_date: testDate,
      tester_type: testerType,
      tester_member_id: testerType === "department_member" ? memberId : null,
      external_tester_name: testerType === "external_tester" ? externalTesterName.trim() || null : null,
      external_tester_company: testerType === "external_tester" ? externalTesterCompany.trim() || null : null,
      result,
      notes: notes.trim() || null,
    });

    setIsSaving(false);

    if (error) {
      setErrorMessage(error.message || "Unable to save pump test.");
      return;
    }

    setSuccessMessage("Pump test saved successfully.");
    setLastSavedResult(result);
    setLastSavedApparatusId(selectedApparatusId);
    setTestDate(getTodayDate());
    setTesterType("");
    setMemberId("");
    setExternalTesterName("");
    setExternalTesterCompany("");
    setResult("");
    setNotes("");

    if (result === "Pass") {
      window.setTimeout(() => {
        router.push("/apparatus");
      }, 1200);
    }
  };

  return (
    <div className="space-y-6">
      {!selectedApparatus ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-red-500">Pump Test</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Select Apparatus</h2>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-4">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search apparatus"
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {filteredApparatus.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-[#1b1b1b] p-6 text-sm text-neutral-400 md:col-span-2">
                No apparatus matches the current search.
              </div>
            ) : (
              filteredApparatus.map((apparatus) => (
                <button
                  key={apparatus.id}
                  type="button"
                  onClick={() => setSelectedApparatusId(apparatus.id)}
                  className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-4 text-left transition hover:border-red-500/40 hover:bg-[#202020]"
                >
                  <div className="text-lg font-bold text-white">{apparatus.name}</div>
                  <div className="mt-1 text-sm text-neutral-400">{apparatus.type ?? "Unknown Type"}</div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-red-500">Pump Test</p>
              <h2 className="mt-2 text-2xl font-bold text-white">{selectedApparatus.name}</h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedApparatusId("")}
              className="rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#202020]"
            >
              Change Apparatus
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Apparatus</span>
              <input
                value={selectedApparatus.name}
                readOnly
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-neutral-300"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Test Date *</span>
              <input
                type="date"
                value={testDate}
                onChange={(event) => setTestDate(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Tested By *</span>
              <select
                value={testerType}
                onChange={(event) => {
                  const nextValue = event.target.value as "department_member" | "external_tester" | "";
                  setTesterType(nextValue);
                  if (nextValue !== "department_member") {
                    setMemberId("");
                  }
                }}
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              >
                <option value="">Select tester type</option>
                <option value="department_member">Department Member</option>
                <option value="external_tester">External Tester</option>
              </select>
            </label>

            {testerType === "department_member" ? (
              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Department Member *</span>
                <select
                  value={memberId}
                  onChange={(event) => setMemberId(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                >
                  <option value="">Select member</option>
                  {memberOptions.map((member) => {
                    const label = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.id;
                    return (
                      <option key={member.id} value={member.id}>{label}</option>
                    );
                  })}
                </select>
              </label>
            ) : null}

            {testerType === "external_tester" ? (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Tester Name *</span>
                  <input
                    value={externalTesterName}
                    onChange={(event) => setExternalTesterName(event.target.value)}
                    placeholder="External tester name"
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Company</span>
                  <input
                    value={externalTesterCompany}
                    onChange={(event) => setExternalTesterCompany(event.target.value)}
                    placeholder="Company or organization"
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  />
                </label>
              </>
            ) : null}

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Result *</span>
              <select
                value={result}
                onChange={(event) => setResult(event.target.value === "Fail" ? "Fail" : event.target.value === "Pass" ? "Pass" : "")}
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              >
                <option value="">Select result</option>
                <option value="Pass">Pass</option>
                <option value="Fail">Fail</option>
              </select>
            </label>

            <div className="md:col-span-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Notes</span>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional pump test notes"
                  className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                />
              </label>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-100">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mt-4 space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-100">
              <div>{successMessage}</div>
              {lastSavedResult === "Fail" && lastSavedApparatusId ? (
                <button
                  type="button"
                  onClick={() => router.push(`/deficiencies/report?apparatusId=${lastSavedApparatusId}`)}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                >
                  Report Deficiency
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="rounded-lg border border-emerald-500/40 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "Saving..." : "Save Pump Test"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
