-- Add a Pager deficiency category so pager-linked deficiencies are categorized
-- as Pager rather than the generic Inventory category.
-- Idempotent: uses a not-exists guard instead of ON CONFLICT so it is safe
-- whether or not deficiency_categories.name has a unique constraint.

insert into public.deficiency_categories (name, description, display_order, active)
select 'Pagers', 'Pager and alerting device deficiencies', 12, true
where not exists (
  select 1 from public.deficiency_categories where lower(name) = 'pagers'
);
