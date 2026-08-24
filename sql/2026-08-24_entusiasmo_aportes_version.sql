-- Liga cada comentario anclado a la versión de texto sobre la que se hizo
-- (null = todavía sobre el texto vigente). Al archivar un campo que cambió
-- (ver PUT /api/entusiasmo/proyecto), los comentarios que estaban en null
-- para ese campo pasan a apuntar a la versión recién archivada — así nunca
-- se "pierden" cuando el participante reescribe sus coordenadas, quedan
-- visibles junto a la versión anterior a la que corresponden.
alter table public.entusiasmo_aportes
  add column if not exists version_id bigint
    references public.entusiasmo_coordenadas_versiones(id) on delete set null;
