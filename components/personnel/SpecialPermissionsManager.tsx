"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { AppPermissionOption } from "@/lib/app-permissions";
import SpecialPermissionsPanel from "@/components/personnel/SpecialPermissionsPanel";

const LEGACY_COMPATIBILITY_KEYS = new Set([
  "training_management",
  "homework_assignment",
  "training_review",
  "inventory_management",
  "deficiency_management",
]);

type SpecialPermissionsManagerProps = {
  memberName: string;
  permissionOptions: AppPermissionOption[];
  specialPermissionsEnabled: boolean;
  selectedPermissionKeys: string[];
  onSpecialPermissionsEnabledChange: (enabled: boolean) => void;
  onTogglePermission: (permissionKey: string) => void;
};

export default function SpecialPermissionsManager({
  memberName,
  permissionOptions,
  specialPermissionsEnabled,
  selectedPermissionKeys,
  onSpecialPermissionsEnabledChange,
  onTogglePermission,
}: SpecialPermissionsManagerProps) {
  const { department } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [draftEnabled, setDraftEnabled] = useState(specialPermissionsEnabled);
  const [draftKeys, setDraftKeys] = useState(selectedPermissionKeys);

  const applicablePermissionKeys = permissionOptions
    .filter((option) => !LEGACY_COMPATIBILITY_KEYS.has(option.key))
    .map((option) => option.key);
  const summary = !specialPermissionsEnabled || selectedPermissionKeys.length === 0
    ? "No special permissions"
    : applicablePermissionKeys.every((key) => selectedPermissionKeys.includes(key))
      ? "Full management access"
      : `${applicablePermissionKeys.filter((key) => selectedPermissionKeys.includes(key)).length} management permissions enabled`;

  function toggleDraftPermission(permissionKey: string) {
    setDraftKeys((current) => current.includes(permissionKey)
      ? current.filter((key) => key !== permissionKey)
      : [...current, permissionKey]);
  }

  function openManager() {
    setDraftEnabled(specialPermissionsEnabled);
    setDraftKeys(selectedPermissionKeys);
    setIsOpen(true);
  }

  function savePermissions() {
    if (!draftEnabled) {
      onSpecialPermissionsEnabledChange(false);
    } else {
      onSpecialPermissionsEnabledChange(true);
      const currentKeys = new Set(selectedPermissionKeys);
      const nextKeys = new Set(draftKeys);
      for (const key of new Set([...selectedPermissionKeys, ...draftKeys])) {
        if (currentKeys.has(key) !== nextKeys.has(key)) {
          onTogglePermission(key);
        }
      }
    }
    setIsOpen(false);
  }

  return (
    <>
      <section className="rounded-xl border border-neutral-700 bg-neutral-950 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-red-400" aria-hidden="true" />
            <div>
              <h3 className="text-base font-bold text-white">Special Permissions</h3>
              <p className="mt-1 text-sm text-neutral-400">Control what management functions this member can access.</p>
              <p className="mt-2 text-sm font-semibold text-zinc-200">{summary}</p>
            </div>
          </div>
          <button type="button" onClick={openManager} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700">
            Manage Special Permissions
          </button>
        </div>
      </section>

      {isOpen ? (
        <div className="fixed inset-0 z-[70] overflow-hidden bg-[#090909] text-white" role="dialog" aria-modal="true" aria-labelledby="special-permissions-title">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/branding/images/specialpermission.png')" }}
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#090909]/85" />
          <div className="relative z-10 mx-auto flex h-[100dvh] max-w-7xl flex-col px-4 py-5 lg:px-8 lg:py-7">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-400">Special Permissions</p>
                <h2 id="special-permissions-title" className="mt-2 text-3xl font-bold text-white">Management Access</h2>
                <p className="mt-2 text-lg font-semibold text-zinc-200">{memberName}</p>
                <p className="text-sm text-neutral-400">{department?.name?.trim() || "Department"}</p>
              </div>
              <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-zinc-100">
                <input type="checkbox" checked={draftEnabled} onChange={(event) => setDraftEnabled(event.target.checked)} className="h-4 w-4 accent-red-500" />
                Enable Special Permissions
              </label>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto py-6 pr-1">
              <p className="max-w-3xl text-sm leading-6 text-neutral-300">Choose which management functions this member can access. Members can still perform normal department activities without management permissions.</p>
              {draftEnabled ? (
                <div className="mt-6"><SpecialPermissionsPanel permissionOptions={permissionOptions} selectedPermissionKeys={draftKeys} onTogglePermission={toggleDraftPermission} /></div>
              ) : (
                <div className="mt-6 rounded-xl border border-dashed border-neutral-700 bg-neutral-900/60 p-8 text-center text-neutral-400">Enable Special Permissions to configure management access.</div>
              )}
            </div>

            <footer className="flex shrink-0 justify-end gap-3 border-t border-white/10 pt-5">
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg border border-neutral-700 px-5 py-2.5 text-sm font-semibold text-neutral-200 transition hover:bg-neutral-800">Cancel</button>
              <button type="button" onClick={savePermissions} className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700">Save Changes</button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}