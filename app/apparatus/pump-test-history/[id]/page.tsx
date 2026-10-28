import Link from "next/link";
import { notFound } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import PumpTestAddAttachments from "@/components/apparatus/PumpTestAddAttachments";
import { getActiveDepartmentMember } from "@/lib/pump-tests/access";
import { isUuid } from "@/lib/pump-tests/attachments";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type PumpTestRow = {
  id: string;
  test_date: string | null;
  result: string | null;
  notes: string | null;
  tester_type: string | null;
  tester_member_id: string | null;
  external_tester_name: string | null;
  external_tester_company: string | null;
  apparatus: { name: string | null } | { name: string | null }[] | null;
};

type AttachmentRow = {
  id: string;
  original_filename: string;
  content_type: string;
  file_size_bytes: number;
  kind: string;
  created_at: string;
};

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function PumpTestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const currentMember = await getActiveDepartmentMember(supabase);

  if (!isUuid(id) || !currentMember) {
    notFound();
  }

  const { data } = await supabase
    .from("apparatus_pump_tests")
    .select("id, test_date, result, notes, tester_type, tester_member_id, external_tester_name, external_tester_company, apparatus:apparatus_id(name)")
    .eq("id", id)
    .eq("department_id", currentMember.departmentId)
    .maybeSingle();

  const test = data as PumpTestRow | null;
  if (!test) {
    notFound();
  }

  let testerName = "Department Member";
  if (test.tester_type === "external_tester") {
    testerName = [test.external_tester_name, test.external_tester_company].filter(Boolean).join(" / ") || "External Tester";
  } else if (test.tester_member_id) {
    const { data: member } = await supabase
      .from("members")
      .select("first_name, last_name")
      .eq("id", test.tester_member_id)
      .eq("department_id", currentMember.departmentId)
      .maybeSingle();
    const label = `${member?.first_name ?? ""} ${member?.last_name ?? ""}`.trim();
    testerName = label || testerName;
  }

  const { data: attachmentData, error: attachmentError } = await supabase
    .from("apparatus_pump_test_attachments")
    .select("id, original_filename, content_type, file_size_bytes, kind, created_at")
    .eq("pump_test_id", id)
    .eq("department_id", currentMember.departmentId)
    .order("created_at", { ascending: true });
  const attachments = (attachmentData ?? []) as AttachmentRow[];

  const apparatus = Array.isArray(test.apparatus) ? test.apparatus[0] : test.apparatus;
  const baseUrl = `/api/apparatus/pump-tests/${test.id}/attachments`;

  return (
    <PageLayout environmentBackgroundUrl="/branding/images/apparatuspageimage.png" environmentBackgroundPosition="left center">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Pump Test</p>
            <h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">{apparatus?.name ?? "Unknown Apparatus"}</h1>
          </div>
          <Link
            href="/apparatus/pump-test-history"
            className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
          >
            Back to Pump Test History
          </Link>
        </div>

        <div className="grid gap-4 rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-400">Test Date</p>
            <p className="mt-1 text-white">{test.test_date ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-400">Result</p>
            <p className={`mt-1 font-semibold ${test.result === "Pass" ? "text-green-300" : "text-red-300"}`}>{test.result ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-400">Tested By</p>
            <p className="mt-1 text-white">{testerName}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-400">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-white">{test.notes || "-"}</p>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
          <h2 className="text-lg font-bold text-white">Photos &amp; Documents</h2>

          {attachmentError ? (
            <p className="text-sm text-amber-300">Attachments are not available yet.</p>
          ) : attachments.length === 0 ? (
            <p className="text-sm text-neutral-400">No attachments for this pump test.</p>
          ) : (
            <ul className="space-y-2">
              {attachments.map((attachment) => (
                <li key={attachment.id} className="flex flex-col gap-2 rounded-lg border border-white/10 bg-[#1b1b1b] p-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{attachment.original_filename}</p>
                    <p className="text-xs text-neutral-400">
                      {attachment.kind === "photo" ? "Photo" : "Document"} · {formatSize(attachment.file_size_bytes)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`${baseUrl}/${attachment.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                    >
                      View
                    </a>
                    <a
                      href={`${baseUrl}/${attachment.id}?download=1`}
                      className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                    >
                      Download
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!attachmentError ? <PumpTestAddAttachments pumpTestId={test.id} /> : null}
        </div>
      </div>
    </PageLayout>
  );
}
