-- Unlock any numbered document for super-admin error correction while preserving its number.
create unique index if not exists documents_type_number_ci_key
  on public.documents (type, lower(number))
  where number is not null;

create or replace function public.unlock_facture(p_document_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Super-administrator access required' using errcode = '42501';
  end if;

  update public.documents
  set
    is_locked = false,
    manual_number_only = true,
    unlocked_by = auth.uid(),
    unlocked_at = now()
  where id = p_document_id
    and is_active = true
    and number is not null;

  if not found then
    raise exception 'Active numbered document not found' using errcode = 'P0002';
  end if;

  return true;
end;
$$;
