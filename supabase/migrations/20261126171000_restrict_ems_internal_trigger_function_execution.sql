-- Trigger-only functions should not be callable through the public Data API.
revoke all on function public.consume_ems_supply_batches_on_checkout() from public, anon, authenticated;
revoke all on function public.validate_ems_supply_batch_department() from public, anon, authenticated;
revoke all on function public.validate_ems_supply_container_content() from public, anon, authenticated;
