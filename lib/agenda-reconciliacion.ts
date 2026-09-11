import {
  listarEventosGoogleCalendarEnRango,
  type EventoGoogleCalendar,
} from "@/lib/google-calendar"
import { ESTADOS_DISPONIBILIDAD_ACTIVA } from "@/lib/disponibilidades"
import { obtenerPartesArgentina } from "@/lib/fechas"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { enviarActualizacionSesionIndividual } from "@/lib/comunicaciones"

type DisponibilidadReconciliacionRow = {
  id: number
  titulo: string
  actividad_slug?: string | null
  fecha: string
  hora: string
  estado: string
  google_event_id?: string | null
  google_calendar_id?: string | null
}

export type EventoSoloEnGoogle = {
  eventoId: string
  titulo: string
  fecha: string | null
  hora: string | null
}

export type DisponibilidadSoloEnPlataforma = {
  disponibilidadId: number
  titulo: string
  actividadSlug: string | null
  fecha: string
  hora: string
}

function partesDesdeIso(iso: string) {
  const fecha = new Date(iso)

  if (Number.isNaN(fecha.getTime())) {
    return null
  }

  const partes = obtenerPartesArgentina(fecha)

  return {
    fecha: `${partes.year}-${String(partes.month).padStart(2, "0")}-${String(
      partes.day
    ).padStart(2, "0")}`,
    hora: `${String(partes.hour).padStart(2, "0")}:${String(
      partes.minute
    ).padStart(2, "0")}`,
  }
}

function sumarDias(fechaBase: string, dias: number) {
  const [anio, mes, dia] = fechaBase.split("-").map(Number)
  const fecha = new Date(Date.UTC(anio, (mes || 1) - 1, dia || 1))
  fecha.setUTCDate(fecha.getUTCDate() + dias)

  const y = fecha.getUTCFullYear()
  const m = String(fecha.getUTCMonth() + 1).padStart(2, "0")
  const d = String(fecha.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export async function compararAgendaConGoogle(params?: {
  diasAtras?: number
  diasAdelante?: number
}) {
  const diasAtras = params?.diasAtras ?? 3
  const diasAdelante = params?.diasAdelante ?? 21

  const hoyPartes = obtenerPartesArgentina()
  const hoy = `${hoyPartes.year}-${String(hoyPartes.month).padStart(
    2,
    "0"
  )}-${String(hoyPartes.day).padStart(2, "0")}`
  const desde = sumarDias(hoy, -diasAtras)
  const hasta = sumarDias(hoy, diasAdelante)

  const supabase = createAdminSupabaseClient()

  const { data: disponibilidadesData, error: disponibilidadesError } =
    await supabase
      .from("disponibilidades")
      .select(
        "id, titulo, actividad_slug, fecha, hora, estado, google_event_id, google_calendar_id"
      )
      .in("actividad_slug", [
        "casatalentos",
        "conectando-sentidos",
        "mentorias",
        "terapia",
      ])
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true })

  if (disponibilidadesError) {
    throw new Error(
      `No se pudieron cargar las disponibilidades: ${disponibilidadesError.message}`
    )
  }

  const disponibilidades = (
    (disponibilidadesData as DisponibilidadReconciliacionRow[] | null) || []
  ).filter((item) =>
    ESTADOS_DISPONIBILIDAD_ACTIVA.includes(
      item.estado as (typeof ESTADOS_DISPONIBILIDAD_ACTIVA)[number]
    )
  )

  const eventos = await listarEventosGoogleCalendarEnRango({
    timeMinISO: `${desde}T00:00:00-03:00`,
    timeMaxISO: `${hasta}T23:59:59-03:00`,
  })

  const eventosActivos = eventos.filter((evento) => !evento.cancelado)
  const eventosPorId = new Map<string, EventoGoogleCalendar>(
    eventosActivos.map((evento) => [evento.id, evento])
  )
  const eventosPorFechaHora = new Map<string, EventoGoogleCalendar>()

  for (const evento of eventosActivos) {
    if (!evento.inicio || evento.esDiaCompleto) continue

    const partes = partesDesdeIso(evento.inicio)
    if (!partes) continue

    eventosPorFechaHora.set(`${partes.fecha}|${partes.hora}`, evento)
  }

  const eventosMatcheados = new Set<string>()
  const disponibilidadesSoloEnPlataforma: DisponibilidadSoloEnPlataforma[] = []

  for (const disponibilidad of disponibilidades) {
    let evento: EventoGoogleCalendar | undefined

    if (disponibilidad.google_event_id) {
      evento = eventosPorId.get(disponibilidad.google_event_id)
    }

    if (!evento) {
      evento = eventosPorFechaHora.get(
        `${disponibilidad.fecha}|${disponibilidad.hora}`
      )
    }

    if (evento) {
      eventosMatcheados.add(evento.id)
      continue
    }

    disponibilidadesSoloEnPlataforma.push({
      disponibilidadId: disponibilidad.id,
      titulo: disponibilidad.titulo,
      actividadSlug: disponibilidad.actividad_slug || null,
      fecha: disponibilidad.fecha,
      hora: disponibilidad.hora,
    })
  }

  const eventosSoloEnGoogle: EventoSoloEnGoogle[] = eventosActivos
    .filter((evento) => !eventosMatcheados.has(evento.id))
    .map((evento) => {
      const partes = evento.inicio ? partesDesdeIso(evento.inicio) : null

      return {
        eventoId: evento.id,
        titulo: evento.titulo,
        fecha: partes?.fecha || (evento.esDiaCompleto ? evento.inicio : null),
        hora: evento.esDiaCompleto ? null : partes?.hora || null,
      }
    })

  return {
    rango: { desde, hasta },
    soloEnGoogle: eventosSoloEnGoogle,
    soloEnPlataforma: disponibilidadesSoloEnPlataforma,
  }
}

type DisponibilidadSincronizacionRow = {
  id: number
  titulo: string
  actividad_slug: string | null
  fecha: string
  hora: string
  duracion: string | null
  estado: string
  meet_link: string | null
  google_event_id: string | null
  participante_email: string | null
  participante_nombre: string | null
}

export type CambioAgendaDesdeGoogle = {
  disponibilidadId: number
  titulo: string
  actividadSlug: string | null
  fechaAnterior: string
  horaAnterior: string
  fechaNueva: string
  horaNueva: string
  mailEnviado: boolean
  mailError?: string
}

// El sentido inverso de compararAgendaConGoogle: no solo reporta la
// diferencia, la corrige — si Nicolás reprograma un encuentro directo en
// Google Calendar (mismo evento, otra fecha/hora), la plataforma sigue el
// cambio sola. A propósito, solo reprograma fecha/hora/duración — nunca
// cancela ni crea nada acá (eso lo sigue manejando el flujo normal desde
// la plataforma); cancelar un encuentro en Google no lo cancela acá,
// queda pendiente como una mejora aparte si hace falta más adelante.
export async function sincronizarFechasDesdeGoogle(params?: {
  diasAtras?: number
  diasAdelante?: number
}) {
  const diasAtras = params?.diasAtras ?? 1
  const diasAdelante = params?.diasAdelante ?? 60

  const hoyPartes = obtenerPartesArgentina()
  const hoy = `${hoyPartes.year}-${String(hoyPartes.month).padStart(
    2,
    "0"
  )}-${String(hoyPartes.day).padStart(2, "0")}`
  const desde = sumarDias(hoy, -diasAtras)
  const hasta = sumarDias(hoy, diasAdelante)

  const supabase = createAdminSupabaseClient()

  const { data: disponibilidadesData, error: disponibilidadesError } =
    await supabase
      .from("disponibilidades")
      .select(
        "id, titulo, actividad_slug, fecha, hora, duracion, estado, meet_link, google_event_id, participante_email, participante_nombre"
      )
      .in("actividad_slug", [
        "casatalentos",
        "conectando-sentidos",
        "mentorias",
        "terapia",
      ])
      .not("google_event_id", "is", null)
      .gte("fecha", desde)
      .lte("fecha", hasta)

  if (disponibilidadesError) {
    throw new Error(
      `No se pudieron cargar las disponibilidades: ${disponibilidadesError.message}`
    )
  }

  const disponibilidades = (
    (disponibilidadesData as DisponibilidadSincronizacionRow[] | null) || []
  ).filter((item) =>
    ESTADOS_DISPONIBILIDAD_ACTIVA.includes(
      item.estado as (typeof ESTADOS_DISPONIBILIDAD_ACTIVA)[number]
    )
  )

  if (disponibilidades.length === 0) {
    return { rango: { desde, hasta }, cambios: [] as CambioAgendaDesdeGoogle[] }
  }

  const eventos = await listarEventosGoogleCalendarEnRango({
    timeMinISO: `${desde}T00:00:00-03:00`,
    timeMaxISO: `${hasta}T23:59:59-03:00`,
  })

  const eventosPorId = new Map<string, EventoGoogleCalendar>(
    eventos.filter((evento) => !evento.cancelado).map((evento) => [evento.id, evento])
  )

  const cambios: CambioAgendaDesdeGoogle[] = []

  for (const disponibilidad of disponibilidades) {
    if (!disponibilidad.google_event_id) continue

    const evento = eventosPorId.get(disponibilidad.google_event_id)
    if (!evento || !evento.inicio || evento.esDiaCompleto) continue

    const partes = partesDesdeIso(evento.inicio)
    if (!partes) continue

    if (partes.fecha === disponibilidad.fecha && partes.hora === disponibilidad.hora) {
      continue
    }

    let duracionNueva = disponibilidad.duracion
    if (evento.fin) {
      const inicioMs = new Date(evento.inicio).getTime()
      const finMs = new Date(evento.fin).getTime()
      if (!Number.isNaN(inicioMs) && !Number.isNaN(finMs) && finMs > inicioMs) {
        duracionNueva = String(Math.round((finMs - inicioMs) / 60000))
      }
    }

    const { error: updateError } = await supabase
      .from("disponibilidades")
      .update({ fecha: partes.fecha, hora: partes.hora, duracion: duracionNueva })
      .eq("id", disponibilidad.id)

    if (updateError) continue

    const cambio: CambioAgendaDesdeGoogle = {
      disponibilidadId: disponibilidad.id,
      titulo: disponibilidad.titulo,
      actividadSlug: disponibilidad.actividad_slug,
      fechaAnterior: disponibilidad.fecha,
      horaAnterior: disponibilidad.hora,
      fechaNueva: partes.fecha,
      horaNueva: partes.hora,
      mailEnviado: false,
    }

    if (
      (disponibilidad.actividad_slug === "terapia" ||
        disponibilidad.actividad_slug === "mentorias") &&
      disponibilidad.participante_email
    ) {
      try {
        const resultado = await enviarActualizacionSesionIndividual({
          disponibilidadId: disponibilidad.id,
          destinatarioEmail: disponibilidad.participante_email,
          destinatarioNombre: disponibilidad.participante_nombre || null,
          actividadSlug: disponibilidad.actividad_slug,
          fecha: partes.fecha,
          hora: partes.hora,
          duracion: duracionNueva || "60",
          meetLink: disponibilidad.meet_link || null,
        })
        cambio.mailEnviado = resultado.resultado.enviado === true
      } catch (mailError) {
        cambio.mailError =
          mailError instanceof Error ? mailError.message : String(mailError)
      }
    }

    cambios.push(cambio)
  }

  return { rango: { desde, hasta }, cambios }
}
