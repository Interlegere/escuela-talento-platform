-- Fix de la migración anterior (2026-08-27): un índice único PARCIAL
-- ("where participante_email is not null") no sirve como target de
-- ON CONFLICT en un upsert simple — Postgres lo rechaza con
-- "no unique or exclusion constraint matching the ON CONFLICT specification"
-- salvo que el ON CONFLICT repita el mismo predicado, algo que la API de
-- upsert de Supabase no permite expresar.
-- Se reemplaza por una restricción UNIQUE común: en Postgres, UNIQUE nunca
-- considera dos NULLs como iguales, así que las filas viejas del flujo de
-- Nicolás (participante_email null) siguen conviviendo sin problema.
drop index if exists public.google_calendar_tokens_participante_email_idx;

alter table public.google_calendar_tokens
  add constraint google_calendar_tokens_participante_email_key unique (participante_email);
