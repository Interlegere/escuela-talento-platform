-- Conexión de Google Calendar por participante (no solo la cuenta única de
-- Nicolás que ya existía). Se reutiliza la tabla google_calendar_tokens
-- existente en vez de crear una nueva — ya tenía la forma correcta
-- (access_token/refresh_token/scope/expiry por fila), solo le faltaba una
-- forma de asociar una fila a "la cuenta que conectó tal participante" en
-- vez de "la única cuenta configurada por env var".
alter table public.google_calendar_tokens
  add column if not exists participante_email text;

create unique index if not exists google_calendar_tokens_participante_email_idx
  on public.google_calendar_tokens (participante_email)
  where participante_email is not null;

-- Para poder actualizar/borrar el evento correcto en el calendario propio
-- de la persona (en vez de mandar una invitación por mail) hace falta
-- guardar qué evento de SU calendario le corresponde a cada tarea.
alter table public.entusiasmo_tareas
  add column if not exists calendario_google_event_id text;
