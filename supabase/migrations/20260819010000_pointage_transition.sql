-- Pointage transition support: a sheet may temporarily reference a manual
-- client/engin while the catalogue is being digitised. Snapshot fields preserve
-- the exact names used for the sheet and future invoice hand-off.

create or replace function public.pointage_days_valid(value jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(value) = 'object'
    and not exists (
      select 1
      from jsonb_each(value) as item(day, amount)
      where day !~ '^[1-9][0-9]*$'
        or jsonb_typeof(amount) <> 'number'
        or (amount #>> '{}')::numeric not in (0, 0.5, 1)
    );
$$;

create or replace function public.pointage_overtime_valid(value jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(value) = 'object'
    and not exists (
      select 1
      from jsonb_each(value) as item(day, amount)
      where day !~ '^[1-9][0-9]*$'
        or jsonb_typeof(amount) <> 'number'
        or (amount #>> '{}')::numeric < 0
    );
$$;

alter table public.pointage_sheets
  add column if not exists client_name text,
  add column if not exists client_ice text,
  add column if not exists client_address text;

update public.pointage_sheets as sheet
set
  client_name = partner.name,
  client_ice = partner.ice,
  client_address = partner.address
from public.partenaires as partner
where partner.id = sheet.partenaire_id
  and sheet.client_name is null;

alter table public.pointage_sheets
  alter column partenaire_id drop not null,
  alter column client_name set default '',
  alter column client_name set not null;

alter table public.pointage_sheets
  drop constraint if exists pointage_sheets_partenaire_id_ym_key;

alter table public.pointage_sheets
  drop constraint if exists pointage_sheets_client_identity_check;

alter table public.pointage_sheets
  add constraint pointage_sheets_client_identity_check
  check (partenaire_id is not null or btrim(client_name) <> '');

create unique index if not exists pointage_sheets_linked_client_ym_key
  on public.pointage_sheets (partenaire_id, ym)
  where partenaire_id is not null;

create unique index if not exists pointage_sheets_manual_client_ym_key
  on public.pointage_sheets (
    lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')),
    ym
  )
  where partenaire_id is null;

alter table public.pointage_entries
  add column if not exists engin_name text;

update public.pointage_entries as entry
set engin_name = engin.name
from public.engins as engin
where engin.id = entry.engin_id
  and entry.engin_name is null;

alter table public.pointage_entries
  alter column engin_id drop not null,
  alter column engin_name set default '',
  alter column engin_name set not null;

alter table public.pointage_entries
  drop constraint if exists pointage_entries_sheet_id_engin_id_key;

create unique index if not exists pointage_entries_linked_engin_key
  on public.pointage_entries (sheet_id, engin_id)
  where engin_id is not null;

alter table public.pointage_entries
  drop constraint if exists pointage_entries_unit_price_check,
  drop constraint if exists pointage_entries_days_valid_check,
  drop constraint if exists pointage_entries_overtime_valid_check;

alter table public.pointage_entries
  add constraint pointage_entries_unit_price_check check (unit_price >= 0),
  add constraint pointage_entries_days_valid_check check (public.pointage_days_valid(days)),
  add constraint pointage_entries_overtime_valid_check check (public.pointage_overtime_valid(overtime_hours));

alter table public.settings
  drop constraint if exists settings_ot_reference_hours_check;

alter table public.settings
  add constraint settings_ot_reference_hours_check check (ot_reference_hours > 0);

create or replace function public.save_pointage_sheet(
  p_sheet_id uuid,
  p_expected_updated_at timestamptz,
  p_partenaire_id uuid,
  p_client_name text,
  p_client_ice text,
  p_client_address text,
  p_ym text,
  p_project text,
  p_entries jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sheet public.pointage_sheets%rowtype;
  v_entry jsonb;
  v_entry_id uuid;
  v_expected_entry_updated_at timestamptz;
  v_engin_id uuid;
  v_engin_name text;
  v_unit_price numeric;
  v_days jsonb;
  v_overtime jsonb;
  v_is_active boolean;
  v_client_name text := regexp_replace(btrim(coalesce(p_client_name, '')), '\s+', ' ', 'g');
  v_lock_key text;
begin
  if public.can_edit_resource('pointage') is not true then
    raise exception 'Permission refusée pour le pointage.' using errcode = '42501';
  end if;

  if p_ym !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Mois de pointage invalide.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_entries) <> 'array' then
    raise exception 'Entrées de pointage invalides.' using errcode = '22023';
  end if;

  if p_partenaire_id is null and v_client_name = '' then
    raise exception 'Le nom du client est obligatoire.' using errcode = '22023';
  end if;

  if p_partenaire_id is not null then
    select name, ice, address
    into v_client_name, p_client_ice, p_client_address
    from public.partenaires
    where id = p_partenaire_id;

    if not found then
      raise exception 'Partenaire introuvable.' using errcode = '22023';
    end if;
  end if;

  v_lock_key := coalesce(p_partenaire_id::text, lower(v_client_name)) || ':' || p_ym;
  perform pg_advisory_xact_lock(hashtext('pointage:' || v_lock_key));

  if p_sheet_id is not null then
    select * into v_sheet
    from public.pointage_sheets
    where id = p_sheet_id
    for update;

    if not found then
      raise exception 'Feuille de pointage introuvable.' using errcode = 'P0002';
    end if;

    if p_expected_updated_at is not null and v_sheet.updated_at <> p_expected_updated_at then
      raise exception 'Cette feuille a été modifiée dans un autre onglet. Rechargez-la avant d’enregistrer.' using errcode = '40001';
    end if;

    if v_sheet.ym <> p_ym
      or v_sheet.partenaire_id is distinct from p_partenaire_id
      or (v_sheet.partenaire_id is null and lower(regexp_replace(btrim(v_sheet.client_name), '\s+', ' ', 'g')) <> lower(v_client_name)) then
      raise exception 'L’identité de la feuille ne peut pas être modifiée.' using errcode = '22023';
    end if;

    update public.pointage_sheets
    set project = nullif(btrim(p_project), '')
    where id = v_sheet.id
    returning * into v_sheet;
  else
    select * into v_sheet
    from public.pointage_sheets
    where ym = p_ym
      and (
        (p_partenaire_id is not null and partenaire_id = p_partenaire_id)
        or (
          p_partenaire_id is null
          and partenaire_id is null
          and lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) = lower(v_client_name)
        )
      )
    for update;

    if found then
      update public.pointage_sheets
      set project = nullif(btrim(p_project), '')
      where id = v_sheet.id
      returning * into v_sheet;
    else
      insert into public.pointage_sheets (
        partenaire_id,
        client_name,
        client_ice,
        client_address,
        ym,
        project
      ) values (
        p_partenaire_id,
        v_client_name,
        nullif(btrim(p_client_ice), ''),
        nullif(btrim(p_client_address), ''),
        p_ym,
        nullif(btrim(p_project), '')
      )
      returning * into v_sheet;
    end if;
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    begin
      v_entry_id := nullif(v_entry ->> 'id', '')::uuid;
      v_expected_entry_updated_at := nullif(v_entry ->> 'expected_updated_at', '')::timestamptz;
      v_engin_id := nullif(v_entry ->> 'engin_id', '')::uuid;
      v_unit_price := (v_entry ->> 'unit_price')::numeric;
      v_days := coalesce(v_entry -> 'days', '{}'::jsonb);
      v_overtime := coalesce(v_entry -> 'overtime_hours', '{}'::jsonb);
      v_is_active := coalesce((v_entry ->> 'is_active')::boolean, true);
    exception when others then
      raise exception 'Entrée de pointage invalide.' using errcode = '22023';
    end;

    if v_unit_price is null or v_unit_price < 0
      or not public.pointage_days_valid(v_days)
      or not public.pointage_overtime_valid(v_overtime) then
      raise exception 'Valeurs de pointage invalides.' using errcode = '22023';
    end if;

    if v_entry_id is not null then
      update public.pointage_entries
      set
        unit_price = v_unit_price,
        days = v_days,
        overtime_hours = v_overtime,
        is_active = v_is_active
      where id = v_entry_id
        and sheet_id = v_sheet.id
        and (v_expected_entry_updated_at is null or updated_at = v_expected_entry_updated_at);

      if not found then
        raise exception 'Cette ligne a été modifiée dans un autre onglet. Rechargez la feuille avant d’enregistrer.' using errcode = '40001';
      end if;
    elsif v_engin_id is not null then
      select name into v_engin_name
      from public.engins
      where id = v_engin_id and is_active;

      if not found then
        raise exception 'Engin introuvable ou inactif.' using errcode = '22023';
      end if;

      update public.pointage_entries
      set
        unit_price = v_unit_price,
        days = v_days,
        overtime_hours = v_overtime,
        is_active = v_is_active
      where sheet_id = v_sheet.id and engin_id = v_engin_id;

      if not found then
        insert into public.pointage_entries (
          sheet_id, engin_id, engin_name, unit_price, days, overtime_hours, is_active
        ) values (
          v_sheet.id, v_engin_id, v_engin_name, v_unit_price, v_days, v_overtime, v_is_active
        );
      end if;
    else
      v_engin_name := regexp_replace(btrim(coalesce(v_entry ->> 'engin_name', '')), '\s+', ' ', 'g');
      if v_engin_name = '' then
        raise exception 'La désignation de l’engin est obligatoire.' using errcode = '22023';
      end if;

      insert into public.pointage_entries (
        sheet_id, engin_id, engin_name, unit_price, days, overtime_hours, is_active
      ) values (
        v_sheet.id, null, v_engin_name, v_unit_price, v_days, v_overtime, v_is_active
      );
    end if;
  end loop;

  return v_sheet.id;
end;
$$;

revoke all on function public.pointage_days_valid(jsonb) from public;
revoke all on function public.pointage_overtime_valid(jsonb) from public;
revoke all on function public.save_pointage_sheet(uuid, timestamptz, uuid, text, text, text, text, text, jsonb) from public;
grant execute on function public.save_pointage_sheet(uuid, timestamptz, uuid, text, text, text, text, text, jsonb) to authenticated;
