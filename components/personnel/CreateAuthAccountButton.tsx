"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CreateAuthAccountButtonProps = {
  memberId: string;
  memberEmail: string;
  hasAuthAccount: boolean;
};

type ResultState = {
  kind: "success" | "error";
  message: string;
} | null;

export default function CreateAuthAccountButton({
  memberId,
  memberEmail,
  hasAuthAccount,
}: CreateAuthAccountButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [result, setResult] = useState<ResultState>(null);

  if (hasAuthAccount) {
    return (
      <div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        Authentication account: linked
      </div>
    );
  }

  if (!memberEmail) {
    return (
      <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Authentication account: not linked. Add a valid email to this member before creating an account.
      </div>
    );
  }

  async function handleCreateAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch(`/api/personnel/members/${memberId}/auth-account`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ temporaryPassword }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        authUserId?: string;
      };

      if (!response.ok || !payload.ok) {
        const extra = payload.authUserId ? ` (Auth UUID: ${payload.authUserId})` : "";
        setResult({
          kind: "error",
          message: `${payload.error || "Unable to create account."}${extra}`,
        });
        return;
      }

      setTemporaryPassword("");
      setResult({
        kind: "success",
        message: "Authentication account created and linked.",
      });
      router.refresh();
    } catch (error) {
      setResult({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to create account.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Authentication account: not linked</p>
          <p className="text-xs text-neutral-400">Create an account for this member using a temporary password.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsOpen((current) => !current);
            setResult(null);
          }}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Create Account
        </button>
      </div>

      {isOpen ? (
        <form className="mt-4 space-y-3" onSubmit={handleCreateAccount}>
          <label className="block text-sm text-neutral-200">
            Temporary password
            <input
              type="password"
              value={temporaryPassword}
              onChange={(event) => setTemporaryPassword(event.target.value)}
              minLength={8}
              required
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {isSubmitting ? "Creating..." : "Create Account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setTemporaryPassword("");
                setResult(null);
              }}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {result ? (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            result.kind === "success"
              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : "border border-red-500/30 bg-red-500/10 text-red-100"
          }`}
        >
          {result.message}
        </div>
      ) : null}
    </div>
  );
}