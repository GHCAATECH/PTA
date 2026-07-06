alter table public.academic_years
  drop constraint if exists academic_years_year_check;

alter table public.academic_years
  add constraint academic_years_year_check
  check (
    year ~ '^20[0-9]{2}/20[0-9]{2}( - Semester [12])?$'
  );
