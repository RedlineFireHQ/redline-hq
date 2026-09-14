-- The internal context helper is only called by SECURITY DEFINER functions.
revoke all on function public.requesting_active_document_member(uuid) from public;
revoke all on function public.requesting_active_document_member(uuid) from anon;
revoke all on function public.requesting_active_document_member(uuid) from authenticated;