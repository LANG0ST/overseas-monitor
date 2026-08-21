alter table public.pointage_sheets
  add column if not exists has_cachet boolean not null default false;

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
        or mod((amount #>> '{}')::numeric * 2, 1) <> 0
    );
$$;
