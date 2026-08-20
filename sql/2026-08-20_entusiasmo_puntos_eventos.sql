-- Sistema de puntos grupal de Entusiasmento: cada acción de avance suma un
-- evento acá. El total del mes calendario (Argentina) determina si se
-- desbloquea la reunión extra de la semana 2 (20 pts) y/o la de la semana
-- 4 (40 pts acumulados, sin resetear).
create table if not exists entusiasmo_puntos_eventos (
  id bigint generated always as identity primary key,
  participante_email text not null,
  categoria text not null, -- coordenadas | tareas | tarea_completada_senal | pitch | produccion | produccion_compartida
  puntos numeric not null default 0,
  fecha date not null, -- fecha en Argentina, para el tope diario
  produccion_id bigint references entusiasmo_producciones(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table entusiasmo_puntos_eventos enable row level security;

-- Tope de 1 punto por participante+categoría+día, solo para las categorías
-- que suman puntos reales de forma limitada por día. "tarea_completada_senal"
-- queda afuera a propósito: necesita poder repetirse el mismo día para
-- poder contar "¿se completaron 2 o más tareas hoy?".
create unique index if not exists entusiasmo_puntos_tope_diario_idx
  on entusiasmo_puntos_eventos (participante_email, categoria, fecha)
  where categoria in ('coordenadas', 'tareas', 'pitch', 'produccion');

-- El bonus de compartir en CoFruto es por producción (una sola vez cada
-- una, sin importar el día), no por día.
create unique index if not exists entusiasmo_puntos_compartida_idx
  on entusiasmo_puntos_eventos (produccion_id)
  where categoria = 'produccion_compartida';

create index if not exists entusiasmo_puntos_fecha_idx
  on entusiasmo_puntos_eventos (fecha);

-- Registro de qué umbrales ya se notificaron este mes, para no mandar el
-- mail de "se desbloqueó la reunión" más de una vez por umbral y mes.
create table if not exists entusiasmo_puntos_notificaciones (
  id bigint generated always as identity primary key,
  mes text not null, -- "YYYY-MM" en Argentina
  umbral integer not null,
  notificado_at timestamptz not null default now(),
  unique (mes, umbral)
);

alter table entusiasmo_puntos_notificaciones enable row level security;
