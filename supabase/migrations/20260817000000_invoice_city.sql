alter table public.documents
  add column if not exists city text not null default 'Casablanca';

alter table public.documents
  add column if not exists has_cachet boolean not null default false;
