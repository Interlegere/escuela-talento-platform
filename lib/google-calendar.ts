import { calendar_v3, google } from "googleapis"
import { createClient } from "@supabase/supabase-js"
import { normalizarMeetLink } from "@/lib/meet-links"

type Disponibilidad = {
  id: number
  titulo: string
  tipo: string
  fecha: string
  hora: string
  duracion: string
  meet_link: string
  requiere_pago: boolean
  precio: string
  estado: string
  participante_email?: string | null
  participante_nombre?: string | null
  google_event_id?: string | null
  google_calendar_id?: string | null
}

type Reserva = {
  id: number
  disponibilidad_id: number
  estado: string
  participante_nombre: string
  participante_email?: string | null
  participante_telefono?: string | null
  participante_mensaje?: string | null
  monto: string
  moneda: string
  mp_payment_id?: string | null
  mp_status?: string | null
  google_event_id?: string | null
  google_calendar_id?: string | null
}

type GoogleCalendarTokenRow = {
  id: number
  user_email?: string | null
  access_token?: string | null
  refresh_token?: string | null
  scope?: string | null
  token_type?: string | null
  expiry_date?: string | null
}

export type GoogleCalendarConnectionStatus = {
  expectedAccount: string | null
  connectedAccount: string | null
  storedAccount: string | null
  latestStoredAccount: string | null
  connected: boolean
  mismatch: boolean
  hasRefreshToken: boolean
  expiryDate: string | null
  warning: string | null
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Faltan variables de entorno de Supabase admin")
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey)
}

export function getConfiguredGoogleCalendarOwnerEmail() {
  return String(process.env.GOOGLE_CALENDAR_OWNER_EMAIL || "")
    .trim()
    .toLowerCase()
}

const GOOGLE_CALENDAR_TIME_ZONE =
  process.env.GOOGLE_CALENDAR_TIME_ZONE || "America/Argentina/Cordoba"

function formatearFechaHoraLocalGoogle(fecha: string, hora: string, sumarMinutos = 0) {
  const [anio, mes, dia] = fecha.split("-").map(Number)
  const [horas, minutos, segundos] = hora.split(":").map(Number)
  const fechaUtc = new Date(
    Date.UTC(
      anio,
      (mes || 1) - 1,
      dia || 1,
      horas || 0,
      minutos || 0,
      segundos || 0
    )
  )

  fechaUtc.setUTCMinutes(fechaUtc.getUTCMinutes() + sumarMinutos)

  const y = fechaUtc.getUTCFullYear()
  const m = String(fechaUtc.getUTCMonth() + 1).padStart(2, "0")
  const d = String(fechaUtc.getUTCDate()).padStart(2, "0")
  const h = String(fechaUtc.getUTCHours()).padStart(2, "0")
  const min = String(fechaUtc.getUTCMinutes()).padStart(2, "0")
  const sec = String(fechaUtc.getUTCSeconds()).padStart(2, "0")

  return `${y}-${m}-${d}T${h}:${min}:${sec}`
}

export function construirFechaHoraGoogle(
  fecha: string,
  hora: string,
  duracionMinutos: string | number
) {
  const duracion = Number(duracionMinutos || 60)

  return {
    start: {
      dateTime: formatearFechaHoraLocalGoogle(fecha, hora),
      timeZone: GOOGLE_CALENDAR_TIME_ZONE,
    },
    end: {
      dateTime: formatearFechaHoraLocalGoogle(fecha, hora, duracion),
      timeZone: GOOGLE_CALENDAR_TIME_ZONE,
    },
  }
}

async function buscarTokenGoogleCalendarPorEmail(email: string) {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_email", email)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data || null) as GoogleCalendarTokenRow | null
}

async function buscarUltimoTokenGoogleCalendar() {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data || null) as GoogleCalendarTokenRow | null
}

function construirOauth2Client(tokenRow?: GoogleCalendarTokenRow | null) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  if (tokenRow) {
    oauth2Client.setCredentials({
      access_token: tokenRow.access_token || undefined,
      refresh_token: tokenRow.refresh_token || undefined,
    })
  }

  return oauth2Client
}

export async function resolverGoogleAccountEmailDesdeCalendar(
  oauth2Client: InstanceType<typeof google.auth.OAuth2>
) {
  const calendar = google.calendar({
    version: "v3",
    auth: oauth2Client,
  })

  const primaryCalendar = await calendar.calendarList.get({
    calendarId: "primary",
  })

  const realEmail = String(primaryCalendar.data.id || "")
    .trim()
    .toLowerCase()

  if (!realEmail) {
    throw new Error(
      "Google no devolvió el email real de la cuenta autenticada."
    )
  }

  return realEmail
}

async function obtenerTokenGoogleCalendar(userEmail?: string) {
  const configuredOwnerEmail = getConfiguredGoogleCalendarOwnerEmail()
  const emailNormalizado = (configuredOwnerEmail || userEmail || "")
    .trim()
    .toLowerCase()

  if (emailNormalizado) {
    const tokenPreferido = await buscarTokenGoogleCalendarPorEmail(
      emailNormalizado
    )

    if (tokenPreferido) {
      return tokenPreferido
    }

    const cuentaEsperada = configuredOwnerEmail || emailNormalizado
    throw new Error(
      `No se encontró token de Google Calendar para la cuenta configurada: ${cuentaEsperada}`
    )
  }

  return null
}

export async function getGoogleCalendarClient(userEmail?: string) {
  const tokenRow = await obtenerTokenGoogleCalendar(userEmail)

  if (!tokenRow) {
    throw new Error("No se encontró token de Google Calendar")
  }

  const oauth2Client = construirOauth2Client(tokenRow)

  oauth2Client.on("tokens", async (tokens) => {
    try {
      const updatePayload: Record<string, string> = {}

      if (tokens.access_token) {
        updatePayload.access_token = tokens.access_token
      }

      if (tokens.refresh_token) {
        updatePayload.refresh_token = tokens.refresh_token
      }

      if (tokens.scope) {
        updatePayload.scope = tokens.scope
      }

      if (tokens.token_type) {
        updatePayload.token_type = tokens.token_type
      }

      if (tokens.expiry_date) {
        updatePayload.expiry_date = String(tokens.expiry_date)
      }

      if (Object.keys(updatePayload).length > 0) {
        await getSupabaseAdmin()
          .from("google_calendar_tokens")
          .update(updatePayload)
          .eq("id", tokenRow.id)
      }
    } catch (error) {
      console.error("No se pudo actualizar el token de Google Calendar", error)
    }
  })

  return google.calendar({
    version: "v3",
    auth: oauth2Client,
  })
}

export async function getGoogleCalendarConnectionStatus(): Promise<GoogleCalendarConnectionStatus> {
  const expectedAccount = getConfiguredGoogleCalendarOwnerEmail() || null
  const exactToken = expectedAccount
    ? await buscarTokenGoogleCalendarPorEmail(expectedAccount)
    : null
  const latestToken = await buscarUltimoTokenGoogleCalendar()

  let connectedAccount: string | null = null
  let warning: string | null = null

  if (exactToken) {
    try {
      connectedAccount = await resolverGoogleAccountEmailDesdeCalendar(
        construirOauth2Client(exactToken)
      )
    } catch (error) {
      warning =
        error instanceof Error
          ? error.message
          : "No se pudo verificar la cuenta conectada en Google."
    }
  }

  const storedAccount = String(exactToken?.user_email || "")
    .trim()
    .toLowerCase() || null
  const latestStoredAccount = String(latestToken?.user_email || "")
    .trim()
    .toLowerCase() || null
  const cuentaConectada = connectedAccount || storedAccount
  const mismatch = Boolean(
    expectedAccount &&
      latestStoredAccount &&
      latestStoredAccount !== expectedAccount &&
      !exactToken
  )

  if (!warning && mismatch) {
    warning = `Hay tokens guardados para ${latestStoredAccount}, pero ENTHEOS espera ${expectedAccount}.`
  }

  return {
    expectedAccount,
    connectedAccount: cuentaConectada,
    storedAccount,
    latestStoredAccount,
    connected: Boolean(exactToken),
    mismatch,
    hasRefreshToken: Boolean(exactToken?.refresh_token),
    expiryDate: exactToken?.expiry_date || null,
    warning,
  }
}

function buildMeetConferenceData(
  existingConferenceData?: calendar_v3.Schema$ConferenceData | null
) {
  if (existingConferenceData) {
    return existingConferenceData
  }

  return {
    createRequest: {
      requestId: crypto.randomUUID(),
      conferenceSolutionKey: {
        type: "hangoutsMeet",
      },
    },
  }
}

function extractMeetLink(
  event?: calendar_v3.Schema$Event | null,
  fallback?: string | null
) {
  const byHangoutLink = event?.hangoutLink?.trim()

  if (byHangoutLink) {
    return byHangoutLink
  }

  const byEntryPoint = event?.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === "video" && entry.uri
  )?.uri

  if (byEntryPoint?.trim()) {
    return byEntryPoint.trim()
  }

  return fallback || null
}

function meetLinkReal(meetLink?: string | null) {
  return normalizarMeetLink(meetLink)
}

function construirAttendees(
  email?: string | null,
  nombre?: string | null
): calendar_v3.Schema$EventAttendee[] | undefined {
  const emailNormalizado = String(email || "").trim().toLowerCase()

  if (!emailNormalizado) {
    return undefined
  }

  return [
    {
      email: emailNormalizado,
      displayName: nombre?.trim() || undefined,
    },
  ]
}

export async function sincronizarDisponibilidadConGoogle(params: {
  disponibilidadId: number
  actorEmail?: string
}) {
  const { disponibilidadId, actorEmail } = params
  const supabase = getSupabaseAdmin()

  const { data: disponibilidadData, error: disponibilidadError } = await supabase
    .from("disponibilidades")
    .select("*")
    .eq("id", disponibilidadId)
    .single()

  const disponibilidad = disponibilidadData as Disponibilidad | null

  if (disponibilidadError || !disponibilidad) {
    throw new Error("No se encontró la disponibilidad")
  }

  await supabase
    .from("disponibilidades")
    .update({ sync_status: "sincronizando" })
    .eq("id", disponibilidadId)

  const calendar = await getGoogleCalendarClient(actorEmail)
  const intervaloGoogle = construirFechaHoraGoogle(
    disponibilidad.fecha,
    disponibilidad.hora,
    disponibilidad.duracion
  )

  const descripcion = [
    `Tipo: ${disponibilidad.tipo}`,
    `Duración: ${disponibilidad.duracion} min`,
    disponibilidad.requiere_pago
      ? `Precio: ${disponibilidad.precio}`
      : "Sin pago",
    `Estado plataforma: ${disponibilidad.estado}`,
  ].join("\n")

  const requestBody = {
    summary: disponibilidad.titulo,
    description: descripcion,
    location: "Google Meet",
    start: intervaloGoogle.start,
    end: intervaloGoogle.end,
    attendees: construirAttendees(
      disponibilidad.participante_email,
      disponibilidad.participante_nombre
    ),
  }

  let googleEventId = disponibilidad.google_event_id || null
  const calendarId = disponibilidad.google_calendar_id || "primary"
  let meetLink = meetLinkReal(disponibilidad.meet_link)

  if (!googleEventId) {
    const insertRes = await calendar.events.insert({
      calendarId,
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: {
        ...requestBody,
        conferenceData: buildMeetConferenceData(),
      },
    })

    googleEventId = insertRes.data.id || null
    meetLink = meetLinkReal(extractMeetLink(insertRes.data, meetLink))
  } else {
    const existingEvent = await calendar.events.get({
      calendarId,
      eventId: googleEventId,
    })

    const updateRes = await calendar.events.update({
      calendarId,
      eventId: googleEventId,
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: {
        ...requestBody,
        conferenceData: buildMeetConferenceData(
          existingEvent.data.conferenceData
        ),
      },
    })

    meetLink =
      meetLinkReal(extractMeetLink(updateRes.data)) ||
      meetLinkReal(extractMeetLink(existingEvent.data, meetLink))
  }

  if (!googleEventId || !meetLink) {
    await supabase
      .from("disponibilidades")
      .update({ sync_status: "error" })
      .eq("id", disponibilidadId)

    throw new Error(
      "Google Calendar respondió, pero no devolvió un Meet válido."
    )
  }

  const ahora = new Date().toISOString()

  const { error: updateError } = await supabase
    .from("disponibilidades")
    .update({
      meet_link: meetLink,
      google_event_id: googleEventId,
      google_calendar_id: calendarId,
      sync_status: "sincronizado",
      last_synced_at: ahora,
    })
    .eq("id", disponibilidadId)

  if (updateError) {
    throw new Error(
      "Evento creado/actualizado, pero no se pudo guardar sync_status"
    )
  }

  return {
    disponibilidadId,
    meet_link: meetLink,
    google_event_id: googleEventId,
    sync_status: "sincronizado" as const,
  }
}

export async function cancelarDisponibilidadEnGoogle(params: {
  disponibilidadId: number
  actorEmail?: string
}) {
  const { disponibilidadId, actorEmail } = params
  const supabase = getSupabaseAdmin()

  const { data: disponibilidadData, error: disponibilidadError } = await supabase
    .from("disponibilidades")
    .select("id, google_event_id, google_calendar_id")
    .eq("id", disponibilidadId)
    .single()

  if (disponibilidadError || !disponibilidadData) {
    throw new Error("No se encontró la disponibilidad")
  }

  const googleEventId = String(disponibilidadData.google_event_id || "").trim()
  const calendarId =
    String(disponibilidadData.google_calendar_id || "").trim() || "primary"

  if (googleEventId) {
    const calendar = await getGoogleCalendarClient(actorEmail)
    await calendar.events.delete({
      calendarId,
      eventId: googleEventId,
    })
  }

  await supabase
    .from("disponibilidades")
    .update({
      sync_status: "sincronizado",
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", disponibilidadId)

  return {
    disponibilidadId,
    google_event_id: googleEventId || null,
    cancelado: true,
  }
}

export type EventoGoogleCalendar = {
  id: string
  titulo: string
  inicio: string | null
  fin: string | null
  esDiaCompleto: boolean
  cancelado: boolean
}

export async function listarEventosGoogleCalendarEnRango(params: {
  timeMinISO: string
  timeMaxISO: string
  calendarId?: string
  actorEmail?: string
}): Promise<EventoGoogleCalendar[]> {
  const { timeMinISO, timeMaxISO, calendarId, actorEmail } = params
  const calendar = await getGoogleCalendarClient(actorEmail)

  const { data } = await calendar.events.list({
    calendarId: calendarId || "primary",
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  })

  return (data.items || []).map((event) => ({
    id: String(event.id || ""),
    titulo: event.summary || "(Sin título)",
    inicio: event.start?.dateTime || event.start?.date || null,
    fin: event.end?.dateTime || event.end?.date || null,
    esDiaCompleto: Boolean(event.start?.date && !event.start?.dateTime),
    cancelado: event.status === "cancelled",
  }))
}

export async function crearEventoGoogleDesdeReserva(params: {
  reserva: Reserva
  disponibilidad: Disponibilidad
  googleOwnerEmail?: string
}) {
  const { reserva, disponibilidad, googleOwnerEmail } = params

  const supabase = getSupabaseAdmin()
  const calendar = await getGoogleCalendarClient(googleOwnerEmail)

  const intervaloGoogle = construirFechaHoraGoogle(
    disponibilidad.fecha,
    disponibilidad.hora,
    disponibilidad.duracion
  )

  const descripcion = [
    "Reserva confirmada desde plataforma",
    `Reserva ID: ${reserva.id}`,
    `Disponibilidad ID: ${disponibilidad.id}`,
    `Tipo: ${disponibilidad.tipo}`,
    `Participante: ${reserva.participante_nombre}`,
    reserva.participante_email
      ? `Email: ${reserva.participante_email}`
      : null,
    reserva.participante_telefono
      ? `Teléfono: ${reserva.participante_telefono}`
      : null,
    reserva.participante_mensaje
      ? `Mensaje: ${reserva.participante_mensaje}`
      : null,
    `Duración: ${disponibilidad.duracion} min`,
    disponibilidad.requiere_pago
      ? `Pago: ${reserva.monto} ${reserva.moneda}`
      : "Sin pago",
    reserva.mp_payment_id ? `MP Payment ID: ${reserva.mp_payment_id}` : null,
    reserva.mp_status ? `MP Status: ${reserva.mp_status}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  const requestBody = {
    summary: `${disponibilidad.titulo} - ${reserva.participante_nombre}`,
    description: descripcion,
    location: "Google Meet",
    start: intervaloGoogle.start,
    end: intervaloGoogle.end,
    attendees: construirAttendees(
      reserva.participante_email,
      reserva.participante_nombre
    ),
  }

  let googleEventId =
    reserva.google_event_id || disponibilidad.google_event_id || null

  const calendarId =
    reserva.google_calendar_id ||
    disponibilidad.google_calendar_id ||
    "primary"

  let meetLink = disponibilidad.meet_link || null

  if (!googleEventId) {
    const insertRes = await calendar.events.insert({
      calendarId,
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: {
        ...requestBody,
        conferenceData: buildMeetConferenceData(),
      },
    })

    googleEventId = insertRes.data.id || null
    meetLink = extractMeetLink(insertRes.data, meetLink)
  } else {
    const existingEvent = await calendar.events.get({
      calendarId,
      eventId: googleEventId,
    })

    const updateRes = await calendar.events.update({
      calendarId,
      eventId: googleEventId,
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: {
        ...requestBody,
        conferenceData: buildMeetConferenceData(
          existingEvent.data.conferenceData
        ),
      },
    })

    meetLink =
      extractMeetLink(updateRes.data) ||
      extractMeetLink(existingEvent.data, meetLink)
  }

  const ahora = new Date().toISOString()

  const { error: reservaUpdateError } = await supabase
    .from("reservas")
    .update({
      google_event_id: googleEventId,
      google_calendar_id: calendarId,
      updated_at: ahora,
    })
    .eq("id", reserva.id)

  if (reservaUpdateError) {
    throw new Error("No se pudo guardar google_event_id en reservas")
  }

  const { error: disponibilidadUpdateError } = await supabase
    .from("disponibilidades")
    .update({
      meet_link: meetLink,
      google_event_id: googleEventId,
      google_calendar_id: calendarId,
      sync_status: "sincronizado",
      last_synced_at: ahora,
    })
    .eq("id", disponibilidad.id)

  if (disponibilidadUpdateError) {
    throw new Error("No se pudo guardar google_event_id en disponibilidades")
  }

  return {
    meet_link: meetLink,
    google_event_id: googleEventId,
    google_calendar_id: calendarId,
  }
}
