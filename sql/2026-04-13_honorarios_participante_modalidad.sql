alter table public.honorarios_participante
  add column if not exists modalidad_pago text not null default 'mensual';

update public.honorarios_participante
set modalidad_pago = 'mensual'
where coalesce(trim(modalidad_pago), '') = '';
