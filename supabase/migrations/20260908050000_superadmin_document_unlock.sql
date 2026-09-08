alter table public.documents
  add column if not exists manual_number_only boolean not null default false,
  add column if not exists unlocked_by uuid references public.profiles (id),
  add column if not exists unlocked_at timestamptz;

-- Preserve every existing administrator's access while introducing the higher role.
update public.profiles
set role = 'superadmin'
where role = 'admin';

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
    where id = auth.uid()
      and role in ('admin', 'superadmin')
      and is_active
  );
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'superadmin'
      and is_active
  );
$$;

create or replace function public.unlock_facture(p_document_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_superadmin() is not true then
    raise exception 'Cette action est réservée au super-administrateur.' using errcode = '42501';
  end if;

  update public.documents
  set
    is_locked = false,
    number = null,
    manual_number_only = true,
    unlocked_by = auth.uid(),
    unlocked_at = timezone('utc', now())
  where id = p_document_id
    and type = 'facture'
    and is_active
    and is_locked;

  if not found then
    raise exception 'Facture verrouillée introuvable.' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

revoke all on function public.is_superadmin() from public;
revoke all on function public.unlock_facture(uuid) from public;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.unlock_facture(uuid) to authenticated;
