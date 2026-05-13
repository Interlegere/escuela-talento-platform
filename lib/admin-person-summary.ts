import { estaDentroDeGraciaMensual } from "@/lib/activity-rules"
import { normalizarModalidadPago, type BillingMode } from "@/lib/billing"
import { normalizarDocumentosNotas } from "@/lib/documentos-notas"
import { obtenerFechaISOArgentina } from "@/lib/fechas"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export type ActividadSlugResumen =
  | "casatalentos"
  | "conectando-sentidos"
  | "mentorias"
  | "terapia"
  | "charla-introductoria"

export type ModalidadPagoResumen =
  | "mensual"
  | "por_sesion"
  | "por_proceso"
  | "becado"
  | "invitado"
  | "sin_cobro"
  | "desconocida"

export type PerfilResumen = {
  nombre: string
  apellido: string
  nombreCompleto: string
  email: string
  whatsapp: string | null
  fechaNacimiento: string | null
  role: "admin" | "colaborador" | "participante"
  activo: boolean
  charlaIntroHabilitada: boolean
  notasDocumentos: string | null
  creadoEn: string | null
}

export type ActividadResumen = {
  actividad: ActividadSlugResumen
  etiqueta: string
  marcadaEnUsuarioActividades: boolean
  inscripcionActiva: boolean
  accesoEsperado: boolean
  accesoMotivo:
    | "ok"
    | "gracia"
    | "sin_inscripcion"
    | "sin_honorario"
    | "sin_pago"
    | "bloqueado"
    | "charla"
    | "no_aplica"
  estadoVisible:
    | "activa"
    | "inactiva"
    | "sin_configurar"
    | "inconsistente"
    | "charla"
  observaciones: string[]
}

export type EconomiaResumen = {
  actividad: Exclude<ActividadSlugResumen, "charla-introductoria">
  etiqueta: string
  honorarioId: string | null
  honorarioActivo: boolean
  monto: number | null
  moneda: string | null
  modalidad: ModalidadPagoResumen
  medioSugerido: "transferencia" | "mercado_pago" | "manual" | null
  ultimoPago: {
    id: string | null
    periodo: string | null
    estado: string | null
    fecha: string | null
    medio: string | null
  } | null
  pagoPendiente: boolean
}

export type AgendaResumen = {
  actividad: Exclude<ActividadSlugResumen, "charla-introductoria">
  tipo: "individual" | "grupal"
  proximoEncuentro: {
    inicio: string | null
    fin: string | null
    meetLink: string | null
    titulo: string | null
  } | null
  ultimoEncuentro: {
    inicio: string | null
    fin: string | null
    titulo: string | null
  } | null
  cantidadPendientes: number
  notasDocumento: string | null
}

export type AlertaResumen = {
  codigo:
    | "actividad_sin_inscripcion"
    | "inscripcion_sin_honorario"
    | "honorario_sin_pago"
    | "actividad_sin_honorario"
    | "mentoria_sin_proximo_encuentro"
    | "terapia_sin_proximo_encuentro"
    | "usuario_inactivo"
    | "charla_intro_habilitada"
    | "sin_actividad"
  nivel: "info" | "warning" | "error"
  titulo: string
  detalle: string
  actividad: ActividadSlugResumen | null
}

export type PersonaResumen = {
  id: string
  email: string
  perfil: PerfilResumen
  actividades: ActividadResumen[]
  economia: EconomiaResumen[]
  agenda: AgendaResumen[]
  alertas: AlertaResumen[]
  resumen: {
    actividadesActivas: number
    pagosPendientes: number
    proximoEncuentro: string | null
    tieneCharlaIntro: boolean
    estadoGeneral: "ok" | "atencion" | "inconsistente"
  }
}

type UsuarioRow = {
  id: string
  nombre: string
  apellido?: string | null
  email: string
  whatsapp?: string | null
  fecha_cumpleanos?: string | null
  notas_documentos?: unknown
  charla_intro_habilitada?: boolean | null
  role: "admin" | "colaborador" | "participante"
  activo: boolean
  created_at?: string | null
}

type ActividadDbRow = {
  id: number
  slug: string
  nombre?: string | null
}

type UsuarioActividadRow = {
  usuario_email?: string | null
  actividad_slug?: string | null
  estado?: string | null
}

type InscripcionRow = {
  id: number
  actividad_id: number
  participante_email?: string | null
  estado?: string | null
}

type HonorarioRow = {
  id: number
  actividad_id: number
  participante_email?: string | null
  honorario_mensual?: string | number | null
  modalidad_pago?: string | null
  moneda?: string | null
  activo?: boolean | null
}

type PagoRow = {
  id: number
  actividad_id?: number | null
  inscripcion_id?: number | null
  estado?: string | null
  monto?: string | number | null
  moneda?: string | null
  medio_pago?: string | null
  anio?: number | null
  mes?: number | null
  created_at?: string | null
}

type DisponibilidadRow = {
  id: number
  actividad_slug?: string | null
  participante_email?: string | null
  fecha?: string | null
  hora?: string | null
  duracion?: string | null
  titulo?: string | null
  meet_link?: string | null
  modo?: string | null
  estado?: string | null
}

type ReservaRow = {
  id: number
  participante_email?: string | null
  estado?: string | null
  disponibilidades?: {
    id?: number | null
    actividad_slug?: string | null
    fecha?: string | null
    hora?: string | null
    duracion?: string | null
    titulo?: string | null
    meet_link?: string | null
  } | null
}

const ACTIVIDADES_CATALOGO: Array<{
  slug: ActividadSlugResumen
  etiqueta: string
  tipo: "individual" | "grupal" | "especial"
}> = [
  { slug: "casatalentos", etiqueta: "CasaTalentos", tipo: "grupal" },
  {
    slug: "conectando-sentidos",
    etiqueta: "Conectando Sentidos",
    tipo: "grupal",
  },
  { slug: "mentorias", etiqueta: "Mentorías", tipo: "individual" },
  { slug: "terapia", etiqueta: "Terapia", tipo: "individual" },
  {
    slug: "charla-introductoria",
    etiqueta: "Charla introductoria",
    tipo: "especial",
  },
]

const ACTIVIDADES_ESCUELA = ACTIVIDADES_CATALOGO.filter(
  (item) => item.slug !== "charla-introductoria"
) as Array<{
  slug: Exclude<ActividadSlugResumen, "charla-introductoria">
  etiqueta: string
  tipo: "individual" | "grupal"
}>

function normalizarEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase()
}

function normalizarMonto(value?: string | number | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function modalidadResumen(
  modalidad?: string | null,
  actividadSlug?: string | null
): ModalidadPagoResumen {
  if (modalidad === "becado") {
    return "becado"
  }

  if (modalidad === "invitado") {
    return "invitado"
  }

  if (modalidad === "sin_cobro") {
    return "sin_cobro"
  }

  const normalizada = normalizarModalidadPago(modalidad, actividadSlug)

  if (normalizada === "sesion") {
    return "por_sesion"
  }

  if (normalizada === "proceso") {
    return "por_proceso"
  }

  return "mensual"
}

function medioSugeridoDesdePago(
  medio?: string | null
): "transferencia" | "mercado_pago" | "manual" | null {
  const raw = String(medio || "").trim().toLowerCase()

  if (!raw) return null
  if (raw.includes("mercado")) return "mercado_pago"
  if (raw.includes("transfer")) return "transferencia"
  return "manual"
}

function claveActividadEmail(actividadId: number | string, email: string) {
  return `${actividadId}:${email}`
}

function tituloActividad(slug: ActividadSlugResumen, dbName?: string | null) {
  if (dbName) return dbName
  return (
    ACTIVIDADES_CATALOGO.find((item) => item.slug === slug)?.etiqueta || slug
  )
}

function formatearInicio(fecha?: string | null, hora?: string | null) {
  if (!fecha) return null
  return hora ? `${fecha} ${hora}` : fecha
}

function sumarDuracion(inicio?: string | null, duracion?: string | null) {
  if (!inicio || !duracion) return null
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/.exec(inicio)
  const dur = /^(\d{2}):(\d{2})$/.exec(duracion)
  if (!match || !dur) return null

  const [, fecha, hh, mm] = match
  const minutosInicio = Number(hh) * 60 + Number(mm)
  const minutosDur = Number(dur[1]) * 60 + Number(dur[2])
  const total = minutosInicio + minutosDur
  const horas = String(Math.floor(total / 60) % 24).padStart(2, "0")
  const mins = String(total % 60).padStart(2, "0")
  return `${fecha} ${horas}:${mins}`
}

function severityToState(alertas: AlertaResumen[]): "ok" | "atencion" | "inconsistente" {
  if (alertas.some((item) => item.nivel === "error")) return "inconsistente"
  if (alertas.some((item) => item.nivel === "warning")) return "atencion"
  return "ok"
}

function estadoPagoParaActividad(params: {
  actividadSlug: Exclude<ActividadSlugResumen, "charla-introductoria">
  inscripcionActiva: boolean
  honorario: HonorarioRow | null
  ultimoPago: PagoRow | null
}) {
  const { actividadSlug, inscripcionActiva, honorario, ultimoPago } = params

  if (!inscripcionActiva) {
    return {
      accesoEsperado: false,
      accesoMotivo: "sin_inscripcion" as const,
      estadoVisible: "inconsistente" as const,
      observaciones: ["La actividad figura, pero no tiene inscripción activa."],
    }
  }

  if (!honorario || honorario.activo === false) {
    return {
      accesoEsperado: false,
      accesoMotivo: "sin_honorario" as const,
      estadoVisible: "inconsistente" as const,
      observaciones: ["La inscripción está activa, pero falta honorario activo."],
    }
  }

  const modalidad = normalizarModalidadPago(honorario.modalidad_pago, actividadSlug)
  const modalidadEspecial = modalidadResumen(
    honorario.modalidad_pago,
    actividadSlug
  )

  if (
    modalidadEspecial === "becado" ||
    modalidadEspecial === "invitado" ||
    modalidadEspecial === "sin_cobro"
  ) {
    return {
      accesoEsperado: true,
      accesoMotivo: "ok" as const,
      estadoVisible: "activa" as const,
      observaciones: [
        modalidadEspecial === "becado"
          ? "La actividad está configurada como becada."
          : modalidadEspecial === "invitado"
            ? "La actividad está configurada como invitada."
            : "La actividad está configurada sin cobro.",
      ],
    }
  }

  if (modalidad === "sesion") {
    return {
      accesoEsperado: false,
      accesoMotivo: "no_aplica" as const,
      estadoVisible: "activa" as const,
      observaciones: ["El acceso económico se resuelve sesión por sesión."],
    }
  }

  if (ultimoPago?.estado === "pagado") {
    return {
      accesoEsperado: true,
      accesoMotivo: "ok" as const,
      estadoVisible: "activa" as const,
      observaciones: [] as string[],
    }
  }

  if (
    actividadSlug !== "terapia" &&
    estaDentroDeGraciaMensual(actividadSlug, new Date())
  ) {
    return {
      accesoEsperado: true,
      accesoMotivo: "gracia" as const,
      estadoVisible: "activa" as const,
      observaciones: ["Está dentro del período de gracia del 1 al 10."],
    }
  }

  if (ultimoPago?.estado === "en_revision") {
    return {
      accesoEsperado: false,
      accesoMotivo: "sin_pago" as const,
      estadoVisible: "inconsistente" as const,
      observaciones: ["El último pago está en revisión."],
    }
  }

  if (ultimoPago?.estado === "rechazado") {
    return {
      accesoEsperado: false,
      accesoMotivo: "bloqueado" as const,
      estadoVisible: "inconsistente" as const,
      observaciones: ["El último pago fue rechazado."],
    }
  }

  return {
    accesoEsperado: false,
    accesoMotivo: "sin_pago" as const,
    estadoVisible: "inconsistente" as const,
    observaciones: ["No hay un pago aprobado vigente para esta actividad."],
  }
}

function construirPeriodoPago(
  pago: Pick<PagoRow, "anio" | "mes" | "created_at"> | null
) {
  if (!pago) return null
  if (pago.mes && pago.anio) return `${pago.mes}/${pago.anio}`
  return pago.created_at || null
}

export async function buildAdminPersonSummaries(): Promise<PersonaResumen[]> {
  const supabase = createAdminSupabaseClient()
  const hoy = obtenerFechaISOArgentina()

  const { data: usuariosData, error: usuariosError } = await supabase
    .from("usuarios_plataforma")
    .select(
      "id, nombre, apellido, email, whatsapp, fecha_cumpleanos, notas_documentos, charla_intro_habilitada, role, activo, created_at"
    )
    .order("nombre", { ascending: true })

  if (usuariosError) {
    throw usuariosError
  }

  const usuarios = ((usuariosData as UsuarioRow[] | null) || []).map((item) => ({
    ...item,
    email: normalizarEmail(item.email),
  }))

  const emails = usuarios.map((item) => item.email).filter(Boolean)

  const { data: actividadesData, error: actividadesError } = await supabase
    .from("actividades")
    .select("id, slug, nombre")
    .in("slug", ACTIVIDADES_ESCUELA.map((item) => item.slug))

  if (actividadesError) {
    throw actividadesError
  }

  const actividadesDb = (actividadesData as ActividadDbRow[] | null) || []
  const actividadIdPorSlug = new Map<string, number>()
  const actividadNombrePorSlug = new Map<string, string>()
  const actividadSlugPorId = new Map<number, Exclude<ActividadSlugResumen, "charla-introductoria">>()

  for (const actividad of actividadesDb) {
    const slug = actividad.slug as Exclude<
      ActividadSlugResumen,
      "charla-introductoria"
    >
    actividadIdPorSlug.set(slug, actividad.id)
    actividadNombrePorSlug.set(slug, tituloActividad(slug, actividad.nombre))
    actividadSlugPorId.set(actividad.id, slug)
  }

  const [usuarioActividadesData, inscripcionesData, honorariosData] =
    await Promise.all([
      emails.length > 0
        ? supabase
            .from("usuario_actividades")
            .select("usuario_email, actividad_slug, estado")
            .in("usuario_email", emails)
        : Promise.resolve({ data: [], error: null }),
      emails.length > 0 && actividadSlugPorId.size > 0
        ? supabase
            .from("inscripciones")
            .select("id, actividad_id, participante_email, estado")
            .in("participante_email", emails)
            .in("actividad_id", Array.from(actividadSlugPorId.keys()))
        : Promise.resolve({ data: [], error: null }),
      emails.length > 0 && actividadSlugPorId.size > 0
        ? supabase
            .from("honorarios_participante")
            .select(
              "id, actividad_id, participante_email, honorario_mensual, modalidad_pago, moneda, activo"
            )
            .in("participante_email", emails)
            .in("actividad_id", Array.from(actividadSlugPorId.keys()))
        : Promise.resolve({ data: [], error: null }),
    ])

  if (usuarioActividadesData.error) throw usuarioActividadesData.error
  if (inscripcionesData.error) throw inscripcionesData.error
  if (honorariosData.error) throw honorariosData.error

  const usuarioActividades =
    (usuarioActividadesData.data as UsuarioActividadRow[] | null) || []
  const inscripciones = (inscripcionesData.data as InscripcionRow[] | null) || []
  const honorarios = (honorariosData.data as HonorarioRow[] | null) || []

  const inscripcionIds = inscripciones.map((item) => item.id).filter(Boolean)

  const [pagosData, disponibilidadesIndividualesData, disponibilidadesGrupalesData, reservasData] =
    await Promise.all([
      inscripcionIds.length > 0
        ? supabase
            .from("pagos_mensuales")
            .select(
              "id, actividad_id, inscripcion_id, estado, monto, moneda, medio_pago, anio, mes, created_at"
            )
            .in("inscripcion_id", inscripcionIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      emails.length > 0
        ? supabase
            .from("disponibilidades")
            .select(
              "id, actividad_slug, participante_email, fecha, hora, duracion, titulo, meet_link, modo, estado"
            )
            .in("participante_email", emails)
            .in("actividad_slug", ["mentorias", "terapia"])
            .gte("fecha", hoy)
            .order("fecha", { ascending: true })
            .order("hora", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("disponibilidades")
        .select(
          "id, actividad_slug, participante_email, fecha, hora, duracion, titulo, meet_link, modo, estado"
        )
        .eq("modo", "actividad_fija")
        .in("actividad_slug", ["casatalentos", "conectando-sentidos"])
        .gte("fecha", hoy)
        .order("fecha", { ascending: true })
        .order("hora", { ascending: true }),
      emails.length > 0
        ? supabase
            .from("reservas")
            .select(
              "id, participante_email, estado, disponibilidades(id, actividad_slug, fecha, hora, duracion, titulo, meet_link)"
            )
            .in("participante_email", emails)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ])

  if (pagosData.error) throw pagosData.error
  if (disponibilidadesIndividualesData.error)
    throw disponibilidadesIndividualesData.error
  if (disponibilidadesGrupalesData.error) throw disponibilidadesGrupalesData.error
  if (reservasData.error) throw reservasData.error

  const pagos = (pagosData.data as PagoRow[] | null) || []
  const disponibilidadesIndividuales =
    (disponibilidadesIndividualesData.data as DisponibilidadRow[] | null) || []
  const disponibilidadesGrupales =
    (disponibilidadesGrupalesData.data as DisponibilidadRow[] | null) || []
  const reservas = (reservasData.data as ReservaRow[] | null) || []

  const usuarioActividadesMap = new Map<string, Map<string, UsuarioActividadRow>>()
  for (const row of usuarioActividades) {
    const email = normalizarEmail(row.usuario_email)
    const slug = String(row.actividad_slug || "").trim()
    if (!email || !slug) continue
    if (!usuarioActividadesMap.has(email)) {
      usuarioActividadesMap.set(email, new Map())
    }
    usuarioActividadesMap.get(email)!.set(slug, row)
  }

  const inscripcionesMap = new Map<string, InscripcionRow>()
  for (const row of inscripciones) {
    const email = normalizarEmail(row.participante_email)
    if (!email) continue
    const key = claveActividadEmail(row.actividad_id, email)
    if (!inscripcionesMap.has(key) || row.estado === "activa") {
      inscripcionesMap.set(key, row)
    }
  }

  const honorariosMap = new Map<string, HonorarioRow>()
  for (const row of honorarios) {
    const email = normalizarEmail(row.participante_email)
    if (!email) continue
    const key = claveActividadEmail(row.actividad_id, email)
    honorariosMap.set(key, row)
  }

  const ultimoPagoPorInscripcion = new Map<number, PagoRow>()
  for (const pago of pagos) {
    if (!pago.inscripcion_id || ultimoPagoPorInscripcion.has(pago.inscripcion_id)) {
      continue
    }
    ultimoPagoPorInscripcion.set(pago.inscripcion_id, pago)
  }

  const proximasGrupales = new Map<
    Exclude<ActividadSlugResumen, "charla-introductoria" | "mentorias" | "terapia">,
    DisponibilidadRow | null
  >([
    ["casatalentos", null],
    ["conectando-sentidos", null],
  ])

  for (const item of disponibilidadesGrupales) {
    const slug = item.actividad_slug as
      | "casatalentos"
      | "conectando-sentidos"
      | null
    if (!slug || proximasGrupales.get(slug)) continue
    proximasGrupales.set(slug, item)
  }

  const disponibilidadesIndividualesPorEmail = new Map<string, DisponibilidadRow[]>()
  for (const item of disponibilidadesIndividuales) {
    const email = normalizarEmail(item.participante_email)
    if (!email) continue
    const existentes = disponibilidadesIndividualesPorEmail.get(email) || []
    existentes.push(item)
    disponibilidadesIndividualesPorEmail.set(email, existentes)
  }

  const reservasPorEmail = new Map<string, ReservaRow[]>()
  for (const item of reservas) {
    const email = normalizarEmail(item.participante_email)
    if (!email) continue
    const existentes = reservasPorEmail.get(email) || []
    existentes.push(item)
    reservasPorEmail.set(email, existentes)
  }

  const personas = usuarios.map((usuario) => {
    const email = usuario.email
    const notas = normalizarDocumentosNotas(usuario.notas_documentos)

    const perfil: PerfilResumen = {
      nombre: usuario.nombre,
      apellido: String(usuario.apellido || ""),
      nombreCompleto:
        [usuario.nombre, usuario.apellido].filter(Boolean).join(" ").trim() ||
        email,
      email,
      whatsapp: usuario.whatsapp || null,
      fechaNacimiento: usuario.fecha_cumpleanos || null,
      role: usuario.role,
      activo: usuario.activo,
      charlaIntroHabilitada: usuario.charla_intro_habilitada === true,
      notasDocumentos:
        notas.length > 0
          ? notas.map((item) => `${item.titulo} | ${item.url}`).join("\n")
          : null,
      creadoEn: usuario.created_at || null,
    }

    const actividades: ActividadResumen[] = []
    const economia: EconomiaResumen[] = []
    const agenda: AgendaResumen[] = []
    const alertas: AlertaResumen[] = []

    if (!usuario.activo) {
      alertas.push({
        codigo: "usuario_inactivo",
        nivel: "info",
        titulo: "Usuario inactivo",
        detalle: "Esta persona está inactiva en la plataforma.",
        actividad: null,
      })
    }

    if (usuario.charla_intro_habilitada === true) {
      alertas.push({
        codigo: "charla_intro_habilitada",
        nivel: "info",
        titulo: "Charla introductoria habilitada",
        detalle: "La persona conserva el circuito especial de charla/grabación.",
        actividad: "charla-introductoria",
      })
    }

    actividades.push({
      actividad: "charla-introductoria",
      etiqueta: "Charla introductoria",
      marcadaEnUsuarioActividades: usuario.charla_intro_habilitada === true,
      inscripcionActiva: usuario.charla_intro_habilitada === true,
      accesoEsperado: usuario.charla_intro_habilitada === true,
      accesoMotivo:
        usuario.charla_intro_habilitada === true ? "charla" : "no_aplica",
      estadoVisible:
        usuario.charla_intro_habilitada === true ? "charla" : "inactiva",
      observaciones:
        usuario.charla_intro_habilitada === true
          ? ["Acceso especial por charla introductoria."]
          : [],
    })

    for (const actividad of ACTIVIDADES_ESCUELA) {
      const actividadId = actividadIdPorSlug.get(actividad.slug)
      const marcada =
        usuarioActividadesMap.get(email)?.get(actividad.slug)?.estado === "activa"

      const inscripcion =
        actividadId != null
          ? inscripcionesMap.get(claveActividadEmail(actividadId, email)) || null
          : null

      const inscripcionActiva = inscripcion?.estado === "activa"
      const honorario =
        actividadId != null
          ? honorariosMap.get(claveActividadEmail(actividadId, email)) || null
          : null

      const ultimoPago =
        inscripcion?.id != null
          ? ultimoPagoPorInscripcion.get(inscripcion.id) || null
          : null

      const tieneRelacion = marcada || inscripcionActiva || Boolean(honorario)

      const estadoPago = tieneRelacion
        ? estadoPagoParaActividad({
            actividadSlug: actividad.slug,
            inscripcionActiva,
            honorario,
            ultimoPago,
          })
        : {
            accesoEsperado: false,
            accesoMotivo: "no_aplica" as const,
            estadoVisible: "inactiva" as const,
            observaciones: [] as string[],
          }

      if (marcada && !inscripcionActiva) {
        alertas.push({
          codigo: "actividad_sin_inscripcion",
          nivel: "error",
          titulo: "Actividad marcada sin inscripción",
          detalle: `${actividad.etiqueta} figura habilitada, pero no tiene inscripción activa.`,
          actividad: actividad.slug,
        })
      }

      if (inscripcionActiva && (!honorario || honorario.activo === false)) {
        alertas.push({
          codigo: "inscripcion_sin_honorario",
          nivel: "warning",
          titulo: "Inscripción sin honorario",
          detalle: `${actividad.etiqueta} tiene inscripción activa, pero falta honorario.`,
          actividad: actividad.slug,
        })
      }

      if (
        inscripcionActiva &&
        honorario?.activo !== false &&
        honorario &&
        !estadoPago.accesoEsperado &&
        (estadoPago.accesoMotivo === "sin_pago" ||
          estadoPago.accesoMotivo === "bloqueado")
      ) {
        alertas.push({
          codigo: "honorario_sin_pago",
          nivel: "warning",
          titulo: "Honorario activo sin pago al día",
          detalle: `${actividad.etiqueta} tiene honorario activo, pero no hay pago aprobado vigente.`,
          actividad: actividad.slug,
        })
      }

      actividades.push({
        actividad: actividad.slug,
        etiqueta: actividadNombrePorSlug.get(actividad.slug) || actividad.etiqueta,
        marcadaEnUsuarioActividades: marcada,
        inscripcionActiva,
        accesoEsperado: estadoPago.accesoEsperado,
        accesoMotivo: estadoPago.accesoMotivo,
        estadoVisible:
          !tieneRelacion && !marcada && !inscripcionActiva
            ? "inactiva"
            : marcada || inscripcionActiva || Boolean(honorario)
              ? estadoPago.estadoVisible
              : "sin_configurar",
        observaciones: estadoPago.observaciones,
      })

      if (tieneRelacion) {
        economia.push({
          actividad: actividad.slug,
          etiqueta: actividadNombrePorSlug.get(actividad.slug) || actividad.etiqueta,
          honorarioId: honorario?.id ? String(honorario.id) : null,
          honorarioActivo: honorario?.activo !== false && Boolean(honorario),
          monto: normalizarMonto(honorario?.honorario_mensual),
          moneda: honorario?.moneda || null,
          modalidad: honorario
            ? modalidadResumen(honorario.modalidad_pago, actividad.slug)
            : "desconocida",
          medioSugerido: medioSugeridoDesdePago(ultimoPago?.medio_pago),
          ultimoPago: ultimoPago
            ? {
                id: String(ultimoPago.id),
                periodo: construirPeriodoPago(ultimoPago),
                estado: ultimoPago.estado || null,
                fecha: ultimoPago.created_at || null,
                medio: ultimoPago.medio_pago || null,
              }
            : null,
          pagoPendiente:
            Boolean(honorario) &&
            modalidadResumen(honorario?.modalidad_pago, actividad.slug) !== "becado" &&
            modalidadResumen(honorario?.modalidad_pago, actividad.slug) !== "invitado" &&
            modalidadResumen(honorario?.modalidad_pago, actividad.slug) !== "sin_cobro" &&
            (!ultimoPago || ultimoPago.estado !== "pagado"),
        })
      }

      if (actividad.tipo === "grupal" && (marcada || inscripcionActiva || Boolean(honorario))) {
        const proximo = proximasGrupales.get(
          actividad.slug as "casatalentos" | "conectando-sentidos"
        )

        agenda.push({
          actividad: actividad.slug,
          tipo: "grupal",
          proximoEncuentro: proximo
            ? {
                inicio: formatearInicio(proximo.fecha, proximo.hora),
                fin: sumarDuracion(
                  formatearInicio(proximo.fecha, proximo.hora),
                  proximo.duracion
                ),
                meetLink: proximo.meet_link || null,
                titulo: proximo.titulo || "Encuentro grupal",
              }
            : null,
          ultimoEncuentro: null,
          cantidadPendientes: proximo ? 1 : 0,
          notasDocumento: null,
        })
      }
    }

    const futurasIndividuales = (disponibilidadesIndividualesPorEmail.get(email) || []).filter(
      (item) =>
        item.actividad_slug === "mentorias" || item.actividad_slug === "terapia"
    )
    const reservasUsuario = (reservasPorEmail.get(email) || []).filter((item) => {
      const slug = item.disponibilidades?.actividad_slug
      const fecha = item.disponibilidades?.fecha
      return (
        (slug === "mentorias" || slug === "terapia") &&
        Boolean(fecha) &&
        String(fecha) >= hoy &&
        item.estado !== "cancelada"
      )
    })

    for (const actividad of ["mentorias", "terapia"] as const) {
      const tieneActividad = actividades.some(
        (item) =>
          item.actividad === actividad &&
          (item.marcadaEnUsuarioActividades || item.inscripcionActiva)
      )
      if (!tieneActividad) continue

      const dispActividad = futurasIndividuales
        .filter((item) => item.actividad_slug === actividad)
        .sort((a, b) =>
          String(formatearInicio(a.fecha, a.hora)).localeCompare(
            String(formatearInicio(b.fecha, b.hora))
          )
        )

      const reservasActividad = reservasUsuario
        .filter((item) => item.disponibilidades?.actividad_slug === actividad)
        .sort((a, b) =>
          String(formatearInicio(a.disponibilidades?.fecha, a.disponibilidades?.hora)).localeCompare(
            String(formatearInicio(b.disponibilidades?.fecha, b.disponibilidades?.hora))
          )
        )

      const proximaReserva = reservasActividad[0] || null
      const proximaDisponibilidad = dispActividad[0] || null
      const proximo = proximaReserva
        ? {
            inicio: formatearInicio(
              proximaReserva.disponibilidades?.fecha,
              proximaReserva.disponibilidades?.hora
            ),
            fin: sumarDuracion(
              formatearInicio(
                proximaReserva.disponibilidades?.fecha,
                proximaReserva.disponibilidades?.hora
              ),
              proximaReserva.disponibilidades?.duracion
            ),
            meetLink: proximaReserva.disponibilidades?.meet_link || null,
            titulo: proximaReserva.disponibilidades?.titulo || "Encuentro",
          }
        : proximaDisponibilidad
          ? {
              inicio: formatearInicio(
                proximaDisponibilidad.fecha,
                proximaDisponibilidad.hora
              ),
              fin: sumarDuracion(
                formatearInicio(
                  proximaDisponibilidad.fecha,
                  proximaDisponibilidad.hora
                ),
                proximaDisponibilidad.duracion
              ),
              meetLink: proximaDisponibilidad.meet_link || null,
              titulo: proximaDisponibilidad.titulo || "Encuentro",
            }
          : null

      agenda.push({
        actividad,
        tipo: "individual",
        proximoEncuentro: proximo,
        ultimoEncuentro: null,
        cantidadPendientes: dispActividad.length + reservasActividad.length,
        notasDocumento: notas.length > 0 ? notas[0]?.url || null : null,
      })

      if (!proximo) {
        alertas.push({
          codigo:
            actividad === "mentorias"
              ? "mentoria_sin_proximo_encuentro"
              : "terapia_sin_proximo_encuentro",
          nivel: "info",
          titulo: "Sin próximo encuentro",
          detalle: `${tituloActividad(actividad)} está activa, pero no tiene un próximo encuentro visible.`,
          actividad,
        })
      }
    }

    const actividadesActivas = actividades.filter(
      (item) =>
        item.actividad !== "charla-introductoria" &&
        (item.marcadaEnUsuarioActividades ||
          item.inscripcionActiva ||
          item.estadoVisible === "activa")
    ).length

    if (
      usuario.activo &&
      !usuario.charla_intro_habilitada &&
      actividadesActivas === 0
    ) {
      alertas.push({
        codigo: "sin_actividad",
        nivel: "info",
        titulo: "Sin actividad asignada",
        detalle: "La persona está activa en la plataforma, pero no tiene actividades asignadas.",
        actividad: null,
      })
    }

    const proximoEncuentro = agenda
      .map((item) => item.proximoEncuentro?.inicio)
      .filter(Boolean)
      .sort()[0] || null

    return {
      id: usuario.id,
      email,
      perfil,
      actividades,
      economia,
      agenda,
      alertas,
      resumen: {
        actividadesActivas,
        pagosPendientes: economia.filter((item) => item.pagoPendiente).length,
        proximoEncuentro,
        tieneCharlaIntro: usuario.charla_intro_habilitada === true,
        estadoGeneral: severityToState(alertas),
      },
    } satisfies PersonaResumen
  })

  return personas.sort((a, b) =>
    a.perfil.nombreCompleto.localeCompare(b.perfil.nombreCompleto)
  )
}
