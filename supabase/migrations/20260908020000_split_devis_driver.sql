alter table public.documents
  add column if not exists devis_driver text;

update public.documents
set devis_driver = coalesce(devis_fuel_driver, 'inclus')
where devis_driver is null;

alter table public.documents
  alter column devis_driver set default 'inclus',
  alter column devis_driver set not null;
