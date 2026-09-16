-- Keep automatic numbering ahead of documents inserted or numbered manually.
create or replace function public.next_document_number(p_type public.document_type, p_year integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sequence_name text := format('document_numbers_%s_%s_seq', p_type::text, p_year);
  sequence_value bigint;
  highest_existing bigint;
  year_suffix text := right(p_year::text, 2);
  number_pattern text;
  candidate text;
begin
  if public.can_edit_document(p_type) is not true then
    raise exception 'Permission refusée pour la numérotation.' using errcode = '42501';
  end if;

  if p_year < 2000 or p_year > 9999 then
    raise exception 'Invalid document year: %', p_year using errcode = '22023';
  end if;

  number_pattern := case p_type
    when 'facture' then format('^([0-9]+)/%s/AI(/BIS)?$', p_year)
    when 'devis' then format('^D-([0-9]+)/%s$', year_suffix)
    when 'bon_commande' then format('^BC-([0-9]+)/%s$', year_suffix)
    when 'avoir' then format('^AV-([0-9]+)/%s$', year_suffix)
  end;

  perform pg_advisory_xact_lock(hashtext(sequence_name));
  execute format('create sequence if not exists %I minvalue 1 start with 1', sequence_name);

  select coalesce(max((regexp_match(number, number_pattern, 'i'))[1]::bigint), 0)
  into highest_existing
  from public.documents
  where type = p_type
    and number is not null
    and number ~* number_pattern;

  execute format('select nextval(%L)', 'public.' || sequence_name) into sequence_value;
  if sequence_value <= highest_existing then
    perform setval(('public.' || sequence_name)::regclass, highest_existing, true);
    execute format('select nextval(%L)', 'public.' || sequence_name) into sequence_value;
  end if;

  loop
    candidate := case p_type
      when 'facture' then lpad(sequence_value::text, 3, '0') || '/' || p_year || '/AI'
      when 'devis' then 'D-' || lpad(sequence_value::text, 4, '0') || '/' || year_suffix
      when 'bon_commande' then 'BC-' || lpad(sequence_value::text, 4, '0') || '/' || year_suffix
      when 'avoir' then 'AV-' || lpad(sequence_value::text, 4, '0') || '/' || year_suffix
    end;

    exit when not exists (
      select 1
      from public.documents
      where type = p_type
        and lower(number) = lower(candidate)
    );
    execute format('select nextval(%L)', 'public.' || sequence_name) into sequence_value;
  end loop;

  return candidate;
end;
$$;

revoke all on function public.next_document_number(public.document_type, integer) from public;
grant execute on function public.next_document_number(public.document_type, integer) to authenticated;
