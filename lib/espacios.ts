import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
  requireAuthenticatedActor,
  type ActivitySlug,
  type Actor,
} from "@/lib/authz"
import { asegurarActividadBase } from "@/lib/core-activities"
import { obtenerEconomiaActividadActual } from "@/lib/economy-engine"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { type BillingMode } from "@/lib/billing"

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

  const inscripcionesActivas = (inscripciones || []) as Array<{
    participante_email?: string | null
    participante_nombre?: string | null
  }>
  const emails = Array.from(
    new Set(
      inscripcionesActivas
        .map((item) => item.participante_email?.trim().toLowerCase() || "")
        .filter(Boolean)
    )
  )

  if (emails.length === 0) {
    return []
  }

  const { data: usuarios, error: usuariosError } = await supabase
    .from("usuarios_plataforma")
    .select("nombre, apellido, email, activo")
    .in("email", emails)
    .eq("activo", true)

  if (usuariosError) {
    throw usuariosError
  }

  const usuariosPorEmail = new Map<
    string,
    {
      nombre?: string | null
      apellido?: string | null
      email?: string | null
      activo?: boolean | null
    }
  >()

  for (const usuario of usuarios || []) {
    const email = usuario.email?.trim().toLowerCase()
    if (!email) continue
    usuariosPorEmail.set(email, usuario)
  }

  const mapa = new Map<string, ParticipanteActividad>()

  for (const item of inscripcionesActivas) {
    const email = item.participante_email?.trim().toLowerCase()
    if (!email) continue

    const usuario = usuariosPorEmail.get(email)
    if (!usuario) continue

    const nombreUsuario = [usuario?.nombre, usuario?.apellido]
      .filter(Boolean)
      .join(" ")
      .trim()

    mapa.set(email, {
      email,
      nombre: nombreUsuario || item.participante_nombre?.trim() || email,
    })
  }

  return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export async function obtenerEstadoPagoActividadActual(
  actividadSlug: EspacioActividadSlug,
  participanteEmail: string
): Promise<EstadoPagoEspacio> {
  const actividad = await asegurarActividadBase(actividadSlug)

  if (!actividad?.id) {
    return {
      habilitado: false,
      modalidad: actividadSlug === "terapia" ? "proceso" : "mensual",
      motivo: "sin_actividad",
    }
  }

  const economia = await obtenerEconomiaActividadActual(
    actividadSlug,
    participanteEmail
  )

  const modalidad: BillingMode =
    economia.modalidad === "sesion"
      ? "sesion"
      : economia.modalidad === "proceso"
        ? "proceso"
        : "mensual"

  if (economia.estado === "no_aplica") {
    return {
      habilitado: false,
      modalidad,
      motivo: "sin_inscripcion",
    }
  }

  if (economia.modalidad === "sesion") {
    return {
      habilitado: false,
      modalidad: "sesion",
      motivo: "sesion",
    }
  }

  if (economia.estado === "al_dia" || economia.estado === "bonificado" || economia.estado === "sin_cobro") {
    return {
      habilitado: true,
      modalidad,
      motivo: "pagado",
    }
  }

  if (economia.estado === "gracia") {
    return {
      habilitado: true,
      modalidad,
      motivo: "gracia",
    }
  }

  if (economia.estado === "rechazado") {
    return {
      habilitado: false,
      modalidad,
      motivo: "rechazado",
    }
  }

  if (economia.estado === "en_revision") {
    return {
      habilitado: false,
      modalidad,
      motivo: "pendiente",
    }
  }

  return {
    habilitado: false,
    modalidad,
    motivo: "sin_pago",
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
