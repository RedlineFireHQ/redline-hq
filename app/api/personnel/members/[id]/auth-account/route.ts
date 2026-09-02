import { getCurrentMember } from "@/lib/current-member";
import { canManagePersonnel } from "@/lib/member-permissions";
import {
  createAuthAccountForExistingMember,
  type MemberAuthLinkCandidate,
} from "@/lib/personnel/create-auth-account";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type CreateAuthAccountPayload = {
  temporaryPassword?: unknown;
};

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as CreateAuthAccountPayload;
    const temporaryPassword = typeof payload.temporaryPassword === "string" ? payload.temporaryPassword : "";

    if (!id) {
      return jsonResponse({ ok: false, error: "Member id is required." }, 400);
    }

    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);
    const hasAccess = currentMember?.departmentId
      ? await canManagePersonnel(supabase, currentMember.departmentId, currentMember.role)
      : false;

    let member: MemberAuthLinkCandidate | null = null;
    if (currentMember?.departmentId) {
      const { data } = await supabase
        .from("members")
        .select("id, department_id, email, auth_user_id")
        .eq("id", id)
        .eq("department_id", currentMember.departmentId)
        .maybeSingle();

      member = (data as MemberAuthLinkCandidate | null) ?? null;
    }

    const admin = createSupabaseAdminClient();
    const result = await createAuthAccountForExistingMember(
      {
        requester: currentMember
          ? {
              departmentId: currentMember.departmentId,
            }
          : null,
        hasManagePersonnelAccess: hasAccess,
        memberId: id,
        temporaryPassword,
        member,
      },
      {
        createAuthUser: async ({ email, password }) => {
          const { data, error } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });

          return {
            userId: data.user?.id ?? null,
            errorMessage: error?.message ?? null,
          };
        },
        linkMemberAuthUser: async ({ memberId, departmentId, authUserId }) => {
          const { data, error } = await supabase
            .from("members")
            .update({ auth_user_id: authUserId })
            .eq("id", memberId)
            .eq("department_id", departmentId)
            .is("auth_user_id", null)
            .select("id")
            .maybeSingle();

          if (error) {
            return {
              linked: false,
              errorMessage: error.message || "Unable to link member to the new auth account.",
            };
          }

          return {
            linked: Boolean(data),
            errorMessage: data ? null : "Unable to link member to the new auth account.",
          };
        },
        deleteAuthUser: async ({ authUserId }) => {
          const { error } = await admin.auth.admin.deleteUser(authUserId);

          return {
            deleted: !error,
            errorMessage: error?.message ?? null,
          };
        },
      },
    );

    return jsonResponse(result.body, result.status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create authentication account.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}