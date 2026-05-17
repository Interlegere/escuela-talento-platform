import {
  getActivityAdminPermission,
  hasPermission,
  type ActivitySlug,
  type Actor,
} from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export type HDRActividadSlug = Extract<
  ActivitySlug,
  "casatalentos" | "conectando-sentidos" | "mentorias" | "terapia"
>

export type HDRParticipante = {
  email: string
  nombre: string
}

export type HDRCoordenadaRow = {
  id: string
  actividad_slug: HDRActividadSlug
  titulo: string
  descripcion?: string | null
  descripcion_html?: string | null
  orden: number
  activo: boolean
  alcance: "global" | "individual"
  participante_email?: string | null
  created_by_email?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type HDRRespuestaRow = {
  id: string
  coordenada_id: string
  participante_email: string
  respuesta?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type HDRNotaPersonalRow = {
  id: string
  actividad_slug: HDRActividadSlug
  participante_email: string
  contenido?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type HDRAporteRow = {
  id: string
  coordenada_id: string
  participante_email: string
  autor_email: string
  autor_nombre?: string | null
  contenido: string
  activo: boolean
  created_at?: string | null
  updated_at?: string | null
}

type UsuarioActividadRow = {
  usuario_email?: string | null
  usuarios_plataforma?: {
    nombre?: string | null
    apellido?: string | null
    email?: string | null
    activo?: boolean | null
  } | null
}

type InscripcionRow = {
  participante_email?: string | null
  participante_nombre?: string | null
}

type CoordenadaConDetalle = {
  id: string
  titulo: string
  descripcion: string
  descripcionHtml: string
  orden: number
  activo: boolean
  alcance: "global" | "individual"
  participanteEmail: string | null
  participanteNombre: string | null
  respuestas: Array<{
    id: string
    participanteEmail: string
    participanteNombre: string
    respuesta: string
    updatedAt: string | null
    createdAt: string | null
  }>
  aportes: Array<{
    id: string
    participanteEmail: string
    participanteNombre: string
    autorEmail: string
    autorNombre: string
    contenido: string
    createdAt: string | null
    updatedAt: string | null
    activo: boolean
  }>
}

export type HDRActividadPayload = {
  ok: true
  actividadSlug: HDRActividadSlug
  esAdmin: boolean
  actorEmail: string
  participantes: HDRParticipante[]
  coordenadas: CoordenadaConDetalle[]
  notasPersonalesGenerales: Array<{
    id: string
    participanteEmail: string
    participanteNombre: string
    contenido: string
    updatedAt: string | null
    createdAt: string | null
  }>
}

export type CrearCoordenadaInput = {
  actividadSlug: HDRActividadSlug
  titulo: string
  descripcion?: string
  descripcionHtml?: string
  orden?: number
  activo?: boolean
  alcance: "global" | "individual"
  participanteEmail?: string | null
}

export type ActualizarCoordenadaInput = {
  id: string
  actividadSlug: HDRActividadSlug
  titulo: string
  descripcion?: string
  descripcionHtml?: string
  orden?: number
  activo?: boolean
}

export type GuardarRespuestaInput = {
  actividadSlug: HDRActividadSlug
  coordenadaId: string
  respuesta?: string
  participanteEmail?: string
}

export type CrearAporteInput = {
  actividadSlug: HDRActividadSlug
  coordenadaId: string
  participanteEmail: string
  contenido: string
}

export type GuardarNotaPersonalGeneralInput = {
  actividadSlug: HDRActividadSlug
  contenido?: string
  participanteEmail?: string
}

const ACTIVIDADES_HDR: Record<HDRActividadSlug, string> = {
  casatalentos: "CasaTalentos",
  "conectando-sentidos": "Conectando Sentidos",
  mentorias: "Mentorías",
  terapia: "Terapia",
}

function normalizarEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase()
}

function nombreDesdePartes(nombre?: string | null, apellido?: string | null, email?: string | null) {
  return [nombre, apellido].filter(Boolean).join(" ").trim() || normalizarEmail(email)
}

export function esHDRActividadSlug(valor: string): valor is HDRActividadSlug {
  return valor in ACTIVIDADES_HDR
}

export function nombreHDRActividad(actividadSlug: HDRActividadSlug) {
  return ACTIVIDADES_HDR[actividadSlug]
}

export function esAdminHDR(actor: Actor, actividadSlug: HDRActividadSlug) {
  const permisoAdmin = getActivityAdminPermission(actividadSlug)
  return permisoAdmin ? hasPermission(actor, permisoAdmin) : false
}

export async function listarParticipantesHDR(
  actividadSlug: HDRActividadSlug
): Promise<HDRParticipante[]> {
  const supabase = createAdminSupabaseClient()
  const mapa = new Map<string, HDRParticipante>()

  const { data: usuarioActividades, error: usuarioActividadesError } = await supabase
    .from("usuario_actividades")
    .select(
      `
      usuario_email,
      usuarios_plataforma:usuario_id (
        nombre,
        apellido,
        email,
        activo
      )
    `
    )
    .eq("actividad_slug", actividadSlug)
    .eq("estado", "activa")
    .order("usuario_email", { ascending: true })

  if (usuarioActividadesError) {
    throw usuarioActividadesError
  }

  for (const item of (usuarioActividades || []) as UsuarioActividadRow[]) {
    const usuario = item.usuarios_plataforma
    if (usuario?.activo === false) continue
    const email = normalizarEmail(usuario?.email || item.usuario_email)
    if (!email) continue

    mapa.set(email, {
      email,
      nombre: nombreDesdePartes(usuario?.nombre, usuario?.apellido, email),
    })
  }

  const { data: inscripciones, error: inscripcionesError } = await supabase
    .from("inscripciones")
    .select("participante_email, participante_nombre, actividades!inner(slug)")
    .eq("actividades.slug", actividadSlug)
    .eq("estado", "activa")

  if (inscripcionesError) {
    throw inscripcionesError
  }

  for (const item of (inscripciones || []) as InscripcionRow[]) {
    const email = normalizarEmail(item.participante_email)
    if (!email || mapa.has(email)) continue
    mapa.set(email, {
      email,
      nombre: String(item.participante_nombre || "").trim() || email,
    })
  }

  return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export async function cargarHDRActividad(
  actividadSlug: HDRActividadSlug,
  actor: Actor
): Promise<HDRActividadPayload> {
  const supabase = createAdminSupabaseClient()
  const actorEmail = normalizarEmail(actor.email)
  const esAdmin = esAdminHDR(actor, actividadSlug)

  const participantes = await listarParticipantesHDR(actividadSlug)
  const participantesPorEmail = new Map(
    participantes.map((participante) => [participante.email, participante.nombre])
  )

  const { data: coordenadasData, error: coordenadasError } = await supabase
    .from("hdr_coordenadas")
    .select("*")
    .eq("actividad_slug", actividadSlug)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true })

  if (coordenadasError) {
    throw coordenadasError
  }

  let coordenadas = (coordenadasData || []) as HDRCoordenadaRow[]

  if (!esAdmin) {
    coordenadas = coordenadas.filter((coordenada) => {
      if (!coordenada.activo) return false
      if (coordenada.alcance === "global") return true
      return normalizarEmail(coordenada.participante_email) === actorEmail
    })
  }

  const coordenadaIds = coordenadas.map((coordenada) => coordenada.id)

  let respuestas: HDRRespuestaRow[] = []
  let aportes: HDRAporteRow[] = []
  let notasPersonalesGenerales: HDRNotaPersonalRow[] = []

  if (coordenadaIds.length > 0) {
    const { data: respuestasData, error: respuestasError } = await supabase
      .from("hdr_respuestas")
      .select("*")
      .in("coordenada_id", coordenadaIds)

    if (respuestasError) {
      throw respuestasError
    }

    respuestas = (respuestasData || []) as HDRRespuestaRow[]

    if (!esAdmin) {
      respuestas = respuestas.filter(
        (respuesta) => normalizarEmail(respuesta.participante_email) === actorEmail
      )
    }

    const { data: aportesData, error: aportesError } = await supabase
      .from("hdr_aportes")
      .select("*")
      .in("coordenada_id", coordenadaIds)
      .order("created_at", { ascending: true })

    if (aportesError) {
      throw aportesError
    }

    aportes = ((aportesData || []) as HDRAporteRow[]).filter(
      (aporte) => aporte.activo !== false
    )

    if (!esAdmin) {
      aportes = aportes.filter(
        (aporte) => normalizarEmail(aporte.participante_email) === actorEmail
      )
    }
  }

  const { data: notasData, error: notasError } = await supabase
    .from("hdr_notas_personales")
    .select("*")
    .eq("actividad_slug", actividadSlug)

  if (notasError) {
    throw notasError
  }

  notasPersonalesGenerales = (notasData || []) as HDRNotaPersonalRow[]

  if (!esAdmin) {
    notasPersonalesGenerales = notasPersonalesGenerales.filter(
      (nota) => normalizarEmail(nota.participante_email) === actorEmail
    )
  }

  const respuestasPorCoordenada = new Map<string, CoordenadaConDetalle["respuestas"]>()
  for (const respuesta of respuestas) {
    const lista = respuestasPorCoordenada.get(respuesta.coordenada_id) || []
    const participanteEmail = normalizarEmail(respuesta.participante_email)
    lista.push({
      id: respuesta.id,
      participanteEmail,
      participanteNombre:
        participantesPorEmail.get(participanteEmail) || participanteEmail,
      respuesta: String(respuesta.respuesta || ""),
      updatedAt: respuesta.updated_at || null,
      createdAt: respuesta.created_at || null,
    })
    respuestasPorCoordenada.set(respuesta.coordenada_id, lista)
  }

  const aportesPorCoordenada = new Map<string, CoordenadaConDetalle["aportes"]>()
  for (const aporte of aportes) {
    const lista = aportesPorCoordenada.get(aporte.coordenada_id) || []
    const participanteEmail = normalizarEmail(aporte.participante_email)
    lista.push({
      id: aporte.id,
      participanteEmail,
      participanteNombre:
        participantesPorEmail.get(participanteEmail) || participanteEmail,
      autorEmail: normalizarEmail(aporte.autor_email),
      autorNombre: String(aporte.autor_nombre || aporte.autor_email || "").trim(),
      contenido: aporte.contenido,
      createdAt: aporte.created_at || null,
      updatedAt: aporte.updated_at || null,
      activo: aporte.activo,
    })
    aportesPorCoordenada.set(aporte.coordenada_id, lista)
  }

  return {
    ok: true,
    actividadSlug,
    esAdmin,
    actorEmail,
    participantes,
    coordenadas: coordenadas.map((coordenada) => {
      const participanteEmail = normalizarEmail(coordenada.participante_email)
      return {
        id: coordenada.id,
        titulo: coordenada.titulo,
        descripcion: String(coordenada.descripcion || ""),
        descripcionHtml: String(
          coordenada.descripcion_html || coordenada.descripcion || ""
        ),
        orden: coordenada.orden || 0,
        activo: coordenada.activo,
        alcance: coordenada.alcance,
        participanteEmail: participanteEmail || null,
        participanteNombre:
          participanteEmail
            ? participantesPorEmail.get(participanteEmail) || participanteEmail
            : null,
        respuestas: respuestasPorCoordenada.get(coordenada.id) || [],
        aportes: aportesPorCoordenada.get(coordenada.id) || [],
      }
    }),
    notasPersonalesGenerales: notasPersonalesGenerales.map((nota) => {
      const participanteEmail = normalizarEmail(nota.participante_email)
      return {
        id: nota.id,
        participanteEmail,
        participanteNombre:
          participantesPorEmail.get(participanteEmail) || participanteEmail,
        contenido: String(nota.contenido || ""),
        updatedAt: nota.updated_at || null,
        createdAt: nota.created_at || null,
      }
    }),
  }
}

export async function crearCoordenadaHDR(
  actor: Actor,
  input: CrearCoordenadaInput
) {
  const supabase = createAdminSupabaseClient()
  const participanteEmail =
    input.alcance === "individual" ? normalizarEmail(input.participanteEmail) : null

  const { data, error } = await supabase
    .from("hdr_coordenadas")
    .insert({
      actividad_slug: input.actividadSlug,
      titulo: input.titulo.trim(),
      descripcion: String(input.descripcion || "").trim() || null,
      descripcion_html: String(input.descripcionHtml || "").trim() || null,
      orden: Number.isFinite(input.orden) ? Number(input.orden) : 0,
      activo: input.activo !== false,
      alcance: input.alcance,
      participante_email: participanteEmail,
      created_by_email: normalizarEmail(actor.email),
    })
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data as HDRCoordenadaRow
}

export async function actualizarCoordenadaHDR(input: ActualizarCoordenadaInput) {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from("hdr_coordenadas")
    .update({
      titulo: input.titulo.trim(),
      descripcion: String(input.descripcion || "").trim() || null,
      descripcion_html: String(input.descripcionHtml || "").trim() || null,
      orden: Number.isFinite(input.orden) ? Number(input.orden) : 0,
      activo: input.activo !== false,
    })
    .eq("id", input.id)
    .eq("actividad_slug", input.actividadSlug)
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data as HDRCoordenadaRow
}

export async function obtenerCoordenadaHDR(
  actividadSlug: HDRActividadSlug,
  coordenadaId: string
) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from("hdr_coordenadas")
    .select("*")
    .eq("id", coordenadaId)
    .eq("actividad_slug", actividadSlug)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as HDRCoordenadaRow | null) || null
}

export async function guardarRespuestaHDR(
  actor: Actor,
  input: GuardarRespuestaInput
) {
  const supabase = createAdminSupabaseClient()
  const actorEmail = normalizarEmail(actor.email)
  const participanteEmail = normalizarEmail(input.participanteEmail || actor.email)
  const coordenada = await obtenerCoordenadaHDR(input.actividadSlug, input.coordenadaId)
  const esAdmin = esAdminHDR(actor, input.actividadSlug)

  if (!coordenada) {
    throw new Error("Coordenada no encontrada.")
  }

  if (
    coordenada.alcance === "individual" &&
    normalizarEmail(coordenada.participante_email) !== participanteEmail
  ) {
    throw new Error("No podés responder una coordenada individual de otra persona.")
  }

  if (!esAdmin && participanteEmail !== actorEmail) {
    throw new Error("No podés editar la respuesta de otra persona.")
  }

  const payload = {
    coordenada_id: input.coordenadaId,
    participante_email: participanteEmail,
    respuesta: String(input.respuesta || "").trim() || null,
  }

  const { data, error } = await supabase
    .from("hdr_respuestas")
    .upsert(payload, {
      onConflict: "coordenada_id,participante_email",
    })
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data as HDRRespuestaRow
}

export async function guardarNotaPersonalGeneralHDR(
  actor: Actor,
  input: GuardarNotaPersonalGeneralInput
) {
  const supabase = createAdminSupabaseClient()
  const actorEmail = normalizarEmail(actor.email)
  const participanteEmail = normalizarEmail(input.participanteEmail || actor.email)
  const esAdmin = esAdminHDR(actor, input.actividadSlug)

  if (!esAdmin && participanteEmail !== actorEmail) {
    throw new Error("No podés editar las notas personales de otra persona.")
  }

  const { data, error } = await supabase
    .from("hdr_notas_personales")
    .upsert(
      {
        actividad_slug: input.actividadSlug,
        participante_email: participanteEmail,
        contenido: String(input.contenido || "").trim() || null,
      },
      {
        onConflict: "actividad_slug,participante_email",
      }
    )
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data as HDRNotaPersonalRow
}

export async function crearAporteHDR(actor: Actor, input: CrearAporteInput) {
  const supabase = createAdminSupabaseClient()
  const participanteEmail = normalizarEmail(input.participanteEmail)
  const coordenada = await obtenerCoordenadaHDR(input.actividadSlug, input.coordenadaId)

  if (!coordenada) {
    throw new Error("Coordenada no encontrada.")
  }

  if (
    coordenada.alcance === "individual" &&
    normalizarEmail(coordenada.participante_email) !== participanteEmail
  ) {
    throw new Error(
      "La coordenada individual no corresponde al participante indicado."
    )
  }

  const { data, error } = await supabase
    .from("hdr_aportes")
    .insert({
      coordenada_id: input.coordenadaId,
      participante_email: participanteEmail,
      autor_email: normalizarEmail(actor.email),
      autor_nombre: actor.name || actor.email,
      contenido: input.contenido.trim(),
      activo: true,
    })
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data as HDRAporteRow
}
