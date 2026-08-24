-- Phase 13: keep document numbering protected even when the RPC is called directly.

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
  if public.can_edit_document(p_type) is not true then
    raise exception 'Permission refusée pour la numérotation.' using errcode = '42501';
  end if;

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
