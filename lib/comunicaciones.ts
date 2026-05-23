import { enviarEmail } from "@/lib/mailing"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export type VariablesComunicacion = {
  nombre?: string | null
  apellido?: string | null
  nombre_completo?: string | null
  email?: string | null
  link_login?: string | null
  clave_acceso?: string | null
  actividad?: string | null
}

export type EnviarComunicacionIndividualParams = {
  destinatarioEmail: string
  destinatarioNombre?: string | null
  asunto: string
  html?: string | null
  texto?: string | null
  tipo?: string | null
  actividadSlug?: string | null
  plantillaClave?: string | null
  variables?: VariablesComunicacion
  metadata?: Record<string, unknown>
}

export type SegmentoComunicacion =
  | "todos_activos"
  | "casatalentos_activos"
  | "conectando_sentidos_activos"
  | "mentorias_activos"
  | "terapia_activos"
  | "pagos_pendientes"
  | "pagos_al_dia"
  | "equipo_interno"

export type DestinatarioComunicacion = {
  email: string
  nombre: string
  apellido: string
  nombreCompleto: string
  role: string
  actividadSlug: string | null
  razon: string
}

type PlantillaRow = {
  id: number
  clave: string
  nombre: string
  tipo: string
  asunto: string
  html?: string | null
  texto?: string | null
  activo?: boolean | null
}

type UsuarioRow = {
  id?: number | string | null
  nombre?: string | null
  apellido?: string | null
  email?: string | null
  role?: string | null
  activo?: boolean | null
}

type ActividadRow = {
  id: number
  slug?: string | null
  nombre?: string | null
}

type InscripcionRow = {
  participante_email?: string | null
  actividad_id?: number | null
  estado?: string | null
}

const ACTIVIDAD_SEGMENTO: Partial<Record<SegmentoComunicacion, string>> = {
  casatalentos_activos: "casatalentos",
  conectando_sentidos_activos: "conectando-sentidos",
  mentorias_activos: "mentorias",
  terapia_activos: "terapia",
}

const SEGMENTOS_PROXIMAMENTE = new Set<SegmentoComunicacion>([
  "pagos_pendientes",
  "pagos_al_dia",
])

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "")
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function textoAHtml(texto: string) {
  return escapeHtml(texto)
    .split("\n")
    .map((linea) => `<p style="margin:0 0 12px;">${linea || "&nbsp;"}</p>`)
    .join("")
}

function normalizarEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase()
}

function nombreCompletoUsuario(usuario: UsuarioRow) {
  const nombre = String(usuario.nombre || "").trim()
  const apellido = String(usuario.apellido || "").trim()
  return [nombre, apellido].filter(Boolean).join(" ")
}

function destinatarioDesdeUsuario(
  usuario: UsuarioRow,
  razon: string,
  actividadSlug?: string | null
): DestinatarioComunicacion | null {
  const email = normalizarEmail(usuario.email)
  if (!email) return null

  const nombre = String(usuario.nombre || "").trim()
  const apellido = String(usuario.apellido || "").trim()
  const nombreCompleto = nombreCompletoUsuario(usuario) || email

  return {
    email,
    nombre,
    apellido,
    nombreCompleto,
    role: String(usuario.role || "").trim(),
    actividadSlug: actividadSlug || null,
    razon,
  }
}

function ordenarDestinatarios(
  destinatarios: DestinatarioComunicacion[]
) {
  return destinatarios.sort((a, b) =>
    a.nombreCompleto.localeCompare(b.nombreCompleto, "es", {
      sensitivity: "base",
    })
  )
}

function nombreCompletoDesdeVariables(variables: VariablesComunicacion) {
  const nombreCompleto = String(variables.nombre_completo || "").trim()
  if (nombreCompleto) return nombreCompleto

  return [variables.nombre, variables.apellido]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" ")
}

export function renderVariables(
  contenido: string,
  variables: VariablesComunicacion
) {
  const nombreCompleto = nombreCompletoDesdeVariables(variables)
  const valores: Record<string, string> = {
    nombre: String(variables.nombre || "").trim(),
    apellido: String(variables.apellido || "").trim(),
    nombre_completo: nombreCompleto,
    email: String(variables.email || "").trim(),
    link_login: String(variables.link_login || `${appUrl()}/login`).trim(),
    clave_acceso: String(variables.clave_acceso || "").trim(),
    actividad: String(variables.actividad || "").trim(),
  }

  return contenido.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => {
    return valores[key] ?? ""
  })
}

export function segmentoDisponible(segmento: SegmentoComunicacion) {
  return !SEGMENTOS_PROXIMAMENTE.has(segmento)
}

export async function listarDestinatariosSegmento(
  segmento: SegmentoComunicacion
) {
  if (!segmentoDisponible(segmento)) {
    return {
      destinatarios: [] as DestinatarioComunicacion[],
      deshabilitado: true,
      motivo: "Este segmento queda para una próxima fase.",
    }
  }

  const supabase = createAdminSupabaseClient()

  const { data: usuariosData, error: usuariosError } = await supabase
    .from("usuarios_plataforma")
    .select("id, nombre, apellido, email, role, activo")
    .eq("activo", true)
    .order("nombre", { ascending: true })

  if (usuariosError) {
    throw new Error(`No se pudieron cargar usuarios: ${usuariosError.message}`)
  }

  const usuarios = ((usuariosData || []) as UsuarioRow[])
    .map((usuario) => ({
      ...usuario,
      email: normalizarEmail(usuario.email),
    }))
    .filter((usuario) => usuario.email)

  if (segmento === "todos_activos") {
    const deduplicados = new Map<string, DestinatarioComunicacion>()
    for (const usuario of usuarios) {
      const destinatario = destinatarioDesdeUsuario(usuario, "Usuario activo")
      if (destinatario && !deduplicados.has(destinatario.email)) {
        deduplicados.set(destinatario.email, destinatario)
      }
    }

    return {
      destinatarios: ordenarDestinatarios(Array.from(deduplicados.values())),
      deshabilitado: false,
      motivo: null,
    }
  }

  if (segmento === "equipo_interno") {
    const deduplicados = new Map<string, DestinatarioComunicacion>()
    for (const usuario of usuarios) {
      if (usuario.role !== "admin" && usuario.role !== "colaborador") {
        continue
      }

      const destinatario = destinatarioDesdeUsuario(usuario, "Equipo interno")
      if (destinatario && !deduplicados.has(destinatario.email)) {
        deduplicados.set(destinatario.email, destinatario)
      }
    }

    return {
      destinatarios: ordenarDestinatarios(Array.from(deduplicados.values())),
      deshabilitado: false,
      motivo: null,
    }
  }

  const actividadSlug = ACTIVIDAD_SEGMENTO[segmento]
  if (!actividadSlug) {
    throw new Error("Segmento inválido.")
  }

  const { data: actividadData, error: actividadError } = await supabase
    .from("actividades")
    .select("id, slug, nombre")
    .eq("slug", actividadSlug)
    .maybeSingle()

  if (actividadError) {
    throw new Error(`No se pudo cargar la actividad: ${actividadError.message}`)
  }

  const actividad = actividadData as ActividadRow | null
  if (!actividad?.id) {
    return {
      destinatarios: [] as DestinatarioComunicacion[],
      deshabilitado: false,
      motivo: "No se encontró la actividad.",
    }
  }

  const { data: inscripcionesData, error: inscripcionesError } = await supabase
    .from("inscripciones")
    .select("participante_email, actividad_id, estado")
    .eq("actividad_id", actividad.id)
    .eq("estado", "activa")

  if (inscripcionesError) {
    throw new Error(
      `No se pudieron cargar inscripciones: ${inscripcionesError.message}`
    )
  }

  const usuariosPorEmail = new Map<string, UsuarioRow>()
  for (const usuario of usuarios) {
    const email = normalizarEmail(usuario.email)
    if (email && !usuariosPorEmail.has(email)) {
      usuariosPorEmail.set(email, usuario)
    }
  }

  const deduplicados = new Map<string, DestinatarioComunicacion>()
  for (const inscripcion of (inscripcionesData || []) as InscripcionRow[]) {
    const email = normalizarEmail(inscripcion.participante_email)
    if (!email || deduplicados.has(email)) continue

    const usuario = usuariosPorEmail.get(email)
    if (!usuario) continue

    const destinatario = destinatarioDesdeUsuario(
      usuario,
      `Inscripción activa en ${actividad.nombre || actividadSlug}`,
      actividadSlug
    )

    if (destinatario) {
      deduplicados.set(destinatario.email, destinatario)
    }
  }

  return {
    destinatarios: ordenarDestinatarios(Array.from(deduplicados.values())),
    deshabilitado: false,
    motivo: null,
  }
}

export async function obtenerPlantillaPorClave(clave?: string | null) {
  const plantillaClave = String(clave || "").trim()
  if (!plantillaClave) return null

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from("comunicacion_plantillas")
    .select("*")
    .eq("clave", plantillaClave)
    .eq("activo", true)
    .maybeSingle()

  if (error) {
    throw new Error(`No se pudo cargar la plantilla: ${error.message}`)
  }

  return (data || null) as PlantillaRow | null
}

export async function registrarEnvioComunicacion({
  plantillaId,
  destinatarioEmail,
  destinatarioNombre,
  actividadSlug,
  tipo,
  asunto,
  estado,
  proveedor,
  proveedorId,
  error,
  metadata,
}: {
  plantillaId?: number | null
  destinatarioEmail: string
  destinatarioNombre?: string | null
  actividadSlug?: string | null
  tipo: string
  asunto: string
  estado: "enviado" | "error" | "omitido"
  proveedor?: string | null
  proveedorId?: string | null
  error?: string | null
  metadata?: Record<string, unknown>
}) {
  const supabase = createAdminSupabaseClient()
  const { data, error: insertError } = await supabase
    .from("comunicacion_envios")
    .insert({
      plantilla_id: plantillaId || null,
      destinatario_email: normalizarEmail(destinatarioEmail),
      destinatario_nombre: destinatarioNombre || null,
      actividad_slug: actividadSlug || null,
      tipo,
      asunto,
      estado,
      proveedor: proveedor || null,
      proveedor_id: proveedorId || null,
      error: error || null,
      metadata: metadata || {},
      sent_at: estado === "enviado" ? new Date().toISOString() : null,
    })
    .select("*")
    .single()

  if (insertError) {
    console.error("No se pudo registrar comunicacion_envios", insertError)
    return null
  }

  return data
}

export async function enviarComunicacionIndividual(
  params: EnviarComunicacionIndividualParams
) {
  const destinatarioEmail = normalizarEmail(params.destinatarioEmail)
  if (!destinatarioEmail) {
    throw new Error("Falta destinatarioEmail.")
  }

  const plantilla = await obtenerPlantillaPorClave(params.plantillaClave)
  const variables: VariablesComunicacion = {
    ...params.variables,
    email: params.variables?.email || destinatarioEmail,
    link_login: params.variables?.link_login || `${appUrl()}/login`,
  }

  const asuntoBase = params.asunto || plantilla?.asunto || ""
  const textoBase = params.texto || plantilla?.texto || ""
  const htmlBase = params.html || plantilla?.html || ""
  const asunto = renderVariables(asuntoBase, variables).trim()
  const texto = renderVariables(textoBase, variables).trim()
  const html = renderVariables(
    htmlBase || textoAHtml(texto),
    variables
  ).trim()
  const tipo = params.tipo || plantilla?.tipo || "individual"

  if (!asunto) {
    throw new Error("Falta asunto para enviar la comunicación.")
  }

  if (!texto && !html) {
    throw new Error("Falta contenido para enviar la comunicación.")
  }

  const resultado = await enviarEmail({
    to: destinatarioEmail,
    subject: asunto,
    text: texto || html.replace(/<[^>]+>/g, " "),
    html: html || textoAHtml(texto),
  })

  const registro = await registrarEnvioComunicacion({
    plantillaId: plantilla?.id || null,
    destinatarioEmail,
    destinatarioNombre: params.destinatarioNombre || variables.nombre_completo || null,
    actividadSlug: params.actividadSlug || null,
    tipo,
    asunto,
    estado: resultado.enviado ? "enviado" : "error",
    proveedor: resultado.enviado ? resultado.proveedor : "resend",
    proveedorId: resultado.enviado ? resultado.proveedorId || null : null,
    error: resultado.enviado ? null : resultado.motivo,
    metadata: {
      ...(params.metadata || {}),
      plantillaClave: params.plantillaClave || null,
    },
  })

  return {
    resultado,
    registro,
  }
}
