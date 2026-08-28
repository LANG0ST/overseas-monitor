-- V2: durable Pointage -> Facture relationship and a closed billed state.

alter table public.documents
  add column if not exists source_pointage_sheet_id uuid
  references public.pointage_sheets (id) on delete restrict;

alter table public.pointage_sheets
  add column if not exists facture_id uuid
  references public.documents (id) on delete restrict;

create unique index if not exists documents_active_pointage_facture_key
  on public.documents (source_pointage_sheet_id)
  where type = 'facture' and is_active and source_pointage_sheet_id is not null;

create unique index if not exists pointage_sheets_facture_id_key
  on public.pointage_sheets (facture_id)
  where facture_id is not null;

create or replace function public.sync_pointage_facture_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and old.source_pointage_sheet_id is not null
    and (not new.is_active or new.source_pointage_sheet_id is distinct from old.source_pointage_sheet_id) then
    update public.pointage_sheets
    set facture_id = null
    where id = old.source_pointage_sheet_id and facture_id = old.id;
  end if;

  if new.type = 'facture' and new.is_active and new.source_pointage_sheet_id is not null then
    update public.pointage_sheets
    set facture_id = new.id
    where id = new.source_pointage_sheet_id
      and (facture_id is null or facture_id = new.id);
    if not found then
      raise exception 'Ce pointage possède déjà une facture active.' using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists documents_sync_pointage_facture on public.documents;
create trigger documents_sync_pointage_facture
  after insert or update of is_active, source_pointage_sheet_id on public.documents
  for each row execute procedure public.sync_pointage_facture_link();

create or replace function public.prevent_billed_pointage_changes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  linked_facture uuid;
  target_sheet uuid;
begin
  if tg_table_name = 'pointage_sheets' then
    if old.facture_id is not null and new.facture_id is not distinct from old.facture_id then
      raise exception 'Ce pointage est fermé car sa facture a été créée.' using errcode = '55000';
    end if;
    return new;
  end if;

  target_sheet := case when tg_op = 'DELETE' then old.sheet_id else new.sheet_id end;
  select facture_id into linked_facture
  from public.pointage_sheets
  where id = target_sheet;
  if linked_facture is not null then
    raise exception 'Ce pointage est fermé car sa facture a été créée.' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists pointage_sheets_prevent_billed_changes on public.pointage_sheets;
create trigger pointage_sheets_prevent_billed_changes
  before update on public.pointage_sheets
  for each row execute procedure public.prevent_billed_pointage_changes();

drop trigger if exists pointage_entries_prevent_billed_changes on public.pointage_entries;
create trigger pointage_entries_prevent_billed_changes
  before insert or update or delete on public.pointage_entries
  for each row execute procedure public.prevent_billed_pointage_changes();
