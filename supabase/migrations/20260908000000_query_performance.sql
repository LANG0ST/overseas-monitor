-- Reduce per-row RLS function evaluation and move dashboard totals into Postgres.

create index if not exists documents_active_type_updated_idx
  on public.documents (type, updated_at desc)
  where is_active;

create index if not exists documents_active_facture_date_idx
  on public.documents (date)
  where type = 'facture' and is_active and number is not null;

create index if not exists pointage_sheets_active_ym_client_idx
  on public.pointage_sheets (ym, client_name)
  where is_active;

create or replace function public.dashboard_invoice_totals(p_from date, p_to date)
returns table(monthly_ttc numeric, unpaid_total numeric, unpaid_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(sum(ttc), 0) as monthly_ttc,
    coalesce(sum(ttc) filter (where not paid), 0) as unpaid_total,
    count(*) filter (where not paid) as unpaid_count
  from public.documents
  where type = 'facture'
    and is_active
    and number is not null
    and date between p_from and p_to;
$$;

revoke all on function public.dashboard_invoice_totals(date, date) from public;
grant execute on function public.dashboard_invoice_totals(date, date) to authenticated;

drop policy if exists "profiles are visible to their owner and admins" on public.profiles;
create policy "profiles are visible to their owner and admins"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles"
  on public.profiles for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "permissions are visible to their owner and admins" on public.permissions;
create policy "permissions are visible to their owner and admins"
  on public.permissions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "admins manage permissions" on public.permissions;
create policy "admins manage permissions"
  on public.permissions for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "active users read partenaires" on public.partenaires;
create policy "active users read partenaires"
  on public.partenaires for select to authenticated
  using ((select public.is_active_user()));

drop policy if exists "permitted users write partenaires" on public.partenaires;
create policy "permitted users write partenaires"
  on public.partenaires for all to authenticated
  using ((select public.is_active_user()) and (select public.can_edit_resource('partenaires')))
  with check ((select public.is_active_user()) and (select public.can_edit_resource('partenaires')));

drop policy if exists "active users read engins" on public.engins;
create policy "active users read engins"
  on public.engins for select to authenticated
  using ((select public.is_active_user()));

drop policy if exists "permitted users write engins" on public.engins;
create policy "permitted users write engins"
  on public.engins for all to authenticated
  using ((select public.is_active_user()) and (select public.can_edit_resource('engins')))
  with check ((select public.is_active_user()) and (select public.can_edit_resource('engins')));

drop policy if exists "active users read visible documents" on public.documents;
create policy "active users read visible documents"
  on public.documents for select to authenticated
  using (
    (select public.is_active_user())
    and (
      type <> 'facture'
      or number is not null
      or created_by = (select auth.uid())
      or (select public.is_admin())
    )
  );

drop policy if exists "permitted users create owned documents" on public.documents;
create policy "permitted users create owned documents"
  on public.documents for insert to authenticated
  with check (
    (select public.is_active_user())
    and (select public.can_edit_document(type))
    and created_by = (select auth.uid())
  );

drop policy if exists "permitted users update visible documents" on public.documents;
create policy "permitted users update visible documents"
  on public.documents for update to authenticated
  using (
    (select public.is_active_user())
    and (select public.can_edit_document(type))
    and (type <> 'facture' or number is not null or created_by = (select auth.uid()) or (select public.is_admin()))
  )
  with check (
    (select public.is_active_user())
    and (select public.can_edit_document(type))
    and (type <> 'facture' or number is not null or created_by = (select auth.uid()) or (select public.is_admin()))
  );

drop policy if exists "permitted users delete visible documents" on public.documents;
create policy "permitted users delete visible documents"
  on public.documents for delete to authenticated
  using (
    (select public.is_active_user())
    and (select public.can_edit_document(type))
    and (type <> 'facture' or number is not null or created_by = (select auth.uid()) or (select public.is_admin()))
  );

drop policy if exists "active users read pointage sheets" on public.pointage_sheets;
create policy "active users read pointage sheets"
  on public.pointage_sheets for select to authenticated
  using ((select public.is_active_user()));

drop policy if exists "permitted users write pointage sheets" on public.pointage_sheets;
create policy "permitted users write pointage sheets"
  on public.pointage_sheets for all to authenticated
  using ((select public.is_active_user()) and (select public.can_edit_resource('pointage')))
  with check ((select public.is_active_user()) and (select public.can_edit_resource('pointage')));

drop policy if exists "active users read pointage entries" on public.pointage_entries;
create policy "active users read pointage entries"
  on public.pointage_entries for select to authenticated
  using ((select public.is_active_user()));

drop policy if exists "permitted users write pointage entries" on public.pointage_entries;
create policy "permitted users write pointage entries"
  on public.pointage_entries for all to authenticated
  using ((select public.is_active_user()) and (select public.can_edit_resource('pointage')))
  with check ((select public.is_active_user()) and (select public.can_edit_resource('pointage')));

drop policy if exists "active users read settings" on public.settings;
create policy "active users read settings"
  on public.settings for select to authenticated
  using ((select public.is_active_user()));

drop policy if exists "admins write settings" on public.settings;
create policy "admins write settings"
  on public.settings for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
