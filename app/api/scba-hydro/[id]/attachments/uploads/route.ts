import { hydroActor, hydroJson } from "@/lib/scba-hydro/access";
import { isUuid, validateDeclaredFiles } from "@/lib/pump-tests/attachments";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) return hydroJson({ error: "Invalid session." }, 400);
  const actor = await hydroActor(id);
  if (!actor) return hydroJson({ error: "Not authorized or session not found." }, 403);
  const body: unknown = await request.json().catch(() => null);
  const validation = validateDeclaredFiles([body]);
  if (!validation.ok) return hydroJson({ error: validation.error }, 400);
  const file = validation.files[0];
  const path = `${actor.departmentId}/sessions/${id}/${crypto.randomUUID()}.${file.extension}`;
  const { data, error } = await actor.admin.storage.from("scba-hydro-attachments").createSignedUploadUrl(path);
  if (error || !data?.token) return hydroJson({ error: error?.message || "Unable to prepare upload." }, 500);
  return hydroJson({ path, token: data.token });
}
