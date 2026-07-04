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
