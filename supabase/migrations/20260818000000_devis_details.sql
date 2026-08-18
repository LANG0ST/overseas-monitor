alter table public.documents
  add column if not exists devis_fuel_driver text not null default 'inclus',
  add column if not exists devis_payment_conditions text not null default 'À réception',
  add column if not exists devis_bank_name text not null default 'ATTIJARIWAFA BANK',
  add column if not exists devis_iban text not null default 'MA64 0071 7000 0643 2000 0003 2766';
