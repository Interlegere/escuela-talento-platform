-- Registro liviano de emails que alguna vez tuvieron cuenta y se borraron
-- del todo desde /admin/usuarios — para poder avisar si un email que se
-- está por dar de alta ya se había usado antes, sin guardar ningún dato
-- real de esa persona (eso se borra de verdad, sin excepción).
create table if not exists public.usuarios_eliminados_historial (
  id bigint generated always as identity primary key,
  email text not null,
  nombre text,
  role text,
  eliminado_at timestamptz not null default now(),
  eliminado_por_email text
);

create index if not exists usuarios_eliminados_historial_email_idx
  on public.usuarios_eliminados_historial (lower(email));

alter table public.usuarios_eliminados_historial enable row level security;

-- Borra a una persona de la plataforma por completo (todas las tablas
-- relacionadas por email, ~20 en total) para poder reusar el mismo mail en
-- una alta nueva sin residuos. Corre en una sola transacción: si algo falla
-- a mitad de camino, Postgres deshace todo, nunca queda a medio borrar.
-- Solo borra a alguien que ya está marcado inactivo — es la última línea
-- de defensa además del chequeo que ya hace la API antes de llamar a esto.
-- No toca archivos de Storage (eso lo resuelve el código, fuera de la
-- transacción de la base) ni `comunicacion_contactos`/`preinscripciones`
-- (son agendas/leads aparte, no "la cuenta" de la persona).
create or replace function public.eliminar_usuario_completo(
  p_email text,
  p_eliminado_por text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario record;
  v_conteos jsonb := '{}'::jsonb;
  v_n int;
begin
  select id, nombre, role, activo into v_usuario
  from usuarios_plataforma
  where lower(email) = lower(p_email);

  if not found then
    raise exception 'No existe ningún usuario con ese email.';
  end if;

  if v_usuario.activo then
    raise exception 'Solo se puede eliminar a alguien que ya está inactivo.';
  end if;

  -- pagos_mensuales cuelga de inscripciones con ON DELETE RESTRICT, hay
  -- que borrarlo antes o la siguiente sentencia falla.
  delete from pagos_mensuales
  where inscripcion_id in (
    select id from inscripciones where lower(participante_email) = lower(p_email)
  );
  get diagnostics v_n = row_count;
  v_conteos := v_conteos || jsonb_build_object('pagos_mensuales', v_n);

  delete from inscripciones where lower(participante_email) = lower(p_email);
  get diagnostics v_n = row_count;
  v_conteos := v_conteos || jsonb_build_object('inscripciones', v_n);

  -- reservas cuelga de disponibilidades con ON DELETE RESTRICT (además de
  -- las reservas propias por participante_email/realizada_por_email).
  delete from reservas
  where disponibilidad_id in (
    select id from disponibilidades where lower(participante_email) = lower(p_email)
  )
  or lower(participante_email) = lower(p_email)
  or lower(realizada_por_email) = lower(p_email);
  get diagnostics v_n = row_count;
  v_conteos := v_conteos || jsonb_build_object('reservas', v_n);

  delete from disponibilidades where lower(participante_email) = lower(p_email);
  get diagnostics v_n = row_count;
  v_conteos := v_conteos || jsonb_build_object('disponibilidades', v_n);

  -- entusiasmo_proyectos se lleva en cascada (FK) a entusiasmo_aportes,
  -- entusiasmo_campos_actividad, entusiasmo_coordenadas_versiones,
  -- entusiasmo_producciones (que a su vez se lleva sus propios aportes y
  -- puntos_eventos), entusiasmo_tareas (que se lleva sus propias
  -- versiones) y entusiasmo_tareas_series.
  delete from entusiasmo_proyectos where lower(participante_email) = lower(p_email);
  get diagnostics v_n = row_count;
  v_conteos := v_conteos || jsonb_build_object('entusiasmo_proyectos', v_n);

  delete from entusiasmo_agente_mensajes where lower(participante_email) = lower(p_email);
  delete from entusiasmo_busquedas where lower(participante_email) = lower(p_email);
  delete from entusiasmo_puntos_eventos where lower(participante_email) = lower(p_email);
  delete from entusiasmo_lecturas
  where lower(participante_email) = lower(p_email) or lower(lector_email) = lower(p_email);

  delete from honorarios_participante where lower(participante_email) = lower(p_email);
  delete from accesos_individuales where lower(participante_email) = lower(p_email);

  delete from casatalentos_videos where lower(participante_email) = lower(p_email);
  get diagnostics v_n = row_count;
  v_conteos := v_conteos || jsonb_build_object('casatalentos_videos', v_n);
  delete from casatalentos_votos where lower(votante_email) = lower(p_email);
  delete from casatalentos_comentarios where lower(autor_email) = lower(p_email);
  delete from casatalentos_mensajes where lower(autor_email) = lower(p_email);
  delete from conectando_mensajes where lower(autor_email) = lower(p_email);

  delete from espacios_acompanamiento where lower(participante_email) = lower(p_email);
  get diagnostics v_n = row_count;
  v_conteos := v_conteos || jsonb_build_object('espacios_acompanamiento', v_n);

  delete from google_calendar_tokens
  where lower(participante_email) = lower(p_email) or lower(user_email) = lower(p_email);

  delete from hdr_coordenadas where lower(participante_email) = lower(p_email);
  delete from hdr_respuestas where lower(participante_email) = lower(p_email);
  delete from hdr_notas_personales where lower(participante_email) = lower(p_email);
  delete from hdr_aportes where lower(participante_email) = lower(p_email);

  delete from consentimientos where lower(user_email) = lower(p_email);
  delete from comunicacion_envios where lower(destinatario_email) = lower(p_email);
  delete from usuario_actividades where lower(usuario_email) = lower(p_email);

  delete from usuarios_plataforma where id = v_usuario.id;
  get diagnostics v_n = row_count;
  v_conteos := v_conteos || jsonb_build_object('usuarios_plataforma', v_n);

  insert into usuarios_eliminados_historial (email, nombre, role, eliminado_por_email)
  values (lower(p_email), v_usuario.nombre, v_usuario.role, p_eliminado_por);

  return v_conteos;
end;
$$;
