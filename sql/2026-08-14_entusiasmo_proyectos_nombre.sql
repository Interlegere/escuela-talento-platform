-- Campo "Nombre" dentro de Coordenadas (Entusiasmento), distinto de
-- participante_nombre (que se sincroniza automáticamente con la cuenta).
alter table entusiasmo_proyectos add column if not exists nombre text;
