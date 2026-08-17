alter table public.documents
  add column if not exists city text not null default 'Casablanca';
