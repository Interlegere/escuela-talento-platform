-- Permite distinguir quién suma puntos hacia la meta grupal de "reunión
-- extra" (pensado para las personas que vienen de Mentorías: usan las
-- herramientas de Entusiasmento pero no participan de las reuniones
-- grupales, así que sus acciones no deberían contar para esa meta).
-- Default true: nadie pierde puntos existentes al correr esta migración,
-- el admin lo desmarca a mano por persona desde la solapa de esa persona
-- en /casatalentos.
alter table public.entusiasmo_proyectos
  add column if not exists suma_puntos_grupales boolean not null default true;
