alter table public.school_settings
  add column if not exists online_payment_enabled boolean not null default false,
  add column if not exists online_payment_url text,
  add column if not exists online_payment_note text not null default 'Use the secure payment link below to pay your PTA dues online.';
