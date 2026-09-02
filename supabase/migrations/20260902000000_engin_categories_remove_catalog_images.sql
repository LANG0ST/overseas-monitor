-- Production catalogue: machine categories replace image-based cards.

alter table public.engins
  add column if not exists category text not null default 'Misc';

alter table public.engins
  drop constraint if exists engins_category_check;

alter table public.engins
  add constraint engins_category_check check (category in (
    'Manutention & Levage',
    'Grues',
    'Terrassement & Excavation',
    'Camions & Transport',
    'Misc'
  ));

create index if not exists engins_category_name_idx
  on public.engins (category, name);

alter table public.partenaires
  drop column if exists logo_url;

alter table public.engins
  drop column if exists photo_url;

drop policy if exists "active users read permitted storage objects" on storage.objects;
drop policy if exists "permitted users write storage objects" on storage.objects;

-- Storage objects are deliberately left orphaned. Supabase prevents direct writes
-- to storage.objects; the application no longer stores or exposes these images.
