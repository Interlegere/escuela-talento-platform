import { enviarEmail } from "@/lib/mailing"
import {
  resolverEconomiaActividad,
  resolverEconomiaEncuentro,
} from "@/lib/economy-engine"
import { normalizarMeetLink } from "@/lib/meet-links"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export type VariablesComunicacion = {
  nombre?: string | null
  apellido?: string | null
  nombre_completo?: string | null
  email?: string | null
  link_login?: string | null
  clave_acceso?: string | null
  actividad?: string | null
  detalle_pago?: string | null
  monto?: string | null
  link_pagos?: string | null
  fecha_sesion?: string | null
  estado_pago?: string | null
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
  attachments?: {
    filename: string
    content: string
    content_type?: string
  }[]
}

export type EnviarConfirmacionSesionIndividualParams = {
  disponibilidadId?: number | null
  destinatarioEmail: string
  destinatarioNombre?: string | null
  actividadSlug: "mentorias" | "terapia"
  fecha: string
  hora: string
  duracion: string | number
  meetLink?: string | null
}

export type EnviarActualizacionSesionIndividualParams =
  EnviarConfirmacionSesionIndividualParams

export type EnviarCancelacionSesionIndividualParams = {
  disponibilidadId?: number | null
  destinatarioEmail: string
  destinatarioNombre?: string | null
  actividadSlug: "mentorias" | "terapia"
  fecha: string
  hora: string
  duracion: string | number
}

export type SegmentoComunicacion =
  | "todos_activos"
  | "todos_registrados"
  | "usuarios_inactivos"
  | "casatalentos_activos"
  | "conectando_sentidos_activos"
  | "mentorias_activos"
  | "terapia_activos"
  | "pagos_pendientes"
  | "pagos_al_dia"
  | "equipo_interno"
  | "contactos_externos_activos"
  | "contactos_externos_todos"
  | "usuarios_y_contactos_activos"
  | "destinatarios_especificos"
  | "lista_manual"

export type DestinatarioComunicacion = {
  email: string
  nombre: string
  apellido: string
  nombreCompleto: string
  role: string
  actividadSlug: string | null
  actividadNombre?: string | null
  fuente: "usuario_plataforma" | "contacto_externo" | "manual"
  activo: boolean
  contactoId: number | null
  usuarioId: string | number | null
  razon: string
  tipoPago?: "mensualidad" | "proceso" | "sesion_terapia"
  estadoPago?: "sin_pago" | "en_revision" | "rechazado" | "pendiente_pago"
  monto?: string | number | null
  moneda?: string | null
  detallePago?: string | null
  fechaSesion?: string | null
  fechaVencimiento?: string | null
  reservaId?: number | null
  pagoMensualId?: number | null
  comprobantePendienteAprobacion?: boolean
  recordatorioEnviadoHoy?: boolean
}

export type DestinatarioSeleccionadoComunicacion = {
  email?: string | null
  fuente?: "usuario_plataforma" | "contacto_externo" | "manual" | string | null
}

export type ListarDestinatariosSegmentoParams =
  | SegmentoComunicacion
  | {
      segmento: SegmentoComunicacion
      emailsManual?: string | null
      destinatariosSeleccionados?: DestinatarioSeleccionadoComunicacion[] | null
      filtroPagoPendiente?: FiltroPagoPendiente | null
    }

export type FiltroPagoPendiente =
  | "todos"
  | "mensualidades"
  | "terapias"
  | "comprobantes_en_revision"
  | "rechazados"

export type DestinatarioPagoPendiente = {
  email: string
  nombreCompleto: string
  nombre: string
  actividadSlug: string
  actividadNombre: string
  tipoPago: "mensualidad" | "proceso" | "sesion_terapia"
  estadoPago: "sin_pago" | "en_revision" | "rechazado" | "pendiente_pago"
  monto?: string | number | null
  moneda?: string | null
  detallePago: string
  fechaSesion?: string | null
  fechaVencimiento?: string | null
  reservaId?: number | null
  pagoMensualId?: number | null
  comprobantePendienteAprobacion: boolean
  usuarioActivo: boolean
  recordatorioEnviadoHoy?: boolean
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

type ContactoRow = {
  id: number
  email?: string | null
  nombre?: string | null
  apellido?: string | null
  telefono?: string | null
  origen?: string | null
  etiquetas?: unknown
  activo?: boolean | null
  notas?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type HonorarioPagoRow = {
  id: number
  actividad_id: number
  participante_email?: string | null
  participante_nombre?: string | null
  honorario_mensual?: string | number | null
  modalidad_pago?: string | null
  moneda?: string | null
  activo?: boolean | null
}

type InscripcionPagoRow = {
  id: number
  actividad_id?: number | null
  participante_email?: string | null
  participante_nombre?: string | null
  estado?: string | null
}

type PagoMensualEstadoRow = {
  id: number
  inscripcion_id?: number | null
  anio?: number | null
  mes?: number | null
  estado?: string | null
  monto?: string | number | null
  moneda?: string | null
  created_at?: string | null
}

type ReservaPagoRow = {
  id: number
  estado?: string | null
  participante_email?: string | null
  participante_nombre?: string | null
  medio_pago?: string | null
  monto?: string | number | null
  monto_transferencia?: string | number | null
  monto_mercado_pago?: string | number | null
  comprobante_nombre_archivo?: string | null
  mp_status?: string | null
  disponibilidades?:
    | {
        actividad_slug?: string | null
        titulo?: string | null
        fecha?: string | null
        hora?: string | null
      }[]
    | null
}

const ACTIVIDAD_SEGMENTO: Partial<Record<SegmentoComunicacion, string>> = {
  casatalentos_activos: "casatalentos",
  conectando_sentidos_activos: "conectando-sentidos",
  mentorias_activos: "mentorias",
  terapia_activos: "terapia",
}

const SEGMENTOS_PROXIMAMENTE = new Set<SegmentoComunicacion>(["pagos_al_dia"])

const TIMEZONE_ARGENTINA = "America/Argentina/Cordoba"

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

function periodoMensualTexto(anio?: number | null, mes?: number | null) {
  if (!anio || !mes) return "período actual"
  return `${String(mes).padStart(2, "0")}/${anio}`
}

function normalizarEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase()
}

function formatearFechaSesionCorta(fecha?: string | null, hora?: string | null) {
  if (!fecha) return ""
  const base = new Date(`${fecha}T${String(hora || "00:00").slice(0, 5)}:00`)
  if (Number.isNaN(base.getTime())) {
    return [fecha, hora].filter(Boolean).join(" ")
  }

  return base.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function estadoPagoLabel(estado: string) {
  switch (estado) {
    case "sin_pago":
      return "Sin pago"
    case "en_revision":
      return "Comprobante en revisión"
    case "rechazado":
      return "Pago rechazado"
    case "pendiente_pago":
      return "Pendiente de pago"
    default:
      return estado
  }
}

function tipoPagoLabel(tipo: DestinatarioPagoPendiente["tipoPago"]) {
  switch (tipo) {
    case "mensualidad":
      return "Mensualidad"
    case "proceso":
      return "Proceso"
    case "sesion_terapia":
      return "Sesión de Terapia"
  }
}

function htmlBotonEntheos(texto: string, href: string) {
  return `
    <div style="margin: 24px 0 28px;">
      <a
        href="${escapeHtml(href)}"
        style="display:inline-block;padding:14px 22px;border-radius:999px;background:#c98b1b;color:#ffffff;font-weight:700;text-decoration:none;"
      >
        ${escapeHtml(texto)}
      </a>
    </div>
  `
}

export function crearHtmlRecordatorioPagoEntheos(cuerpoTemplate: string) {
  const cuerpoHtml = textoAHtml(cuerpoTemplate)
  return `
    <div style="margin:0;padding:32px 16px;background:#f6efe2;font-family:Arial,sans-serif;color:#1f2933;">
      <div style="max-width:680px;margin:0 auto;background:#fffdf8;border:1px solid #eadfc9;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(77,54,18,0.08);">
        <div style="padding:32px 32px 20px;background:linear-gradient(135deg, rgba(250,244,229,1) 0%, rgba(255,250,240,1) 55%, rgba(248,237,210,1) 100%);">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#8a6a2f;font-weight:700;">ENTHEOS</p>
          <h1 style="margin:0 0 10px;font-size:30px;line-height:1.15;color:#18202a;">Recordatorio de pago</h1>
          <p style="margin:0;color:#6b7280;font-size:16px;line-height:1.5;">
            Seguimiento manual de pagos pendientes desde Administración de Comunicaciones.
          </p>
        </div>
        <div style="padding:28px 32px 32px;line-height:1.75;">
          ${cuerpoHtml}
          ${htmlBotonEntheos("Ir a Pagos", "{{link_pagos}}")}
          <div style="margin-top:16px;border:1px solid #e5dccb;border-radius:18px;padding:18px 20px;background:#fffaf2;">
            <p style="margin:0 0 10px;"><strong>Actividad:</strong> {{actividad}}</p>
            <p style="margin:0 0 10px;"><strong>Estado:</strong> {{estado_pago}}</p>
            <p style="margin:0 0 10px;"><strong>Monto:</strong> {{monto}}</p>
            <p style="margin:0;"><strong>Detalle:</strong> {{detalle_pago}}</p>
          </div>
          <p style="margin:18px 0 0;">Equipo Entheos</p>
        </div>
      </div>
    </div>
  `
}

function nombreActividadSesion(slug: "mentorias" | "terapia") {
  return slug === "terapia" ? "Terapia" : "Mentoría"
}

function rutaActividadSesion(slug: "mentorias" | "terapia") {
  return slug === "terapia" ? "/terapia" : "/mentorias"
}

function formatearFechaSesion(fecha: string) {
  const [anio, mes, dia] = fecha.split("-").map(Number)
  if (!anio || !mes || !dia) return fecha

  // Usamos mediodía local para evitar corrimientos de día al formatear
  // fechas "sin hora" en clientes o runtimes con distinta zona horaria.
  const fechaLocalSegura = new Date(anio, mes - 1, dia, 12, 0, 0)

  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fechaLocalSegura)
}

function formatearHoraSesion(hora: string) {
  const [horas = "00", minutos = "00"] = String(hora || "").split(":")
  return `${horas.padStart(2, "0")}:${minutos.padStart(2, "0")}`
}

function limpiarTextoIcs(value?: string | null) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replace(/\r?\n/g, "\\n")
}

function formatearFechaHoraIcsLocal(fecha: string, hora: string, sumarMinutos = 0) {
  const [anio, mes, dia] = fecha.split("-").map(Number)
  const [horas = 0, minutos = 0, segundos = 0] = String(hora || "00:00")
    .split(":")
    .map(Number)
  const base = new Date(
    Date.UTC(
      anio || 1970,
      (mes || 1) - 1,
      dia || 1,
      horas || 0,
      minutos || 0,
      segundos || 0
    )
  )

  base.setUTCMinutes(base.getUTCMinutes() + sumarMinutos)

  const y = String(base.getUTCFullYear()).padStart(4, "0")
  const m = String(base.getUTCMonth() + 1).padStart(2, "0")
  const d = String(base.getUTCDate()).padStart(2, "0")
  const h = String(base.getUTCHours()).padStart(2, "0")
  const min = String(base.getUTCMinutes()).padStart(2, "0")
  const sec = String(base.getUTCSeconds()).padStart(2, "0")

  return `${y}${m}${d}T${h}${min}${sec}`
}

function formatearDtstampIcs(fecha = new Date()) {
  const y = String(fecha.getUTCFullYear()).padStart(4, "0")
  const m = String(fecha.getUTCMonth() + 1).padStart(2, "0")
  const d = String(fecha.getUTCDate()).padStart(2, "0")
  const h = String(fecha.getUTCHours()).padStart(2, "0")
  const min = String(fecha.getUTCMinutes()).padStart(2, "0")
  const sec = String(fecha.getUTCSeconds()).padStart(2, "0")

  return `${y}${m}${d}T${h}${min}${sec}Z`
}

function extraerEmailRemitente(value?: string | null) {
  const raw = String(value || "").trim()
  const match = raw.match(/<([^>]+)>/)
  const email = (match?.[1] || raw).trim()

  return email.includes("@") ? email : ""
}

function extraerNombreRemitente(value?: string | null) {
  const raw = String(value || "").trim()
  const match = raw.match(/^(.+?)\s*<[^>]+>$/)
  return (match?.[1] || "ENTHEOS").replace(/^"|"$/g, "").trim()
}

function organizerIcs() {
  const remitente =
    process.env.MAIL_REPLY_TO ||
    process.env.REPLY_TO ||
    process.env.MAIL_FROM ||
    process.env.RESEND_FROM ||
    ""
  const email = extraerEmailRemitente(remitente)

  if (!email) return null

  const nombre = limpiarTextoIcs(extraerNombreRemitente(remitente))
  return `ORGANIZER;CN=${nombre}:MAILTO:${email}`
}

function base64Utf8(value: string) {
  return Buffer.from(value, "utf8").toString("base64")
}

export function generarIcsSesionIndividual(
  params: EnviarConfirmacionSesionIndividualParams
) {
  const actividad = nombreActividadSesion(params.actividadSlug)
  const titulo = `${actividad} en ENTHEOS`
  const duracion = Number(params.duracion || 60)
  const meetLink = normalizarMeetLink(params.meetLink)
  const linkPlataforma = `${appUrl()}${rutaActividadSesion(params.actividadSlug)}`
  const urlEvento = meetLink || linkPlataforma
  const ubicacion = meetLink || "ENTHEOS"
  const uidBase = params.disponibilidadId
    ? String(params.disponibilidadId)
    : `${params.actividadSlug}-${params.fecha}-${params.hora}-${normalizarEmail(
        params.destinatarioEmail
      )}`.replace(/[^a-zA-Z0-9_-]/g, "-")
  const descripcion = [
    `Actividad: ${actividad}`,
    `Fecha: ${formatearFechaSesion(params.fecha)}`,
    `Hora: ${formatearHoraSesion(params.hora)} Argentina`,
    `Duración: ${duracion} minutos`,
    `Plataforma: ${linkPlataforma}`,
    meetLink
      ? `Meet: ${meetLink}`
      : "El enlace de acceso será enviado antes del encuentro.",
  ].join("\n")
  const organizer = organizerIcs()
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ENTHEOS Escuela//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:entheos-disponibilidad-${uidBase}@entheosescuela.com`,
    `DTSTAMP:${formatearDtstampIcs()}`,
    `DTSTART;TZID=${TIMEZONE_ARGENTINA}:${formatearFechaHoraIcsLocal(
      params.fecha,
      params.hora
    )}`,
    `DTEND;TZID=${TIMEZONE_ARGENTINA}:${formatearFechaHoraIcsLocal(
      params.fecha,
      params.hora,
      duracion
    )}`,
    `SUMMARY:${limpiarTextoIcs(titulo)}`,
    `DESCRIPTION:${limpiarTextoIcs(descripcion)}`,
    `LOCATION:${limpiarTextoIcs(ubicacion)}`,
    `URL:${urlEvento}`,
    organizer,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean)

  return `${lineas.join("\r\n")}\r\n`
}

function esTablaContactosFaltante(error: unknown) {
  const texto = String(
    typeof error === "object" && error && "message" in error
      ? (error as { message?: unknown }).message
      : error || ""
  ).toLowerCase()

  return (
    texto.includes("relation") ||
    texto.includes("does not exist") ||
    texto.includes("could not find the table") ||
    texto.includes("comunicacion_contactos")
  )
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
    actividadNombre: null,
    fuente: "usuario_plataforma",
    activo: usuario.activo !== false,
    contactoId: null,
    usuarioId: usuario.id || null,
    razon,
  }
}

function destinatarioDesdeContacto(
  contacto: ContactoRow,
  razon: string
): DestinatarioComunicacion | null {
  const email = normalizarEmail(contacto.email)
  if (!email) return null

  const nombre = String(contacto.nombre || "").trim()
  const apellido = String(contacto.apellido || "").trim()
  const nombreCompleto = [nombre, apellido].filter(Boolean).join(" ") || email

  return {
    email,
    nombre,
    apellido,
    nombreCompleto,
    role: "contacto_externo",
    actividadSlug: null,
    actividadNombre: null,
    fuente: "contacto_externo",
    activo: contacto.activo !== false,
    contactoId: contacto.id,
    usuarioId: null,
    razon,
  }
}

function destinatarioManual(email: string): DestinatarioComunicacion | null {
  const normalizado = normalizarEmail(email)
  if (!normalizado || !normalizado.includes("@")) return null

  return {
    email: normalizado,
    nombre: "",
    apellido: "",
    nombreCompleto: normalizado,
    role: "manual",
    actividadSlug: null,
    actividadNombre: null,
    fuente: "manual",
    activo: true,
    contactoId: null,
    usuarioId: null,
    razon: "Lista manual",
  }
}

function parsearEmailsManual(emailsManual?: string | null) {
  return String(emailsManual || "")
    .split(/[\s,;]+/g)
    .map((item) => normalizarEmail(item))
    .filter(Boolean)
}

function emailSeleccionado(item: DestinatarioSeleccionadoComunicacion) {
  return normalizarEmail(item.email)
}

function agregarDeduplicado(
  mapa: Map<string, DestinatarioComunicacion>,
  destinatario: DestinatarioComunicacion | null
) {
  if (!destinatario) return
  if (!mapa.has(destinatario.email)) {
    mapa.set(destinatario.email, destinatario)
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
    detalle_pago: String(variables.detalle_pago || "").trim(),
    monto: String(variables.monto || "").trim(),
    link_pagos: String(variables.link_pagos || `${appUrl()}/pagos`).trim(),
    fecha_sesion: String(variables.fecha_sesion || "").trim(),
    estado_pago: String(variables.estado_pago || "").trim(),
  }

  return contenido.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => {
    return valores[key] ?? ""
  })
}

export function segmentoDisponible(segmento: SegmentoComunicacion) {
  return !SEGMENTOS_PROXIMAMENTE.has(segmento)
}

function destinatarioComunicacionDesdePagoPendiente(
  item: DestinatarioPagoPendiente
): DestinatarioComunicacion {
  return {
    email: item.email,
    nombre: item.nombre,
    apellido: "",
    nombreCompleto: item.nombreCompleto,
    role: "participante",
    actividadSlug: item.actividadSlug,
    actividadNombre: item.actividadNombre,
    fuente: "usuario_plataforma",
    activo: item.usuarioActivo,
    contactoId: null,
    usuarioId: item.email,
    razon: item.detallePago,
    tipoPago: item.tipoPago,
    estadoPago: item.estadoPago,
    monto: item.monto ?? null,
    moneda: item.moneda ?? null,
    detallePago: item.detallePago,
    fechaSesion: item.fechaSesion ?? null,
    fechaVencimiento: item.fechaVencimiento ?? null,
    reservaId: item.reservaId ?? null,
    pagoMensualId: item.pagoMensualId ?? null,
    comprobantePendienteAprobacion: item.comprobantePendienteAprobacion,
    recordatorioEnviadoHoy: item.recordatorioEnviadoHoy === true,
  }
}

export async function listarDestinatariosPagosPendientes(
  options?: {
    filtro?: FiltroPagoPendiente | null
  }
) {
  const filtro = options?.filtro || "todos"
  const supabase = createAdminSupabaseClient()
  const ahora = new Date()
  const anioActual = ahora.getFullYear()
  const mesActual = ahora.getMonth() + 1
  const inicioDia = new Date(ahora)
  inicioDia.setHours(0, 0, 0, 0)
  const finDia = new Date(inicioDia)
  finDia.setDate(finDia.getDate() + 1)

  const [
    { data: usuariosData, error: usuariosError },
    { data: actividadesData, error: actividadesError },
    { data: honorariosData, error: honorariosError },
    { data: inscripcionesData, error: inscripcionesError },
    { data: reservasData, error: reservasError },
    { data: enviosData, error: enviosError },
  ] = await Promise.all([
    supabase
      .from("usuarios_plataforma")
      .select("id, nombre, apellido, email, role, activo"),
    supabase.from("actividades").select("id, slug, nombre"),
    supabase
      .from("honorarios_participante")
      .select(
        "id, actividad_id, participante_email, participante_nombre, honorario_mensual, modalidad_pago, moneda, activo"
      )
      .eq("activo", true),
    supabase
      .from("inscripciones")
      .select("id, actividad_id, participante_email, participante_nombre, estado")
      .eq("estado", "activa"),
    supabase
      .from("reservas")
      .select(
        "id, estado, participante_email, participante_nombre, medio_pago, monto, monto_transferencia, monto_mercado_pago, comprobante_nombre_archivo, mp_status, disponibilidades(actividad_slug, titulo, fecha, hora)"
      )
      .in("estado", ["pendiente_pago", "confirmada"]),
    supabase
      .from("comunicacion_envios")
      .select("destinatario_email, created_at")
      .eq("tipo", "pago")
      .gte("created_at", inicioDia.toISOString())
      .lt("created_at", finDia.toISOString()),
  ])

  if (usuariosError) {
    throw new Error(`No se pudieron cargar usuarios: ${usuariosError.message}`)
  }
  if (actividadesError) {
    throw new Error(`No se pudieron cargar actividades: ${actividadesError.message}`)
  }
  if (honorariosError) {
    throw new Error(`No se pudieron cargar honorarios: ${honorariosError.message}`)
  }
  if (inscripcionesError) {
    throw new Error(`No se pudieron cargar inscripciones: ${inscripcionesError.message}`)
  }
  if (reservasError) {
    throw new Error(`No se pudieron cargar reservas: ${reservasError.message}`)
  }
  if (enviosError) {
    throw new Error(`No se pudo cargar el historial de recordatorios: ${enviosError.message}`)
  }

  const usuarios = (usuariosData || []) as UsuarioRow[]
  const actividades = (actividadesData || []) as ActividadRow[]
  const honorarios = (honorariosData || []) as HonorarioPagoRow[]
  const inscripciones = (inscripcionesData || []) as InscripcionPagoRow[]
  const reservas = (reservasData || []) as ReservaPagoRow[]
  const recordatoriosHoy = new Set(
    ((enviosData as Array<{ destinatario_email?: string | null }> | null) || [])
      .map((item) => normalizarEmail(item.destinatario_email))
      .filter(Boolean)
  )

  const usuariosPorEmail = new Map<string, UsuarioRow>()
  for (const usuario of usuarios) {
    const email = normalizarEmail(usuario.email)
    if (email && !usuariosPorEmail.has(email)) {
      usuariosPorEmail.set(email, usuario)
    }
  }

  const actividadesPorId = new Map<number, ActividadRow>()
  for (const actividad of actividades) {
    actividadesPorId.set(actividad.id, actividad)
  }

  const inscripcionPorClave = new Map<string, InscripcionPagoRow>()
  for (const inscripcion of inscripciones) {
    const email = normalizarEmail(inscripcion.participante_email)
    const actividadId = Number(inscripcion.actividad_id || 0)
    if (!email || !actividadId) continue
    inscripcionPorClave.set(`${actividadId}:${email}`, inscripcion)
  }

  const inscripcionIds = Array.from(
    new Set(
      Array.from(inscripcionPorClave.values())
        .map((item) => Number(item.id || 0))
        .filter((value) => value > 0)
    )
  )

  const { data: pagosData, error: pagosError } = inscripcionIds.length
    ? await supabase
        .from("pagos_mensuales")
        .select("id, inscripcion_id, anio, mes, estado, monto, moneda, created_at")
        .in("inscripcion_id", inscripcionIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null }

  if (pagosError) {
    throw new Error(`No se pudieron cargar pagos mensuales: ${pagosError.message}`)
  }

  const pagos = (pagosData || []) as PagoMensualEstadoRow[]
  const pagosPorInscripcion = new Map<number, PagoMensualEstadoRow[]>()
  for (const pago of pagos) {
    const id = Number(pago.inscripcion_id || 0)
    if (!id) continue
    const existentes = pagosPorInscripcion.get(id) || []
    existentes.push(pago)
    pagosPorInscripcion.set(id, existentes)
  }

  const resultado: DestinatarioPagoPendiente[] = []

  for (const honorario of honorarios) {
    const actividad = actividadesPorId.get(Number(honorario.actividad_id || 0))
    const actividadSlug = String(actividad?.slug || "").trim()
    const actividadNombre = String(actividad?.nombre || actividadSlug || "Actividad").trim()
    const email = normalizarEmail(honorario.participante_email)
    if (!email || !actividadSlug) continue

    const modalidadPago = String(honorario.modalidad_pago || "").trim().toLowerCase()
    if (modalidadPago === "sesion") {
      continue
    }

    const inscripcion = inscripcionPorClave.get(`${Number(honorario.actividad_id || 0)}:${email}`)
    if (!inscripcion?.id) continue

    const usuario = usuariosPorEmail.get(email)
    const nombre =
      String(usuario?.nombre || "").trim() ||
      String(honorario.participante_nombre || inscripcion.participante_nombre || "").trim() ||
      email
    const apellido = String(usuario?.apellido || "").trim()
    const nombreCompleto = [nombre, apellido].filter(Boolean).join(" ") || nombre
    const pagosInscripcion = pagosPorInscripcion.get(Number(inscripcion.id || 0)) || []

    const tipoPago: DestinatarioPagoPendiente["tipoPago"] =
      modalidadPago === "proceso" ? "proceso" : "mensualidad"
    const pagoActual =
      modalidadPago === "proceso"
        ? pagosInscripcion[0] || null
        : pagosInscripcion.find(
            (item) =>
              Number(item.anio || 0) === anioActual &&
              Number(item.mes || 0) === mesActual
          ) || null
    const economia = resolverEconomiaActividad({
      actividadSlug,
      actividadExiste: true,
      inscripcionActiva: true,
      honorarioId: honorario.id,
      honorarioActivo: honorario.activo ?? null,
      honorarioModalidadRaw: honorario.modalidad_pago || null,
      honorarioMonto: honorario.honorario_mensual ?? null,
      honorarioMoneda: honorario.moneda || null,
      pagoMensualId: pagoActual?.id || null,
      pagoMensualEstado: pagoActual?.estado || null,
      pagoMensualMonto: pagoActual?.monto ?? null,
      pagoMensualMoneda: pagoActual?.moneda || null,
      pagoMensualAnio: pagoActual?.anio ?? null,
      pagoMensualMes: pagoActual?.mes ?? null,
      fechaActual: ahora,
    })

    let estadoPago: DestinatarioPagoPendiente["estadoPago"] | null = null
    if (economia.estado === "pendiente_pago") {
      estadoPago = "sin_pago"
    } else if (economia.estado === "en_revision") {
      estadoPago = "en_revision"
    } else if (economia.estado === "rechazado") {
      estadoPago = "rechazado"
    }

    if (!estadoPago) continue

    const fechaVencimiento =
      modalidadPago === "proceso"
        ? null
        : economia.periodo || periodoMensualTexto(anioActual, mesActual)
    let detallePago = ""

    if (tipoPago === "proceso") {
      if (estadoPago === "sin_pago") {
        detallePago = `Pago del proceso pendiente en ${actividadNombre}.`
      } else if (estadoPago === "en_revision") {
        detallePago = `Comprobante del proceso pendiente de aprobación en ${actividadNombre}.`
      } else {
        detallePago = `El pago del proceso en ${actividadNombre} fue rechazado y necesita regularización.`
      }
    } else if (estadoPago === "sin_pago") {
      detallePago = `Mensualidad ${fechaVencimiento} pendiente en ${actividadNombre}.`
    } else if (estadoPago === "en_revision") {
      detallePago = `Comprobante de ${fechaVencimiento} pendiente de aprobación en ${actividadNombre}.`
    } else {
      detallePago = `La mensualidad ${fechaVencimiento} de ${actividadNombre} fue rechazada y requiere regularización.`
    }

    const item: DestinatarioPagoPendiente = {
      email,
      nombreCompleto,
      nombre,
      actividadSlug,
      actividadNombre,
      tipoPago,
      estadoPago,
      monto: pagoActual?.monto ?? honorario.honorario_mensual ?? null,
      moneda: pagoActual?.moneda || honorario.moneda || "ARS",
      detallePago,
      fechaSesion: null,
      fechaVencimiento,
      reservaId: null,
      pagoMensualId: pagoActual?.id || null,
      comprobantePendienteAprobacion: estadoPago === "en_revision",
      usuarioActivo: usuario?.activo !== false,
      recordatorioEnviadoHoy: recordatoriosHoy.has(email),
    }

    resultado.push(item)
  }

  for (const reserva of reservas) {
    const disponibilidad = reserva.disponibilidades?.[0] || null
    if (String(disponibilidad?.actividad_slug || "").trim() !== "terapia") continue

    const email = normalizarEmail(reserva.participante_email)
    if (!email) continue

    const usuario = usuariosPorEmail.get(email)
    const nombre =
      String(usuario?.nombre || "").trim() ||
      String(reserva.participante_nombre || "").trim() ||
      email
    const apellido = String(usuario?.apellido || "").trim()
    const nombreCompleto = [nombre, apellido].filter(Boolean).join(" ") || nombre

    const economia = resolverEconomiaEncuentro({
      actividadSlug: "terapia",
      disponibilidadEstado: null,
      reservaId: reserva.id,
      reservaEstado: reserva.estado || null,
      medioPago: reserva.medio_pago || null,
      monto: reserva.monto ?? null,
      montoTransferencia: reserva.monto_transferencia ?? null,
      montoMercadoPago: reserva.monto_mercado_pago ?? null,
      comprobanteNombreArchivo: reserva.comprobante_nombre_archivo || null,
      mpStatus: reserva.mp_status || null,
      moneda: "ARS",
    })

    let estadoPago: DestinatarioPagoPendiente["estadoPago"] | null = null
    if (economia.estado === "pendiente_pago") {
      estadoPago = "pendiente_pago"
    } else if (economia.estado === "en_revision") {
      estadoPago = "en_revision"
    } else if (economia.estado === "rechazado") {
      estadoPago = "rechazado"
    }

    if (!estadoPago) continue

    const fechaSesion = formatearFechaSesionCorta(
      disponibilidad?.fecha || null,
      disponibilidad?.hora || null
    )
    const detalleBase = disponibilidad?.titulo || "Sesión de Terapia"
    let detallePago = `${detalleBase} pendiente de pago.`
    if (estadoPago === "en_revision") {
      detallePago = `${detalleBase}: comprobante pendiente de aprobación.`
    } else if (estadoPago === "rechazado") {
      detallePago = `${detalleBase}: el pago fue rechazado y necesita regularización.`
    }

    resultado.push({
      email,
      nombreCompleto,
      nombre,
      actividadSlug: "terapia",
      actividadNombre: "Terapia",
      tipoPago: "sesion_terapia",
      estadoPago,
      monto:
        reserva.monto_transferencia ??
        reserva.monto ??
        reserva.monto_mercado_pago ??
        null,
      moneda: "ARS",
      detallePago,
      fechaSesion: fechaSesion || null,
      fechaVencimiento: null,
      reservaId: reserva.id,
      pagoMensualId: null,
      comprobantePendienteAprobacion: estadoPago === "en_revision",
      usuarioActivo: usuario?.activo !== false,
      recordatorioEnviadoHoy: recordatoriosHoy.has(email),
    })
  }

  const filtrados = resultado.filter((item) => {
    if (filtro === "mensualidades") {
      return item.tipoPago === "mensualidad" || item.tipoPago === "proceso"
    }
    if (filtro === "terapias") {
      return item.tipoPago === "sesion_terapia"
    }
    if (filtro === "comprobantes_en_revision") {
      return item.estadoPago === "en_revision"
    }
    if (filtro === "rechazados") {
      return item.estadoPago === "rechazado"
    }
    return true
  })

  return filtrados.sort((a, b) =>
    a.nombreCompleto.localeCompare(b.nombreCompleto, "es", {
      sensitivity: "base",
    })
  )
}

export async function resolverDestinatariosEspecificos({
  destinatariosSeleccionados,
  emailsManual,
}: {
  destinatariosSeleccionados?: DestinatarioSeleccionadoComunicacion[] | null
  emailsManual?: string | null
}) {
  const emails = new Set<string>()

  for (const item of destinatariosSeleccionados || []) {
    const email = emailSeleccionado(item)
    if (email) emails.add(email)
  }

  for (const email of parsearEmailsManual(emailsManual)) {
    emails.add(email)
  }

  if (emails.size === 0) {
    return [] as DestinatarioComunicacion[]
  }

  const emailList = Array.from(emails)
  const supabase = createAdminSupabaseClient()
  const deduplicados = new Map<string, DestinatarioComunicacion>()

  const { data: usuariosData, error: usuariosError } = await supabase
    .from("usuarios_plataforma")
    .select("id, nombre, apellido, email, role, activo")
    .in("email", emailList)

  if (usuariosError) {
    throw new Error(`No se pudieron cargar usuarios: ${usuariosError.message}`)
  }

  for (const usuario of (usuariosData || []) as UsuarioRow[]) {
    agregarDeduplicado(
      deduplicados,
      destinatarioDesdeUsuario(
        {
          ...usuario,
          email: normalizarEmail(usuario.email),
        },
        usuario.activo === false
          ? "Usuario seleccionado inactivo"
          : "Usuario seleccionado activo"
      )
    )
  }

  const { data: contactosData, error: contactosError } = await supabase
    .from("comunicacion_contactos")
    .select("id, email, nombre, apellido, telefono, origen, etiquetas, activo, notas, created_at, updated_at")
    .in("email", emailList)

  if (contactosError && !esTablaContactosFaltante(contactosError)) {
    throw new Error(
      `No se pudieron cargar contactos externos: ${contactosError.message}`
    )
  }

  if (!contactosError) {
    for (const contacto of (contactosData || []) as ContactoRow[]) {
      agregarDeduplicado(
        deduplicados,
        destinatarioDesdeContacto(
          {
            ...contacto,
            email: normalizarEmail(contacto.email),
          },
          contacto.activo === false
            ? "Contacto externo seleccionado inactivo"
            : "Contacto externo seleccionado activo"
        )
      )
    }
  }

  for (const email of emailList) {
    agregarDeduplicado(deduplicados, destinatarioManual(email))
  }

  return ordenarDestinatarios(Array.from(deduplicados.values()))
}

export async function buscarDestinatariosComunicacion(query: string) {
  const q = String(query || "").trim().replace(/[,\n\r]/g, " ")
  if (q.length < 2) {
    return {
      destinatarios: [] as DestinatarioComunicacion[],
      advertencia: null as string | null,
    }
  }

  const supabase = createAdminSupabaseClient()
  const patron = `%${q}%`
  const deduplicados = new Map<string, DestinatarioComunicacion>()
  let advertencia: string | null = null

  const { data: usuariosData, error: usuariosError } = await supabase
    .from("usuarios_plataforma")
    .select("id, nombre, apellido, email, role, activo")
    .or(`nombre.ilike.${patron},apellido.ilike.${patron},email.ilike.${patron}`)
    .limit(20)

  if (usuariosError) {
    throw new Error(`No se pudieron buscar usuarios: ${usuariosError.message}`)
  }

  for (const usuario of (usuariosData || []) as UsuarioRow[]) {
    agregarDeduplicado(
      deduplicados,
      destinatarioDesdeUsuario(
        {
          ...usuario,
          email: normalizarEmail(usuario.email),
        },
        usuario.activo === false
          ? "Usuario registrado inactivo"
          : "Usuario registrado activo"
      )
    )
  }

  const { data: contactosData, error: contactosError } = await supabase
    .from("comunicacion_contactos")
    .select("id, email, nombre, apellido, telefono, origen, etiquetas, activo, notas, created_at, updated_at")
    .or(`nombre.ilike.${patron},apellido.ilike.${patron},email.ilike.${patron}`)
    .limit(20)

  if (contactosError) {
    if (esTablaContactosFaltante(contactosError)) {
      advertencia =
        "La tabla de contactos externos no está disponible. Se muestran sólo usuarios registrados."
    } else {
      throw new Error(
        `No se pudieron buscar contactos externos: ${contactosError.message}`
      )
    }
  }

  if (!contactosError) {
    for (const contacto of (contactosData || []) as ContactoRow[]) {
      agregarDeduplicado(
        deduplicados,
        destinatarioDesdeContacto(
          {
            ...contacto,
            email: normalizarEmail(contacto.email),
          },
          contacto.activo === false
            ? "Contacto externo inactivo"
            : "Contacto externo activo"
        )
      )
    }
  }

  return {
    destinatarios: ordenarDestinatarios(Array.from(deduplicados.values())).slice(
      0,
      20
    ),
    advertencia,
  }
}

export async function listarDestinatariosSegmento(
  params: ListarDestinatariosSegmentoParams
) {
  const segmento =
    typeof params === "string" ? params : params.segmento
  const emailsManual =
    typeof params === "string" ? "" : params.emailsManual || ""
  const destinatariosSeleccionados =
    typeof params === "string" ? [] : params.destinatariosSeleccionados || []
  const filtroPagoPendiente =
    typeof params === "string" ? "todos" : params.filtroPagoPendiente || "todos"

  if (!segmentoDisponible(segmento)) {
    return {
      destinatarios: [] as DestinatarioComunicacion[],
      deshabilitado: true,
      motivo: "Este segmento queda para una próxima fase.",
    }
  }

  const supabase = createAdminSupabaseClient()

  if (segmento === "destinatarios_especificos") {
    return {
      destinatarios: await resolverDestinatariosEspecificos({
        destinatariosSeleccionados,
        emailsManual,
      }),
      deshabilitado: false,
      motivo: null,
    }
  }

  if (segmento === "lista_manual") {
    const deduplicados = new Map<string, DestinatarioComunicacion>()
    for (const email of parsearEmailsManual(emailsManual)) {
      const destinatario = destinatarioManual(email)
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

  if (segmento === "pagos_pendientes") {
    const destinatariosPago = await listarDestinatariosPagosPendientes({
      filtro: filtroPagoPendiente,
    })

    return {
      destinatarios: ordenarDestinatarios(
        destinatariosPago.map(destinatarioComunicacionDesdePagoPendiente)
      ),
      deshabilitado: false,
      motivo: null,
    }
  }

  const { data: usuariosData, error: usuariosError } = await supabase
    .from("usuarios_plataforma")
    .select("id, nombre, apellido, email, role, activo")
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

  const usuariosActivos = usuarios.filter((usuario) => usuario.activo !== false)
  const usuariosInactivos = usuarios.filter((usuario) => usuario.activo === false)

  if (segmento === "todos_activos") {
    const deduplicados = new Map<string, DestinatarioComunicacion>()
    for (const usuario of usuariosActivos) {
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

  if (segmento === "todos_registrados") {
    const deduplicados = new Map<string, DestinatarioComunicacion>()
    for (const usuario of usuarios) {
      const destinatario = destinatarioDesdeUsuario(
        usuario,
        usuario.activo === false ? "Usuario registrado inactivo" : "Usuario registrado activo"
      )
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

  if (segmento === "usuarios_inactivos") {
    const deduplicados = new Map<string, DestinatarioComunicacion>()
    for (const usuario of usuariosInactivos) {
      const destinatario = destinatarioDesdeUsuario(
        usuario,
        "Usuario registrado inactivo"
      )
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
    for (const usuario of usuariosActivos) {
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

  if (
    segmento === "contactos_externos_activos" ||
    segmento === "contactos_externos_todos" ||
    segmento === "usuarios_y_contactos_activos"
  ) {
    const { data: contactosData, error: contactosError } = await supabase
      .from("comunicacion_contactos")
      .select(
        "id, email, nombre, apellido, telefono, origen, etiquetas, activo, notas, created_at, updated_at"
      )
      .order("nombre", { ascending: true })

    if (contactosError) {
      throw new Error(
        `No se pudieron cargar contactos externos: ${contactosError.message}`
      )
    }

    const contactos = ((contactosData || []) as ContactoRow[])
      .map((contacto) => ({
        ...contacto,
        email: normalizarEmail(contacto.email),
      }))
      .filter((contacto) => contacto.email)

    const deduplicados = new Map<string, DestinatarioComunicacion>()

    if (segmento === "usuarios_y_contactos_activos") {
      for (const usuario of usuariosActivos) {
        const destinatario = destinatarioDesdeUsuario(
          usuario,
          "Usuario activo"
        )
        if (destinatario && !deduplicados.has(destinatario.email)) {
          deduplicados.set(destinatario.email, destinatario)
        }
      }
    }

    for (const contacto of contactos) {
      if (
        (segmento === "contactos_externos_activos" ||
          segmento === "usuarios_y_contactos_activos") &&
        contacto.activo === false
      ) {
        continue
      }

      const razon =
        contacto.activo === false
          ? "Contacto externo inactivo"
          : "Contacto externo activo"
      const destinatario = destinatarioDesdeContacto(contacto, razon)

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
  for (const usuario of usuariosActivos) {
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
    attachments: params.attachments,
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

export async function enviarConfirmacionSesionIndividual(
  params: EnviarConfirmacionSesionIndividualParams
) {
  const destinatarioEmail = normalizarEmail(params.destinatarioEmail)
  if (!destinatarioEmail) {
    throw new Error("Falta email del participante para enviar confirmación.")
  }

  const actividad = nombreActividadSesion(params.actividadSlug)
  const nombre = String(params.destinatarioNombre || "").trim() || "bienvenida/o"
  const fechaTexto = formatearFechaSesion(params.fecha)
  const horaTexto = formatearHoraSesion(params.hora)
  const duracionTexto = String(params.duracion || "60")
  const meetLink = normalizarMeetLink(params.meetLink)
  const linkPlataforma = `${appUrl()}${rutaActividadSesion(params.actividadSlug)}`

  const meetTexto = meetLink
    ? `Link de acceso: ${meetLink}`
    : "Te enviaremos el enlace de acceso antes del encuentro."

  const texto = [
    `Hola ${nombre},`,
    "",
    `Tu encuentro de ${actividad} quedó programado para:`,
    "",
    `Día: ${fechaTexto}`,
    `Hora: ${horaTexto} Argentina`,
    `Duración: ${duracionTexto} minutos`,
    "",
    meetTexto,
    "",
    "Podés ingresar también desde tu espacio en la plataforma:",
    linkPlataforma,
    "",
    "Si necesitás hacer alguna consulta, podés responder este correo.",
  ].join("\n")

  const meetHtml = meetLink
    ? `<p style="margin: 0;"><strong>Link de acceso:</strong> <a href="${meetLink}" style="color:#8a5b0f;">${meetLink}</a></p>`
    : `<p style="margin: 0;">Te enviaremos el enlace de acceso antes del encuentro.</p>`

  const html = `
    <div style="margin: 0; padding: 32px 16px; background: #f6efe2; font-family: Arial, sans-serif; color: #1f2933;">
      <div style="max-width: 640px; margin: 0 auto; background: #fffdf8; border: 1px solid #eadfc9; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(77, 54, 18, 0.08);">
        <div style="padding: 30px 32px 20px; background: linear-gradient(135deg, rgba(250,244,229,1) 0%, rgba(255,250,240,1) 55%, rgba(248,237,210,1) 100%);">
          <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a6a2f; font-weight: 700;">ENTHEOS</p>
          <h1 style="margin: 0 0 10px; font-size: 30px; line-height: 1.15; color: #18202a;">Confirmación de tu encuentro</h1>
          <p style="margin: 0; color: #6b7280; font-size: 16px; line-height: 1.5;">${escapeHtml(
            actividad
          )}</p>
        </div>

        <div style="padding: 28px 32px 32px; line-height: 1.7;">
          <p style="margin: 0 0 14px;">Hola ${escapeHtml(nombre)},</p>
          <p style="margin: 0 0 16px;">Tu encuentro de ${escapeHtml(
            actividad
          )} quedó programado para:</p>

          <div style="border: 1px solid #e5dccb; border-radius: 18px; padding: 18px 20px; margin: 0 0 22px; background: #fffaf2;">
            <p style="margin: 0 0 10px;"><strong>Día:</strong> ${escapeHtml(
              fechaTexto
            )}</p>
            <p style="margin: 0 0 10px;"><strong>Hora:</strong> ${escapeHtml(
              horaTexto
            )} Argentina</p>
            <p style="margin: 0;"><strong>Duración:</strong> ${escapeHtml(
              duracionTexto
            )} minutos</p>
          </div>

          <div style="border: 1px solid #ead9b4; border-radius: 18px; padding: 18px 20px; margin: 0 0 22px; background: #fff7ea;">
            ${meetHtml}
          </div>

          <p style="margin: 0 0 14px;">Podés ingresar también desde tu espacio en la plataforma:</p>
          <p style="margin: 0 0 22px;">
            <a href="${linkPlataforma}" style="display: inline-block; padding: 13px 20px; border-radius: 999px; background: #c98b1b; color: #ffffff; font-weight: 700; text-decoration: none;">
              Ir a la plataforma
            </a>
          </p>

          <p style="margin: 0;">Si necesitás hacer alguna consulta, podés responder este correo.</p>
        </div>
      </div>
    </div>
  `
  const ics = generarIcsSesionIndividual({
    ...params,
    destinatarioEmail,
    meetLink,
  })

  return enviarComunicacionIndividual({
    destinatarioEmail,
    destinatarioNombre: params.destinatarioNombre || null,
    asunto: "Confirmación de tu encuentro en ENTHEOS",
    html,
    texto,
    tipo: "confirmacion_sesion",
    actividadSlug: params.actividadSlug,
    attachments: [
      {
        filename: "encuentro-entheos.ics",
        content: base64Utf8(ics),
        content_type: "text/calendar; charset=utf-8",
      },
    ],
    metadata: {
      disponibilidadId: params.disponibilidadId || null,
      origen: "agenda",
      meetGenerado: Boolean(meetLink),
    },
  })
}

export async function enviarActualizacionSesionIndividual(
  params: EnviarActualizacionSesionIndividualParams
) {
  const destinatarioEmail = normalizarEmail(params.destinatarioEmail)
  if (!destinatarioEmail) {
    throw new Error("Falta email del participante para enviar actualización.")
  }

  const actividad = nombreActividadSesion(params.actividadSlug)
  const nombre = String(params.destinatarioNombre || "").trim() || "bienvenida/o"
  const fechaTexto = formatearFechaSesion(params.fecha)
  const horaTexto = formatearHoraSesion(params.hora)
  const duracionTexto = String(params.duracion || "60")
  const meetLink = normalizarMeetLink(params.meetLink)
  const linkPlataforma = `${appUrl()}${rutaActividadSesion(params.actividadSlug)}`

  const meetTexto = meetLink
    ? `Link de acceso actualizado: ${meetLink}`
    : "Podés revisar el acceso actualizado entrando a tu espacio en la plataforma."

  const texto = [
    `Hola ${nombre},`,
    "",
    `Tu encuentro de ${actividad} fue actualizado.`,
    "",
    `Día: ${fechaTexto}`,
    `Hora: ${horaTexto} Argentina`,
    `Duración: ${duracionTexto} minutos`,
    "",
    meetTexto,
    "",
    "Podés revisar la información completa desde tu espacio en la plataforma:",
    linkPlataforma,
  ].join("\n")

  const meetHtml = meetLink
    ? `<p style="margin: 0;"><strong>Link de acceso actualizado:</strong> <a href="${meetLink}" style="color:#8a5b0f;">${meetLink}</a></p>`
    : `<p style="margin: 0;">Podés revisar el acceso actualizado entrando a tu espacio en la plataforma.</p>`

  const html = `
    <div style="margin: 0; padding: 32px 16px; background: #f6efe2; font-family: Arial, sans-serif; color: #1f2933;">
      <div style="max-width: 640px; margin: 0 auto; background: #fffdf8; border: 1px solid #eadfc9; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(77, 54, 18, 0.08);">
        <div style="padding: 30px 32px 20px; background: linear-gradient(135deg, rgba(250,244,229,1) 0%, rgba(255,250,240,1) 55%, rgba(248,237,210,1) 100%);">
          <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a6a2f; font-weight: 700;">ENTHEOS</p>
          <h1 style="margin: 0 0 10px; font-size: 30px; line-height: 1.15; color: #18202a;">Actualización de tu encuentro</h1>
          <p style="margin: 0; color: #6b7280; font-size: 16px; line-height: 1.5;">${escapeHtml(
            actividad
          )}</p>
        </div>

        <div style="padding: 28px 32px 32px; line-height: 1.7;">
          <p style="margin: 0 0 14px;">Hola ${escapeHtml(nombre)},</p>
          <p style="margin: 0 0 16px;">Tu encuentro fue actualizado y ahora quedó programado así:</p>

          <div style="border: 1px solid #e5dccb; border-radius: 18px; padding: 18px 20px; margin: 0 0 22px; background: #fffaf2;">
            <p style="margin: 0 0 10px;"><strong>Día:</strong> ${escapeHtml(
              fechaTexto
            )}</p>
            <p style="margin: 0 0 10px;"><strong>Hora:</strong> ${escapeHtml(
              horaTexto
            )} Argentina</p>
            <p style="margin: 0;"><strong>Duración:</strong> ${escapeHtml(
              duracionTexto
            )} minutos</p>
          </div>

          <div style="border: 1px solid #ead9b4; border-radius: 18px; padding: 18px 20px; margin: 0 0 22px; background: #fff7ea;">
            ${meetHtml}
          </div>

          <p style="margin: 0 0 14px;">Podés revisar la información completa desde tu espacio en la plataforma:</p>
          <p style="margin: 0 0 22px;">
            <a href="${linkPlataforma}" style="display: inline-block; padding: 13px 20px; border-radius: 999px; background: #c98b1b; color: #ffffff; font-weight: 700; text-decoration: none;">
              Ir a la plataforma
            </a>
          </p>
        </div>
      </div>
    </div>
  `

  const ics = generarIcsSesionIndividual({
    ...params,
    destinatarioEmail,
    meetLink,
  })

  return enviarComunicacionIndividual({
    destinatarioEmail,
    destinatarioNombre: params.destinatarioNombre || null,
    asunto: "Actualización de tu encuentro en ENTHEOS",
    html,
    texto,
    tipo: "actualizacion_sesion",
    actividadSlug: params.actividadSlug,
    attachments: [
      {
        filename: "encuentro-entheos-actualizado.ics",
        content: base64Utf8(ics),
        content_type: "text/calendar; charset=utf-8",
      },
    ],
    metadata: {
      disponibilidadId: params.disponibilidadId || null,
      origen: "agenda",
      meetGenerado: Boolean(meetLink),
    },
  })
}

export async function enviarCancelacionSesionIndividual(
  params: EnviarCancelacionSesionIndividualParams
) {
  const destinatarioEmail = normalizarEmail(params.destinatarioEmail)
  if (!destinatarioEmail) {
    throw new Error("Falta email del participante para enviar cancelación.")
  }

  const actividad = nombreActividadSesion(params.actividadSlug)
  const nombre = String(params.destinatarioNombre || "").trim() || "bienvenida/o"
  const fechaTexto = formatearFechaSesion(params.fecha)
  const horaTexto = formatearHoraSesion(params.hora)
  const duracionTexto = String(params.duracion || "60")
  const linkPlataforma = `${appUrl()}${rutaActividadSesion(params.actividadSlug)}`

  const texto = [
    `Hola ${nombre},`,
    "",
    `Tu encuentro de ${actividad} fue cancelado.`,
    "",
    `Día: ${fechaTexto}`,
    `Hora: ${horaTexto} Argentina`,
    `Duración: ${duracionTexto} minutos`,
    "",
    "Si necesitás reprogramarlo, podés revisar tu espacio en la plataforma o responder este correo.",
    linkPlataforma,
  ].join("\n")

  const html = `
    <div style="margin: 0; padding: 32px 16px; background: #f6efe2; font-family: Arial, sans-serif; color: #1f2933;">
      <div style="max-width: 640px; margin: 0 auto; background: #fffdf8; border: 1px solid #eadfc9; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(77, 54, 18, 0.08);">
        <div style="padding: 30px 32px 20px; background: linear-gradient(135deg, rgba(250,244,229,1) 0%, rgba(255,250,240,1) 55%, rgba(248,237,210,1) 100%);">
          <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a6a2f; font-weight: 700;">ENTHEOS</p>
          <h1 style="margin: 0 0 10px; font-size: 30px; line-height: 1.15; color: #18202a;">Cancelación de tu encuentro</h1>
          <p style="margin: 0; color: #6b7280; font-size: 16px; line-height: 1.5;">${escapeHtml(
            actividad
          )}</p>
        </div>

        <div style="padding: 28px 32px 32px; line-height: 1.7;">
          <p style="margin: 0 0 14px;">Hola ${escapeHtml(nombre)},</p>
          <p style="margin: 0 0 16px;">Te avisamos que este encuentro fue cancelado:</p>

          <div style="border: 1px solid #e5dccb; border-radius: 18px; padding: 18px 20px; margin: 0 0 22px; background: #fffaf2;">
            <p style="margin: 0 0 10px;"><strong>Día:</strong> ${escapeHtml(
              fechaTexto
            )}</p>
            <p style="margin: 0 0 10px;"><strong>Hora:</strong> ${escapeHtml(
              horaTexto
            )} Argentina</p>
            <p style="margin: 0;"><strong>Duración:</strong> ${escapeHtml(
              duracionTexto
            )} minutos</p>
          </div>

          <p style="margin: 0 0 14px;">Si necesitás reprogramarlo, podés revisar tu espacio en la plataforma:</p>
          <p style="margin: 0 0 22px;">
            <a href="${linkPlataforma}" style="display: inline-block; padding: 13px 20px; border-radius: 999px; background: #c98b1b; color: #ffffff; font-weight: 700; text-decoration: none;">
              Ir a la plataforma
            </a>
          </p>

          <p style="margin: 0;">Si necesitás ayuda, podés responder este correo.</p>
        </div>
      </div>
    </div>
  `

  return enviarComunicacionIndividual({
    destinatarioEmail,
    destinatarioNombre: params.destinatarioNombre || null,
    asunto: "Cancelación de tu encuentro en ENTHEOS",
    html,
    texto,
    tipo: "cancelacion_sesion",
    actividadSlug: params.actividadSlug,
    metadata: {
      disponibilidadId: params.disponibilidadId || null,
      origen: "agenda",
    },
  })
}
