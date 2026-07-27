import {
  listarEventosGoogleCalendarEnRango,
  type EventoGoogleCalendar,
} from "@/lib/google-calendar"
import { ESTADOS_DISPONIBILIDAD_ACTIVA } from "@/lib/disponibilidades"
import { obtenerPartesArgentina } from "@/lib/fechas"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

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
