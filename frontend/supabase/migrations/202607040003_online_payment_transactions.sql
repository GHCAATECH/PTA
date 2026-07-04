create table if not exists public.online_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  reference text not null unique,
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  expected_amount numeric(12,2) not null,
  paid_amount numeric(12,2),
  currency text not null default 'GHS',
  status text not null default 'initialized',
  checkout_email text,
  payment_id uuid references public.payments(id) on delete set null,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists online_payment_transactions_student_idx
  on public.online_payment_transactions(student_id, academic_year_id);

drop trigger if exists online_payment_transactions_updated on public.online_payment_transactions;
create trigger online_payment_transactions_updated
before update on public.online_payment_transactions
for each row execute function public.set_updated_at();

alter table public.online_payment_transactions enable row level security;

drop policy if exists "staff read online payment transactions" on public.online_payment_transactions;
create policy "staff read online payment transactions"
on public.online_payment_transactions for select to authenticated
using (public.is_staff());

drop policy if exists "students read own online payment transactions" on public.online_payment_transactions;
create policy "students read own online payment transactions"
on public.online_payment_transactions for select to authenticated
using (
  exists(
    select 1 from public.student_accounts a
    where a.student_id = online_payment_transactions.student_id
      and a.user_id = auth.uid()
  )
);

create or replace function public.record_online_payment(
  p_reference text,
  p_student_id uuid,
  p_academic_year_id uuid,
  p_amount numeric,
  p_provider text default 'paystack',
  p_currency text default 'GHS',
  p_checkout_email text default null,
  p_provider_payload jsonb default '{}'::jsonb,
  p_remarks text default null
) returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.payments;
  v_receiver uuid;
  v_payment public.payments;
begin
  select p.*
    into v_existing
  from public.online_payment_transactions t
  join public.payments p on p.id = t.payment_id
  where t.reference = p_reference
  limit 1;

  if found then
    return v_existing;
  end if;

  if p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select id
    into v_receiver
  from public.profiles
  where role = 'administrator'
    and upper(trim(full_name)) = 'ADMINISTRATOR'
  order by created_at nulls last, full_name
  limit 1;

  if v_receiver is null then
    select id
      into v_receiver
    from public.profiles
    where role = 'administrator'
    order by created_at nulls last, full_name
    limit 1;
  end if;

  if v_receiver is null then
    select id
      into v_receiver
    from public.profiles
    order by created_at nulls last, full_name
    limit 1;
  end if;

  if v_receiver is null then
    raise exception 'No staff profile available to record online payment';
  end if;

  insert into public.payments(
    student_id,
    academic_year_id,
    amount_paid,
    payment_date,
    receipt_number,
    payment_method,
    remarks,
    received_by,
    is_override
  )
  values(
    p_student_id,
    p_academic_year_id,
    p_amount,
    current_date,
    'PTA-' || extract(year from current_date)::int || '-' || lpad(nextval('public.receipt_number_seq')::text, 6, '0'),
    'mobile_money',
    coalesce(nullif(trim(p_remarks), ''), initcap(p_provider) || ' online payment (' || p_reference || ')'),
    v_receiver,
    false
  )
  returning *
    into v_payment;

  insert into public.online_payment_transactions(
    provider,
    reference,
    student_id,
    academic_year_id,
    expected_amount,
    paid_amount,
    currency,
    status,
    checkout_email,
    payment_id,
    provider_payload,
    verified_at
  )
  values(
    p_provider,
    p_reference,
    p_student_id,
    p_academic_year_id,
    p_amount,
    p_amount,
    p_currency,
    'verified',
    nullif(trim(p_checkout_email), ''),
    v_payment.id,
    coalesce(p_provider_payload, '{}'::jsonb),
    now()
  )
  on conflict (reference) do update
    set paid_amount = excluded.paid_amount,
        currency = excluded.currency,
        status = excluded.status,
        checkout_email = excluded.checkout_email,
        payment_id = excluded.payment_id,
        provider_payload = excluded.provider_payload,
        verified_at = excluded.verified_at,
        updated_at = now();

  return v_payment;
end;
$$;

revoke all on function public.record_online_payment(text,uuid,uuid,numeric,text,text,text,jsonb,text) from public;
grant execute on function public.record_online_payment(text,uuid,uuid,numeric,text,text,text,jsonb,text) to authenticated;
