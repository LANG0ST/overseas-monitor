alter table public.documents
  add column if not exists bon_driver text;

update public.documents
set bon_driver = coalesce(devis_fuel_driver, 'inclus')
where bon_driver is null;

alter table public.documents
  alter column bon_driver set default 'inclus',
  alter column bon_driver set not null;
