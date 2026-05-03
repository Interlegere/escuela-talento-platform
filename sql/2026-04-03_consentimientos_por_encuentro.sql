drop index if exists public.consentimientos_user_actividad_version_idx;

alter table public.consentimientos
  add column if not exists disponibilidad_id bigint,
  add column if not exists fecha_encuentro date,
  add column if not exists hora_encuentro text;

with duplicados as (
  select
    id,
    row_number() over (
      partition by user_email, actividad, version, disponibilidad_id
      order by created_at desc, id desc
    ) as rn
  from public.consentimientos
)
delete from public.consentimientos c
using duplicados d
where c.id = d.id
  and d.rn > 1;

create unique index if not exists consentimientos_user_actividad_version_disponibilidad_idx
  on public.consentimientos (user_email, actividad, version, disponibilidad_id)
  nulls not distinct;

create index if not exists consentimientos_disponibilidad_id_idx
  on public.consentimientos (disponibilidad_id);
