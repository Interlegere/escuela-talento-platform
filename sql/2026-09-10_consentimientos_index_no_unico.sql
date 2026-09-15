-- El índice único de sql/2026-04-03_consentimientos_por_encuentro.sql hacía
-- que el POST (un upsert) pisara la aceptación anterior cuando
-- disponibilidad_id era null (ej. la charla introductoria) — con eso no
-- queda historial, queda "la última". Pasa a ser un índice común: mismas
-- columnas, misma velocidad de búsqueda, pero ya no bloquea filas repetidas.
-- Cada aceptación nueva es una fila nueva, sin importar si el identificador
-- del encuentro es null o no.
drop index if exists public.consentimientos_user_actividad_version_disponibilidad_idx;

create index if not exists consentimientos_user_actividad_version_disponibilidad_idx
  on public.consentimientos (user_email, actividad, version, disponibilidad_id);
