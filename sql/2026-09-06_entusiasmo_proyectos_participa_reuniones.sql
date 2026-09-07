-- Permite distinguir quién participa de las reuniones grupales de
-- Entusiasmento (pensado para las personas que vienen de Mentorías: ahora
-- comparten el mismo espacio de Entusiasmento, pero no todas se suman a
-- la reunión semanal grupal). Solo a quien tiene este flag en true (o al
-- admin, que lo ve siempre) le aparece el bloque de "Reunión semanal" con
-- el próximo encuentro.
-- Default true: nadie deja de ver la reunión que ya venía viendo al correr
-- esta migración, el admin lo desmarca a mano por persona desde la solapa
-- de esa persona en /casatalentos.
alter table public.entusiasmo_proyectos
  add column if not exists participa_reuniones_grupales boolean not null default true;
