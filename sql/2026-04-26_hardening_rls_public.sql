-- Hardening de seguridad para Supabase
-- Contexto:
-- La plataforma usa Next.js + rutas backend con service_role para operar sobre la base.
-- No dependemos de lecturas/escrituras directas desde el cliente anónimo/autenticado de Supabase.
-- Por eso, la estrategia segura es:
-- 1. habilitar RLS en tablas públicas de la app
-- 2. revocar acceso directo a anon/authenticated
-- 3. dejar el acceso de la app canalizado sólo por el backend

do $$
declare
  tabla text;
  tablas text[] := array[
    'public.usuarios_plataforma',
    'public.google_calendar_tokens',
    'public.honorarios_participante',
    'public.pagos_mensuales',
    'public.consentimientos',
    'public.configuracion_plataforma',
    'public.actividades',
    'public.recursos',
    'public.actividad_recursos',
    'public.accesos_individuales',
    'public.inscripciones',
    'public.disponibilidades',
    'public.reservas',
    'public.espacios_acompanamiento',
    'public.espacios_mensajes',
    'public.espacios_recursos',
    'public.espacios_accesos_extra',
    'public.grabaciones',
    'public.casatalentos_videos',
    'public.casatalentos_votos',
    'public.casatalentos_comentarios',
    'public.casatalentos_referentes_generales',
    'public.casatalentos_referentes_semanales',
    'public.casatalentos_mensajes',
    'public.conectando_mensajes'
  ];
begin
  foreach tabla in array tablas loop
    if to_regclass(tabla) is not null then
      execute format('alter table %s enable row level security', tabla);
      execute format(
        'revoke all privileges on table %s from anon, authenticated',
        tabla
      );
    end if;
  end loop;
end $$;

-- No creamos policies públicas a propósito.
-- Si en el futuro querés exponer alguna tabla directo desde Supabase al cliente,
-- habrá que abrir esa tabla puntualmente con policies específicas.
