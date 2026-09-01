import { NextRequest, NextResponse } from "next/server"
import { calendar_v3 } from "googleapis"
import { requirePermission } from "@/lib/authz"
import { ESTADOS_DISPONIBILIDAD_ACTIVA } from "@/lib/disponibilidades"
import {
  construirFechaHoraGoogle,
  getGoogleCalendarClient,
} from "@/lib/google-calendar"
import { normalizarMeetLink } from "@/lib/meet-links"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type DisponibilidadGoogle = {
  id: number
  titulo?: string | null
  tipo?: string | null
  fecha?: string | null
  hora?: string | null
  duracion?: string | null
  meet_link?: string | null
  requiere_pago?: boolean | null
  precio?: string | null
  estado?: string | null
  es_recurrente?: boolean | null
  dia_semana?: string | null
  excepcion_fechas?: string | null
  participante_email?: string | null
  participante_nombre?: string | null
  google_event_id?: string | null
  google_calendar_id?: string | null
  serie_id?: string | null
}

function formatearFechaIso(fecha: Date) {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, "0")
  const dia = String(fecha.getDate()).padStart(2, "0")
  return `${anio}-${mes}-${dia}`
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

function errorGoogleCalendar(error: string) {
  const mensaje = error.toLowerCase()

  if (
    mensaje.includes("no se encontró token de google calendar") ||
    mensaje.includes("google_calendar_owner_email") ||
    mensaje.includes("invalid_grant") ||
    mensaje.includes("unauthorized")
  ) {
    return {
      error:
        "No hay una cuenta de Google Calendar conectada para generar el Meet. Conectá la cuenta configurada o cargá un Meet manual.",
      necesitaConexionGoogle: true,
    }
  }

  return {
    error: error || "Error sincronizando con Google Calendar",
    necesitaConexionGoogle: false,
  }
}

async function sincronizarDisponibilidad(params: {
  calendar: calendar_v3.Calendar
  supabase: ReturnType<typeof createAdminSupabaseClient>
  disponibilidad: DisponibilidadGoogle
}) {
  const { calendar, supabase, disponibilidad } = params
  const disponibilidadId = disponibilidad.id

  if (!disponibilidad.fecha || !disponibilidad.hora) {
    throw new Error("El encuentro no tiene fecha u hora configurada.")
  }

  await supabase
    .from("disponibilidades")
    .update({ sync_status: "sincronizando" })
    .eq("id", disponibilidadId)

  const intervaloGoogle = construirFechaHoraGoogle(
    disponibilidad.fecha,
    disponibilidad.hora,
    disponibilidad.duracion || "60"
  )

  const descripcion = [
    `Tipo: ${disponibilidad.tipo || ""}`,
    `Duración: ${disponibilidad.duracion || "60"} min`,
    disponibilidad.requiere_pago
      ? `Precio: ${disponibilidad.precio || ""}`
      : "Sin pago",
    disponibilidad.es_recurrente
      ? `Recurrente: ${disponibilidad.dia_semana || ""}`
      : "Disponibilidad única",
    disponibilidad.excepcion_fechas
      ? `Excepciones: ${disponibilidad.excepcion_fechas}`
      : "Sin excepciones",
    `Estado plataforma: ${disponibilidad.estado || ""}`,
  ].join("\n")

  const requestBody = {
    summary: disponibilidad.titulo || "Encuentro",
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
  let meetLink = normalizarMeetLink(disponibilidad.meet_link)

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
    meetLink = normalizarMeetLink(extractMeetLink(insertRes.data, meetLink))
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
      normalizarMeetLink(extractMeetLink(updateRes.data)) ||
      normalizarMeetLink(extractMeetLink(existingEvent.data, meetLink))
  }

  if (!googleEventId || !meetLink) {
    throw new Error("Google Calendar respondió, pero no devolvió un Meet válido.")
  }

  const { error } = await supabase
    .from("disponibilidades")
    .update({
      meet_link: meetLink,
      google_event_id: googleEventId,
      google_calendar_id: calendarId,
      sync_status: "sincronizado",
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", disponibilidadId)

  if (error) {
    throw new Error("Evento creado/actualizado, pero no se pudo guardar sync_status.")
  }

  return {
    disponibilidadId,
    meet_link: meetLink,
    google_event_id: googleEventId,
  }
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabaseClient()

  try {
    const auth = await requirePermission("agenda.manage")

    if ("response" in auth) {
      return auth.response
    }

    const body = await req.json()
    const disponibilidadId = Number(body.disponibilidadId)

    if (!disponibilidadId) {
      return NextResponse.json(
        { error: "Falta disponibilidadId." },
        { status: 400 }
      )
    }

    const { data: base, error: baseError } = await supabase
      .from("disponibilidades")
      .select("*")
      .eq("id", disponibilidadId)
      .single()

    if (baseError || !base) {
      return NextResponse.json(
        { error: "No se encontró el encuentro." },
        { status: 404 }
      )
    }

    const disponibilidadBase = base as DisponibilidadGoogle

    if (!disponibilidadBase.serie_id) {
      return NextResponse.json(
        {
          error:
            "Esta programación no tiene identificador de serie. Sólo se puede sincronizar este encuentro.",
        },
        { status: 409 }
      )
    }

    const hoyIso = formatearFechaIso(new Date())
    const fechaInicioSerie =
      String(disponibilidadBase.fecha || "") < hoyIso
        ? hoyIso
        : disponibilidadBase.fecha || hoyIso

    const { data: serie, error: serieError } = await supabase
      .from("disponibilidades")
      .select("*")
      .eq("serie_id", disponibilidadBase.serie_id)
      .gte("fecha", fechaInicioSerie)
      .in("estado", ESTADOS_DISPONIBILIDAD_ACTIVA)
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true })

    if (serieError) {
      return NextResponse.json(
        {
          error: "No se pudo cargar la serie futura.",
          detalle: serieError.message,
        },
        { status: 500 }
      )
    }

    const disponibilidades = (serie || []) as DisponibilidadGoogle[]

    if (disponibilidades.length === 0) {
      return NextResponse.json(
        { error: "No hay encuentros futuros activos en esta serie." },
        { status: 404 }
      )
    }

    let calendar: calendar_v3.Calendar

    try {
      calendar = await getGoogleCalendarClient(auth.actor.email)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const respuesta = errorGoogleCalendar(message)

      await supabase
        .from("disponibilidades")
        .update({ sync_status: "error" })
        .in(
          "id",
          disponibilidades.map((item) => item.id)
        )

      return NextResponse.json(respuesta, { status: 500 })
    }

    const errores: Array<{ disponibilidadId: number; error: string }> = []
    const sincronizados: Array<{
      disponibilidadId: number
      meet_link: string
      google_event_id: string
    }> = []

    for (const disponibilidad of disponibilidades) {
      try {
        const resultado = await sincronizarDisponibilidad({
          calendar,
          supabase,
          disponibilidad,
        })

        sincronizados.push({
          disponibilidadId: resultado.disponibilidadId,
          meet_link: resultado.meet_link,
          google_event_id: resultado.google_event_id,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        errores.push({
          disponibilidadId: disponibilidad.id,
          error: message,
        })

        await supabase
          .from("disponibilidades")
          .update({ sync_status: "error" })
          .eq("id", disponibilidad.id)
      }
    }

    return NextResponse.json({
      ok: errores.length === 0,
      sincronizados: sincronizados.length,
      errores: errores.length,
      omitidos: 0,
      detalleErrores: errores,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno sincronizando la serie con Google Calendar.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
