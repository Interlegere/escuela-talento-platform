alter table if exists public.conectando_mensajes
  add column if not exists contenido_html text;

alter table if exists public.casatalentos_mensajes
  add column if not exists contenido_html text;
