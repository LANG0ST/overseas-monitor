create index if not exists documents_facture_drafts_owner_idx
  on public.documents (created_by, date desc)
  where type = 'facture' and number is null;

drop policy if exists "active users read documents" on public.documents;
drop policy if exists "active users read visible documents" on public.documents;
create policy "active users read visible documents"
  on public.documents for select to authenticated
  using (
    public.is_active_user()
    and (
      type <> 'facture'
      or number is not null
      or created_by = auth.uid()
      or public.is_admin()
    )
  );

drop policy if exists "permitted users write documents" on public.documents;

drop policy if exists "permitted users create owned documents" on public.documents;
create policy "permitted users create owned documents"
  on public.documents for insert to authenticated
  with check (
    public.is_active_user()
    and public.can_edit_document(type)
    and created_by = auth.uid()
  );

drop policy if exists "permitted users update visible documents" on public.documents;
create policy "permitted users update visible documents"
  on public.documents for update to authenticated
  using (
    public.is_active_user()
    and public.can_edit_document(type)
    and (
      type <> 'facture'
      or number is not null
      or created_by = auth.uid()
      or public.is_admin()
    )
  )
  with check (
    public.is_active_user()
    and public.can_edit_document(type)
    and (
      type <> 'facture'
      or number is not null
      or created_by = auth.uid()
      or public.is_admin()
    )
  );

drop policy if exists "permitted users delete visible documents" on public.documents;
create policy "permitted users delete visible documents"
  on public.documents for delete to authenticated
  using (
    public.is_active_user()
    and public.can_edit_document(type)
    and (
      type <> 'facture'
      or number is not null
      or created_by = auth.uid()
      or public.is_admin()
    )
  );
