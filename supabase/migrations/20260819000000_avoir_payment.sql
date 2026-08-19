alter table public.documents
  add column if not exists avoir_payment_method text,
  add column if not exists avoir_payment_reference text;
