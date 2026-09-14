-- Operational state is now reconciled by history-insert triggers. Direct
-- inventory-item writes must remain subject to category management permissions.

drop policy if exists scba_packs_insert_by_department on public.scba_packs;
drop policy if exists scba_packs_update_by_department on public.scba_packs;
drop policy if exists scba_packs_delete_by_department on public.scba_packs;

drop policy if exists gas_monitors_insert_by_department on public.gas_monitors;
drop policy if exists gas_monitors_update_by_department on public.gas_monitors;
drop policy if exists gas_monitors_delete_by_department on public.gas_monitors;