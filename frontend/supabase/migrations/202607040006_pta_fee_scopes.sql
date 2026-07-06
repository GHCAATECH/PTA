alter table public.pta_fees
  add column if not exists applies_to text,
  add column if not exists class_id uuid references public.classes(id) on delete cascade,
  add column if not exists student_id uuid references public.students(id) on delete cascade;

update public.pta_fees
set applies_to = 'all_classes'
where applies_to is null or btrim(applies_to) = '';

alter table public.pta_fees
  alter column applies_to set default 'all_classes',
  alter column applies_to set not null;

alter table public.pta_fees
  drop constraint if exists pta_fees_academic_year_id_key,
  drop constraint if exists pta_fees_scope_check;

drop index if exists public.pta_fees_academic_year_id_key;
drop index if exists public.pta_fees_all_classes_idx;
drop index if exists public.pta_fees_class_idx;
drop index if exists public.pta_fees_student_idx;

alter table public.pta_fees
  add constraint pta_fees_scope_check
  check (
    (applies_to = 'all_classes' and class_id is null and student_id is null)
    or (applies_to = 'class' and class_id is not null and student_id is null)
    or (applies_to = 'student' and class_id is null and student_id is not null)
  );

create unique index if not exists pta_fees_all_classes_idx
  on public.pta_fees(academic_year_id)
  where applies_to = 'all_classes';

create unique index if not exists pta_fees_class_idx
  on public.pta_fees(academic_year_id, class_id)
  where applies_to = 'class';

create unique index if not exists pta_fees_student_idx
  on public.pta_fees(academic_year_id, student_id)
  where applies_to = 'student';

drop view if exists public.student_fee_summary;

create view public.student_fee_summary as
with fee_rules as (
  select
    s.id as student_id,
    ay.id as academic_year_id,
    ay.year,
    c.name as class_name,
    coalesce(sf.amount, cf.amount, af.amount, 0::numeric) as fee_amount
  from public.students s
  cross join public.academic_years ay
  left join public.classes c
    on c.id = s.class_id
  left join public.pta_fees sf
    on sf.academic_year_id = ay.id
   and sf.applies_to = 'student'
   and sf.student_id = s.id
  left join public.pta_fees cf
    on cf.academic_year_id = ay.id
   and cf.applies_to = 'class'
   and cf.class_id = s.class_id
  left join public.pta_fees af
    on af.academic_year_id = ay.id
   and af.applies_to = 'all_classes'
), payment_totals as (
  select
    p.student_id,
    p.academic_year_id,
    coalesce(sum(p.amount_paid), 0::numeric) as total_paid
  from public.payments p
  group by p.student_id, p.academic_year_id
)
select
  fr.student_id,
  fr.academic_year_id,
  fr.year,
  fr.class_name,
  fr.fee_amount,
  coalesce(pt.total_paid, 0::numeric) as total_paid,
  greatest(fr.fee_amount - coalesce(pt.total_paid, 0::numeric), 0::numeric) as outstanding_balance,
  case
    when coalesce(pt.total_paid, 0::numeric) <= 0::numeric then 'UNPAID'::text
    when coalesce(pt.total_paid, 0::numeric) >= fr.fee_amount then 'PAID'::text
    else 'PARTIALLY PAID'::text
  end as payment_status
from fee_rules fr
left join payment_totals pt
  on pt.student_id = fr.student_id
 and pt.academic_year_id = fr.academic_year_id;

grant select on public.student_fee_summary to authenticated;
