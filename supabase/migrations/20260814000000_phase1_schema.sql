-- Overseas Services - Phase 1 schema
-- Run this migration against a fresh Supabase project.

create extension if not exists pgcrypto;

do $$
begin
  create type public.document_type as enum ('devis', 'bon_commande', 'facture', 'avoir');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.profile_role as enum ('admin', 'staff');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  role public.profile_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  resource text not null check (resource in (
    'factures', 'devis', 'bons_commande', 'avoirs', 'pointage', 'partenaires', 'engins'
  )),
  can_edit boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, resource)
);

create table if not exists public.partenaires (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ice text,
  rc_city text,
  rc_number text,
  address text,
  representative text,
  phone text,
  bank_name text,
  bank_account text,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.engins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null check (unit in ('Jour', 'Mois', 'Heure', 'Fois')),
  default_price numeric(12, 2) not null default 0,
  note text,
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  type public.document_type not null,
  number text,
  date date not null default current_date,
  partenaire_id uuid references public.partenaires (id) on delete set null,
  client_name text not null default '',
  client_ice text,
  client_address text,
  city text,
  line_items jsonb not null default '[]'::jsonb,
  tva_rate numeric(5, 2) not null default 20,
  ht numeric(14, 2) not null default 0,
  tva numeric(14, 2) not null default 0,
  ttc numeric(14, 2) not null default 0,
  paid boolean not null default false,
  paid_date date,
  is_active boolean not null default true,
  is_locked boolean not null default false,
  validity_days integer,
  chantier text,
  period_start date,
  period_end date,
  motif text,
  reference_facture_number text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (type, number)
);

create index if not exists documents_partenaire_id_idx on public.documents (partenaire_id);
create index if not exists documents_type_date_idx on public.documents (type, date desc);

create table if not exists public.pointage_sheets (
  id uuid primary key default gen_random_uuid(),
  partenaire_id uuid not null references public.partenaires (id) on delete restrict,
  ym text not null check (ym ~ '^\\d{4}-(0[1-9]|1[0-2])$'),
  project text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (partenaire_id, ym)
);

create table if not exists public.pointage_entries (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.pointage_sheets (id) on delete cascade,
  engin_id uuid not null references public.engins (id) on delete restrict,
  unit_price numeric(12, 2) not null default 0,
  days jsonb not null default '{}'::jsonb,
  overtime_hours jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (sheet_id, engin_id)
);

create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  ot_reference_hours numeric(6, 2) not null default 9,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.settings (id, ot_reference_hours)
values (1, 9)
on conflict (id) do nothing;

-- Numbering uses one real PostgreSQL sequence per document type and year.
-- The advisory lock makes lazy sequence creation safe when two requests arrive together.
create or replace function public.next_document_number(p_type public.document_type, p_year integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sequence_name text := format('document_numbers_%s_%s_seq', p_type::text, p_year);
  sequence_value bigint;
  year_suffix text := right(p_year::text, 2);
begin
  if p_year < 2000 or p_year > 9999 then
    raise exception 'Invalid document year: %', p_year using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(sequence_name));
  execute format('create sequence if not exists %I minvalue 1 start with 1', sequence_name);
  execute format('select nextval(%L)', 'public.' || sequence_name) into sequence_value;

  return case p_type
    when 'facture' then lpad(sequence_value::text, 3, '0') || '/' || p_year || '/AI'
    when 'devis' then 'D-' || lpad(sequence_value::text, 4, '0') || '/' || year_suffix
    when 'bon_commande' then 'BC-' || lpad(sequence_value::text, 4, '0') || '/' || year_suffix
    when 'avoir' then 'AV-' || lpad(sequence_value::text, 4, '0') || '/' || year_suffix
  end;
end;
$$;

revoke all on function public.next_document_number(public.document_type, integer) from public;
grant execute on function public.next_document_number(public.document_type, integer) to authenticated;

-- Storage buckets for the only binary assets in scope for this phase.
insert into storage.buckets (id, name, public)
values
  ('partenaire-logos', 'partenaire-logos', false),
  ('engin-photos', 'engin-photos', false)
on conflict (id) do update set public = excluded.public;
