revoke execute on function public.resolve_requesting_member_access_context() from public;
revoke execute on function public.resolve_requesting_member_access_context() from anon;
grant execute on function public.resolve_requesting_member_access_context() to authenticated;

revoke execute on function public.member_has_app_permission(uuid, text) from public;
revoke execute on function public.member_has_app_permission(uuid, text) from anon;
grant execute on function public.member_has_app_permission(uuid, text) to authenticated;

revoke execute on function public.can_manage_personnel(uuid) from public;
revoke execute on function public.can_manage_personnel(uuid) from anon;
grant execute on function public.can_manage_personnel(uuid) to authenticated;

revoke execute on function public.create_department_member(text, text, text, text, text, boolean, boolean, text[]) from public;
revoke execute on function public.create_department_member(text, text, text, text, text, boolean, boolean, text[]) from anon;
grant execute on function public.create_department_member(text, text, text, text, text, boolean, boolean, text[]) to authenticated;

revoke execute on function public.update_department_member(uuid, text, text, text, text, text, boolean, boolean, text[]) from public;
revoke execute on function public.update_department_member(uuid, text, text, text, text, text, boolean, boolean, text[]) from anon;
grant execute on function public.update_department_member(uuid, text, text, text, text, text, boolean, boolean, text[]) to authenticated;

revoke execute on function public.update_department_member_role(uuid, uuid) from public;
revoke execute on function public.update_department_member_role(uuid, uuid) from anon;
grant execute on function public.update_department_member_role(uuid, uuid) to authenticated;
