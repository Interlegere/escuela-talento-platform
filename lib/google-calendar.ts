import { calendar_v3, google } from "googleapis"
import { createClient } from "@supabase/supabase-js"

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

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Faltan variables de entorno de Supabase admin")
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey)
}

function getConfiguredGoogleCalendarOwnerEmail() {
  return String(process.env.GOOGLE_CALENDAR_OWNER_EMAIL || "")
    .trim()
    .toLowerCase()
}

async function obtenerTokenGoogleCalendar(userEmail?: string) {
  const supabase = getSupabaseAdmin()

  const configuredOwnerEmail = getConfiguredGoogleCalendarOwnerEmail()
  const emailNormalizado = (
    configuredOwnerEmail ||
    userEmail ||
    ""
  )
    .trim()
    .toLowerCase()

  const consultaBase = supabase
    .from("google_calendar_tokens")
    .select("*")
    .order("id", { ascending: false })
    .limit(1)

  const { data: tokenPreferido, error: tokenPreferidoError } = emailNormalizado
    ? await consultaBase.eq("user_email", emailNormalizado).maybeSingle()
    : await consultaBase.maybeSingle()

  if (tokenPreferidoError) {
    throw tokenPreferidoError
  }

  if (tokenPreferido) {
    return tokenPreferido
  }

  if (configuredOwnerEmail) {
    throw new Error(
      `No se encontró token de Google Calendar para la cuenta configurada: ${configuredOwnerEmail}`
    )
  }

  if (emailNormalizado) {
    return null
  }

  const { data: tokenFallback, error: tokenFallbackError } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (tokenFallbackError) {
    throw tokenFallbackError
  }

  return tokenFallback || null
}

export async function getGoogleCalendarClient(userEmail?: string) {
  const tokenRow = await obtenerTokenGoogleCalendar(userEmail)

  if (!tokenRow) {
    throw new Error("No se encontró token de Google Calendar")
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  oauth2Client.setCredentials({
    access_token: tokenRow.access_token || undefined,
    refresh_token: tokenRow.refresh_token || undefined,
  })

  return google.calendar({
    version: "v3",
    auth: oauth2Client,
  })
}

function buildStartEnd(fecha: string, hora: string, duracion: string) {
  const startDateTime = new Date(`${fecha}T${hora}:00`)
  const endDateTime = new Date(startDateTime)
  endDateTime.setMinutes(endDateTime.getMinutes() + Number(duracion || 60))

  return {
    startDateTime,
    endDateTime,
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

export async function crearEventoGoogleDesdeReserva(params: {
  reserva: Reserva
  disponibilidad: Disponibilidad
  googleOwnerEmail?: string
}) {
  const { reserva, disponibilidad, googleOwnerEmail } = params

  const supabase = getSupabaseAdmin()
  const calendar = await getGoogleCalendarClient(googleOwnerEmail)

  const { startDateTime, endDateTime } = buildStartEnd(
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
    start: {
      dateTime: startDateTime.toISOString(),
    },
    end: {
      dateTime: endDateTime.toISOString(),
    },
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
