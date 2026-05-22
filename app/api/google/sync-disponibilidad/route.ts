import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { getGoogleCalendarClient } from "@/lib/google-calendar"
import { normalizarMeetLink } from "@/lib/meet-links"
import { calendar_v3 } from "googleapis"

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

export async function POST(req: NextRequest) {
  let disponibilidadId = 0
  const supabase = createAdminSupabaseClient()

  try {
    const auth = await requirePermission("agenda.manage")

    if ("response" in auth) {
      return auth.response
    }

    const body = await req.json()
    disponibilidadId = Number(body.disponibilidadId)

    if (!disponibilidadId) {
      return NextResponse.json(
        { error: "Falta disponibilidadId" },
        { status: 400 }
      )
    }

    const { data: disponibilidad, error: disponibilidadError } = await supabase
      .from("disponibilidades")
      .select("*")
      .eq("id", disponibilidadId)
      .single()

    if (disponibilidadError || !disponibilidad) {
      return NextResponse.json(
        { error: "No se encontró la disponibilidad" },
        { status: 404 }
      )
    }

    await supabase
      .from("disponibilidades")
      .update({ sync_status: "sincronizando" })
      .eq("id", disponibilidadId)

    const calendar = await getGoogleCalendarClient(auth.actor.email)

    const startDateTime = new Date(
      `${disponibilidad.fecha}T${disponibilidad.hora}:00`
    )
    const endDateTime = new Date(startDateTime)
    endDateTime.setMinutes(
      endDateTime.getMinutes() + Number(disponibilidad.duracion || 60)
    )

    const descripcion = [
      `Tipo: ${disponibilidad.tipo}`,
      `Duración: ${disponibilidad.duracion} min`,
      disponibilidad.requiere_pago
        ? `Precio: ${disponibilidad.precio}`
        : "Sin pago",
      disponibilidad.es_recurrente
        ? `Recurrente: ${disponibilidad.dia_semana || ""}`
        : "Disponibilidad única",
      disponibilidad.excepcion_fechas
        ? `Excepciones: ${disponibilidad.excepcion_fechas}`
        : "Sin excepciones",
      `Estado plataforma: ${disponibilidad.estado}`,
    ].join("\n")

    const requestBody = {
      summary: disponibilidad.titulo,
      description: descripcion,
      location: "Google Meet",
      start: {
        dateTime: startDateTime.toISOString(),
      },
      end: {
        dateTime: endDateTime.toISOString(),
      },
    }

    let googleEventId = disponibilidad.google_event_id || null
    const calendarId = disponibilidad.google_calendar_id || "primary"

    let meetLink = meetLinkReal(disponibilidad.meet_link)

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

      return NextResponse.json(
        {
          error:
            "Google Calendar respondió, pero no devolvió un Meet válido.",
          disponibilidadId,
          google_event_id: googleEventId,
          meet_link: meetLink,
          sync_status: "error",
        },
        { status: 502 }
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
      return NextResponse.json(
        {
          error: "Evento creado/actualizado, pero no se pudo guardar sync_status",
          detalle: updateError,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      disponibilidadId,
      meet_link: meetLink,
      google_event_id: googleEventId,
      sync_status: "sincronizado",
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)

    if (disponibilidadId) {
      try {
        await supabase
          .from("disponibilidades")
          .update({ sync_status: "error" })
          .eq("id", disponibilidadId)
      } catch (updateError) {
        console.error("No se pudo marcar sync_status=error", updateError)
      }
    }

    console.error("Error sincronizando disponibilidad con Google", {
      disponibilidadId,
      error: message,
    })

    return NextResponse.json(
      { error: message || "Error sincronizando con Google Calendar" },
      { status: 500 }
    )
  }
}
