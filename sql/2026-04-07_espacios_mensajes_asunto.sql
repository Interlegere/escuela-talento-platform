alter table public.espacios_mensajes
  add column if not exists asunto text;

update public.espacios_mensajes
set asunto = left(
  trim(
    regexp_replace(
      coalesce(contenido_texto, regexp_replace(coalesce(contenido_html, ''), '<[^>]+>', ' ', 'g')),
      E'[\\n\\r]+',
      ' ',
      'g'
    )
  ),
  80
)
where coalesce(trim(asunto), '') = '';
