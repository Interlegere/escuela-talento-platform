-- Sincronización de tareas semanales al calendario personal de cada
-- participante, vía invitación de calendario por mail (no vía la API de
-- Google Calendar — evita el bloqueo de Workspace a invitados externos que
-- ya se documentó para la Agenda).
-- calendario_ics_sequence: número de revisión de la invitación (RFC 5545
--   SEQUENCE) — hay que subirlo en cada reenvío para que los clientes de
--   calendario lo traten como una actualización, no como un duplicado.
-- calendario_sincronizado_at: null = todavía no se mandó ninguna invitación
--   para esta tarea; con fecha = hay una invitación viva en el calendario
--   de la persona, así se sabe cuándo hace falta mandar una cancelación.
alter table public.entusiasmo_tareas
  add column if not exists calendario_ics_sequence integer not null default 0,
  add column if not exists calendario_sincronizado_at timestamptz;
