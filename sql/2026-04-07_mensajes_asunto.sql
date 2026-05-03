alter table public.casatalentos_mensajes
  add column if not exists asunto text;

alter table public.conectando_mensajes
  add column if not exists asunto text;

update public.casatalentos_mensajes
set asunto = left(
  trim(regexp_replace(coalesce(contenido, ''), E'[\\n\\r]+', ' ', 'g')),
  80
)
where parent_id is null
  and coalesce(trim(asunto), '') = ''
  and coalesce(trim(contenido), '') <> '';

update public.conectando_mensajes
set asunto = left(
  trim(regexp_replace(coalesce(contenido, ''), E'[\\n\\r]+', ' ', 'g')),
  80
)
where parent_id is null
  and coalesce(trim(asunto), '') = ''
  and coalesce(trim(contenido), '') <> '';
