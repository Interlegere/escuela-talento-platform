-- Nuevo campo de Coordenadas: "¿Qué te frena?", va justo después de
-- "¿Qué te entusiasma en la vida?". Nullable, mismo patrón que el resto de
-- las columnas de entusiasmo_proyectos (sin default, se guarda null cuando
-- está vacío).
alter table public.entusiasmo_proyectos
  add column if not exists que_te_frena text;
