-- Overseas Services - Phase 2 authentication and row-level security.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, name)
select
  id,
  coalesce(raw_user_meta_data ->> 'name', split_part(email, '@', 1), '')
from auth.users
on conflict (id) do nothing;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists permissions_set_updated_at on public.permissions;
create trigger permissions_set_updated_at
  before update on public.permissions
  for each row execute procedure public.set_updated_at();

drop trigger if exists partenaires_set_updated_at on public.partenaires;
create trigger partenaires_set_updated_at
  before update on public.partenaires
  for each row execute procedure public.set_updated_at();

drop trigger if exists engins_set_updated_at on public.engins;
create trigger engins_set_updated_at
  before update on public.engins
  for each row execute procedure public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute procedure public.set_updated_at();

drop trigger if exists pointage_sheets_set_updated_at on public.pointage_sheets;
create trigger pointage_sheets_set_updated_at
  before update on public.pointage_sheets
  for each row execute procedure public.set_updated_at();

drop trigger if exists pointage_entries_set_updated_at on public.pointage_entries;
create trigger pointage_entries_set_updated_at
  before update on public.pointage_entries
  for each row execute procedure public.set_updated_at();

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
  before update on public.settings
  for each row execute procedure public.set_updated_at();

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function public.can_edit_resource(p_resource text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user()
    and (
      public.is_admin() or exists (
        select 1
        from public.permissions
        where user_id = auth.uid()
          and resource = p_resource
          and can_edit
      )
    );
$$;

create or replace function public.can_edit_document(p_type public.document_type)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_edit_resource(
    case p_type
      when 'facture' then 'factures'
      when 'devis' then 'devis'
      when 'bon_commande' then 'bons_commande'
      when 'avoir' then 'avoirs'
    end
  );
$$;

revoke all on function public.is_active_user() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.can_edit_resource(text) from public;
revoke all on function public.can_edit_document(public.document_type) from public;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_edit_resource(text) to authenticated;
grant execute on function public.can_edit_document(public.document_type) to authenticated;

alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.partenaires enable row level security;
alter table public.engins enable row level security;
alter table public.documents enable row level security;
alter table public.pointage_sheets enable row level security;
alter table public.pointage_entries enable row level security;
alter table public.settings enable row level security;

drop policy if exists "profiles are visible to their owner and admins" on public.profiles;
create policy "profiles are visible to their owner and admins"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles"
  on public.profiles for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "permissions are visible to their owner and admins" on public.permissions;
create policy "permissions are visible to their owner and admins"
  on public.permissions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admins manage permissions" on public.permissions;
create policy "admins manage permissions"
  on public.permissions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "active users read partenaires" on public.partenaires;
create policy "active users read partenaires"
  on public.partenaires for select to authenticated
  using (public.is_active_user());

drop policy if exists "permitted users write partenaires" on public.partenaires;
create policy "permitted users write partenaires"
  on public.partenaires for all to authenticated
  using (public.is_active_user() and public.can_edit_resource('partenaires'))
  with check (public.is_active_user() and public.can_edit_resource('partenaires'));

drop policy if exists "active users read engins" on public.engins;
create policy "active users read engins"
  on public.engins for select to authenticated
  using (public.is_active_user());

drop policy if exists "permitted users write engins" on public.engins;
create policy "permitted users write engins"
  on public.engins for all to authenticated
  using (public.is_active_user() and public.can_edit_resource('engins'))
  with check (public.is_active_user() and public.can_edit_resource('engins'));

drop policy if exists "active users read documents" on public.documents;
create policy "active users read documents"
  on public.documents for select to authenticated
  using (public.is_active_user());

drop policy if exists "permitted users write documents" on public.documents;
create policy "permitted users write documents"
  on public.documents for all to authenticated
  using (public.is_active_user() and public.can_edit_document(type))
  with check (public.is_active_user() and public.can_edit_document(type));

drop policy if exists "active users read pointage sheets" on public.pointage_sheets;
create policy "active users read pointage sheets"
  on public.pointage_sheets for select to authenticated
  using (public.is_active_user());

drop policy if exists "permitted users write pointage sheets" on public.pointage_sheets;
create policy "permitted users write pointage sheets"
  on public.pointage_sheets for all to authenticated
  using (public.is_active_user() and public.can_edit_resource('pointage'))
  with check (public.is_active_user() and public.can_edit_resource('pointage'));

drop policy if exists "active users read pointage entries" on public.pointage_entries;
create policy "active users read pointage entries"
  on public.pointage_entries for select to authenticated
  using (public.is_active_user());

drop policy if exists "permitted users write pointage entries" on public.pointage_entries;
create policy "permitted users write pointage entries"
  on public.pointage_entries for all to authenticated
  using (public.is_active_user() and public.can_edit_resource('pointage'))
  with check (public.is_active_user() and public.can_edit_resource('pointage'));

drop policy if exists "active users read settings" on public.settings;
create policy "active users read settings"
  on public.settings for select to authenticated
  using (public.is_active_user());

drop policy if exists "admins write settings" on public.settings;
create policy "admins write settings"
  on public.settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "active users read permitted storage objects" on storage.objects;
create policy "active users read permitted storage objects"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('partenaire-logos', 'engin-photos')
    and public.is_active_user()
  );

drop policy if exists "permitted users write storage objects" on storage.objects;
create policy "permitted users write storage objects"
  on storage.objects for all to authenticated
  using (
    public.is_active_user()
    and (
      (bucket_id = 'partenaire-logos' and public.can_edit_resource('partenaires'))
      or (bucket_id = 'engin-photos' and public.can_edit_resource('engins'))
    )
  )
  with check (
    public.is_active_user()
    and (
      (bucket_id = 'partenaire-logos' and public.can_edit_resource('partenaires'))
      or (bucket_id = 'engin-photos' and public.can_edit_resource('engins'))
    )
  );
