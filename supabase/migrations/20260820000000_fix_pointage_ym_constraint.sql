-- The original check used an over-escaped \d expression. Use an explicit
-- numeric character class so PostgreSQL consistently accepts YYYY-MM values.
alter table public.pointage_sheets
  drop constraint if exists pointage_sheets_ym_check;

alter table public.pointage_sheets
  add constraint pointage_sheets_ym_check
  check (ym ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
