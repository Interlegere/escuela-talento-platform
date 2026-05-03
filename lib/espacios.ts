import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
  requireAuthenticatedActor,
  type ActivitySlug,
  type Actor,
} from "@/lib/authz"
import { estaDentroDeGraciaMensual } from "@/lib/activity-rules"
import { asegurarActividadBase } from "@/lib/core-activities"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { normalizarModalidadPago, type BillingMode } from "@/lib/billing"

export type EspacioActividadSlug = Extract<ActivitySlug, "mentorias" | "terapia">

export type EspacioRow = {
  id: number
  actividad_slug: EspacioActividadSlug
  participante_email: string
  participante_nombre?: string | null
  admin_email?: string | null
  estado?: string | null
}

export type EspacioMensajeRow = {
  id: number
  espacio_id: number
  parent_id?: number | null
  asunto?: string | null
  autor_email: string
  autor_nombre: string
  autor_rol: string
  contenido_texto?: string | null
  contenido_html?: string | null
  created_at?: string | null
}

export type EspacioRecursoRow = {
  id: number
  espacio_id: number
  titulo: string
  descripcion?: string | null
  recurso_tipo: string
  url: string
  visible: boolean
  created_at?: string | null
}

export type EspacioAccesoExtraRow = {
  id: number
  espacio_id: number
  actividad_destino_slug: "casatalentos" | "conectando-sentidos"
  habilitado: boolean
  nota?: string | null
}

export type ParticipanteActividad = {
  email: string
  nombre: string
}

export type EstadoPagoEspacio = {
  habilitado: boolean
  modalidad: BillingMode
  motivo:
    | "pagado"
    | "sin_inscripcion"
    | "sin_pago"
    | "pendiente"
    | "rechazado"
    | "sin_actividad"
    | "sesion"
    | "gracia"
}

type EspacioContext =
  | {
      actor: Actor
      esAdmin: boolean
      participanteEmail: string
      participanteNombre: string
      espacio: EspacioRow
    }
  | {
      actor: Actor
      esAdmin: boolean
      participanteEmail: string
      participanteNombre: string
      espacio: null
    }

function esTablaFaltante(detalle: unknown) {
  const texto = String(detalle || "").toLowerCase()
  return (
    texto.includes("relation") ||
    texto.includes("does not exist") ||
    texto.includes("could not find the table") ||
    texto.includes("espacios_")
  )
}

export function esErrorConfiguracionEspacios(detalle: unknown) {
  return esTablaFaltante(detalle)
}

export function esActividadEspacio(
  actividadSlug: string
): actividadSlug is EspacioActividadSlug {
  return actividadSlug === "mentorias" || actividadSlug === "terapia"
}

export async function listarParticipantesActividad(
  actividadSlug: EspacioActividadSlug
) {
  const supabase = createAdminSupabaseClient()

  const { data: inscripciones, error: inscripcionesError } = await supabase
    .from("inscripciones")
    .select("participante_email, participante_nombre, actividades!inner(slug)")
    .eq("actividades.slug", actividadSlug)
    .eq("estado", "activa")

  if (inscripcionesError) {
    throw inscripcionesError
  }

  const { data: espacios, error: espaciosError } = await supabase
    .from("espacios_acompanamiento")
    .select("participante_email, participante_nombre")
    .eq("actividad_slug", actividadSlug)

  if (espaciosError && !esTablaFaltante(espaciosError.message)) {
    throw espaciosError
  }

  const mapa = new Map<string, ParticipanteActividad>()

  for (const item of inscripciones || []) {
    const email = item.participante_email?.trim().toLowerCase()
    if (!email) continue

    mapa.set(email, {
      email,
      nombre: item.participante_nombre?.trim() || email,
    })
  }

  for (const item of espacios || []) {
    const email = item.participante_email?.trim().toLowerCase()
    if (!email || mapa.has(email)) continue

    mapa.set(email, {
      email,
      nombre: item.participante_nombre?.trim() || email,
    })
  }

  return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export async function obtenerEstadoPagoActividadActual(
  actividadSlug: EspacioActividadSlug,
  participanteEmail: string
): Promise<EstadoPagoEspacio> {
  const supabase = createAdminSupabaseClient()

  const actividad = await asegurarActividadBase(actividadSlug)

  if (!actividad?.id) {
    return {
      habilitado: false,
      modalidad: normalizarModalidadPago(undefined, actividadSlug),
      motivo: "sin_actividad",
    }
  }

  const email = participanteEmail.trim().toLowerCase()

  const { data: inscripcion } = await supabase
    .from("inscripciones")
    .select("id")
    .eq("actividad_id", actividad.id)
    .eq("participante_email", email)
    .eq("estado", "activa")
    .maybeSingle()

  if (!inscripcion?.id) {
    return {
      habilitado: false,
      modalidad: normalizarModalidadPago(undefined, actividadSlug),
      motivo: "sin_inscripcion",
    }
  }

  const { data: honorario } = await supabase
    .from("honorarios_participante")
    .select("modalidad_pago")
    .eq("actividad_id", actividad.id)
    .eq("participante_email", email)
    .eq("activo", true)
    .maybeSingle()

  const modalidad = normalizarModalidadPago(
    honorario?.modalidad_pago,
    actividadSlug
  )

  if (modalidad === "sesion") {
    return {
      habilitado: false,
      modalidad,
      motivo: "sesion",
    }
  }

  let pago = null

  if (modalidad === "proceso") {
    const resultado = await supabase
      .from("pagos_mensuales")
      .select("estado")
      .eq("inscripcion_id", inscripcion.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    pago = resultado.data
  } else {
    const ahora = new Date()
    const anio = ahora.getFullYear()
    const mes = ahora.getMonth() + 1

    const resultado = await supabase
      .from("pagos_mensuales")
      .select("estado")
      .eq("inscripcion_id", inscripcion.id)
      .eq("anio", anio)
      .eq("mes", mes)
      .maybeSingle()

    pago = resultado.data
  }

  if (!pago?.estado) {
    if (estaDentroDeGraciaMensual(actividadSlug, new Date())) {
      return {
        habilitado: true,
        modalidad,
        motivo: "gracia",
      }
    }

    return {
      habilitado: false,
      modalidad,
      motivo: "sin_pago",
    }
  }

  if (pago.estado === "pagado") {
    return {
      habilitado: true,
      modalidad,
      motivo: "pagado",
    }
  }

  if (pago.estado === "rechazado") {
    return {
      habilitado: false,
      modalidad,
      motivo: "rechazado",
    }
  }

  if (estaDentroDeGraciaMensual(actividadSlug, new Date())) {
    return {
      habilitado: true,
      modalidad,
      motivo: "gracia",
    }
  }

  return {
    habilitado: false,
    modalidad,
    motivo: "pendiente",
  }
}

async function obtenerNombreParticipante(
  actividadSlug: EspacioActividadSlug,
  participanteEmail: string
) {
  const supabase = createAdminSupabaseClient()

  const { data: inscripcion } = await supabase
    .from("inscripciones")
    .select("participante_nombre, actividades!inner(slug)")
    .eq("actividades.slug", actividadSlug)
    .eq("participante_email", participanteEmail)
    .maybeSingle()

  if (inscripcion?.participante_nombre?.trim()) {
    return inscripcion.participante_nombre.trim()
  }

  return participanteEmail
}

export async function resolverContextoEspacio(params: {
  actividadSlug: string
  participanteEmail?: string
  crearSiNoExiste?: boolean
}): Promise<EspacioContext | { response: Response }> {
  const { actividadSlug, participanteEmail, crearSiNoExiste = true } = params

  if (!esActividadEspacio(actividadSlug)) {
    return {
      response: new Response(
        JSON.stringify({ error: "Actividad inválida para este espacio." }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      ),
    }
  }

  const auth = await requireAuthenticatedActor()

  if ("response" in auth) {
    return { response: auth.response as Response }
  }

  const adminPermission = getActivityAdminPermission(actividadSlug)
  const esAdmin = adminPermission
    ? hasPermission(auth.actor, adminPermission)
    : false

  if (!esAdmin) {
    const access = await requireActivityAccess(actividadSlug)

    if ("response" in access) {
      return { response: access.response as Response }
    }
  }

  const participantesDisponibles = esAdmin
    ? (await listarParticipantesActividad(actividadSlug)).filter(
        (item) => item.email !== auth.actor.email
      )
    : []

  const participanteInicialAdmin =
    esAdmin && !participanteEmail?.trim()
      ? participantesDisponibles[0]?.email || null
      : null

  if (esAdmin && !participanteEmail?.trim() && !participanteInicialAdmin) {
    return {
      response: new Response(
        JSON.stringify({
          error:
            "Todavía no hay participantes disponibles para este espacio. Ingresá primero con la cuenta participante o seleccioná un participante válido.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      ),
    }
  }

  const emailNormalizado = esAdmin
    ? (
        participanteEmail?.trim().toLowerCase() ||
        participanteInicialAdmin ||
        ""
      )
    : auth.actor.email

  if (esAdmin && !emailNormalizado) {
    return {
      response: new Response(
        JSON.stringify({ error: "Necesitás seleccionar un participante." }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      ),
    }
  }

  const participanteSeleccionado =
    participantesDisponibles.find((item) => item.email === emailNormalizado) || null

  const participanteNombre = esAdmin
    ? participanteSeleccionado?.nombre ||
      (await obtenerNombreParticipante(actividadSlug, emailNormalizado))
    : auth.actor.name

  const supabase = createAdminSupabaseClient()
  const { data: existente, error: buscarError } = await supabase
    .from("espacios_acompanamiento")
    .select("*")
    .eq("actividad_slug", actividadSlug)
    .eq("participante_email", emailNormalizado)
    .maybeSingle()

  if (buscarError && !esTablaFaltante(buscarError.message)) {
    throw buscarError
  }

  if (existente) {
    return {
      actor: auth.actor,
      esAdmin,
      participanteEmail: emailNormalizado,
      participanteNombre,
      espacio: existente as EspacioRow,
    }
  }

  if (!crearSiNoExiste) {
    return {
      actor: auth.actor,
      esAdmin,
      participanteEmail: emailNormalizado,
      participanteNombre,
      espacio: null,
    }
  }

  const { data: creado, error: crearError } = await supabase
    .from("espacios_acompanamiento")
    .insert({
      actividad_slug: actividadSlug,
      participante_email: emailNormalizado,
      participante_nombre: participanteNombre,
      admin_email: esAdmin ? auth.actor.email : null,
    })
    .select("*")
    .single()

  if (crearError) {
    throw crearError
  }

  return {
    actor: auth.actor,
    esAdmin,
    participanteEmail: emailNormalizado,
    participanteNombre,
    espacio: creado as EspacioRow,
  }
}
