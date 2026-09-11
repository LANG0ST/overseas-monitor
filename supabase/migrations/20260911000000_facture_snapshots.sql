create table if not exists public.document_snapshots (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  snapshot jsonb not null,
  reason text not null default 'save' check (reason in ('save', 'restore')),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists document_snapshots_document_created_idx
  on public.document_snapshots (document_id, created_at desc);

alter table public.document_snapshots enable row level security;

drop policy if exists "editors read unlocked facture snapshots" on public.document_snapshots;
create policy "editors read unlocked facture snapshots"
  on public.document_snapshots for select to authenticated
  using (
    (select public.is_active_user())
    and exists (
      select 1
      from public.documents
      where documents.id = document_snapshots.document_id
        and documents.type = 'facture'
        and documents.is_active
        and not documents.is_locked
        and (select public.can_edit_document(documents.type))
        and (
          documents.number is not null
          or documents.created_by = (select auth.uid())
          or (select public.is_admin())
        )
    )
  );

drop policy if exists "editors create unlocked facture snapshots" on public.document_snapshots;
create policy "editors create unlocked facture snapshots"
  on public.document_snapshots for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select public.is_active_user())
    and exists (
      select 1
      from public.documents
      where documents.id = document_snapshots.document_id
        and documents.type = 'facture'
        and documents.is_active
        and not documents.is_locked
        and (select public.can_edit_document(documents.type))
        and (
          documents.number is not null
          or documents.created_by = (select auth.uid())
          or (select public.is_admin())
        )
    )
  );

revoke all on table public.document_snapshots from anon, authenticated;
grant select, insert on table public.document_snapshots to authenticated;
