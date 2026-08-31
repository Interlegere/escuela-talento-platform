import {
  obtenerClienteCalendarParticipante,
  tieneGoogleConectado,
} from "@/lib/entusiasmo-google-participante"
import { enviarEmail } from "@/lib/mailing"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type SupabaseAdminClient = ReturnType<typeof createAdminSupabaseClient>

// Cuánto dura, en minutos, el evento que se crea en el calendario de la
// persona por cada tarea — las tareas no tienen duración propia, así que se
// usa un bloque corto fijo, suficiente para un recordatorio puntual.
const DURACION_MINUTOS = 30

type TareaParaIcs = {
  id: number
  contenido: string
  fecha: string | null
  hora: string | null
  completada: boolean
  calendario_ics_sequence: number
  calendario_sincronizado_at: string | null
  calendario_google_event_id?: string | null
}

function calcularInicioFin(tarea: { fecha: string | null; hora: string | null }) {
  // La columna es "time" en Postgres — vuelve como "HH:MM:SS", no "HH:MM"
  // (mismo detalle ya resuelto para esto mismo en convertirFechaHoraArgentinaAZona,
  // lib/fechas.ts). Agregar ":00" sin chequear duplicaría los segundos.
  const horaCompleta = (tarea.hora as string).length === 5 ? `${tarea.hora}:00` : tarea.hora
  const inicio = new Date(`${tarea.fecha}T${horaCompleta}-03:00`)
  const fin = new Date(inicio.getTime() + DURACION_MINUTOS * 60 * 1000)
  return { inicio, fin }
}

function plegarLinea(linea: string) {
  // RFC 5545: las líneas de más de 75 octetos se pliegan con un salto de
  // línea seguido de un espacio. Sin esto, un contenido de tarea largo
  // podría generar un .ics inválido para lectores estrictos.
  const bytes = Buffer.byteLength(linea, "utf8")
  if (bytes <= 75) return linea

  const partes: string[] = []
  let resto = linea

  while (Buffer.byteLength(resto, "utf8") > 74) {
    let corte = 74
    while (Buffer.byteLength(resto.slice(0, corte), "utf8") > 74) corte -= 1
    partes.push(resto.slice(0, corte))
    resto = resto.slice(corte)
  }
  partes.push(resto)

  return partes.join("\r\n ")
}

function escaparTextoIcs(valor: string) {
  return valor
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

function formatearFechaUtcIcs(fecha: Date) {
  return fecha.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
}

function uidTarea(tareaId: number) {
  return `entusiasmo-tarea-${tareaId}@entheosescuela.com`
}

function construirIcs(params: {
  tarea: TareaParaIcs
  sequence: number
  metodo: "REQUEST" | "CANCEL"
  organizerEmail: string
  participanteEmail: string
  participanteNombre: string
}) {
  const { tarea, sequence, metodo, organizerEmail, participanteEmail, participanteNombre } = params
  const { inicio, fin } = calcularInicioFin(tarea)
  const ahora = formatearFechaUtcIcs(new Date())
  const status = metodo === "CANCEL" ? "CANCELLED" : "CONFIRMED"

  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ENTHEOS//Entusiasmento//ES",
    "CALSCALE:GREGORIAN",
    `METHOD:${metodo}`,
    "BEGIN:VEVENT",
    `UID:${uidTarea(tarea.id)}`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${ahora}`,
    `DTSTART:${formatearFechaUtcIcs(inicio)}`,
    `DTEND:${formatearFechaUtcIcs(fin)}`,
    `SUMMARY:${escaparTextoIcs(tarea.contenido)}`,
    "DESCRIPTION:Tarea de Entusiasmento — ENTHEOS",
    `ORGANIZER;CN=ENTHEOS:mailto:${organizerEmail}`,
    `ATTENDEE;CN=${escaparTextoIcs(participanteNombre)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${participanteEmail}`,
    `STATUS:${status}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]

  return lineas.map(plegarLinea).join("\r\n")
}

async function mandarInvitacion(params: {
  tarea: TareaParaIcs
  sequence: number
  metodo: "REQUEST" | "CANCEL"
  participanteEmail: string
  participanteNombre: string
}) {
  const organizerEmail = process.env.MAIL_FROM || process.env.RESEND_FROM || ""
  if (!organizerEmail) {
    return { enviado: false as const, motivo: "Falta MAIL_FROM/RESEND_FROM en el entorno." }
  }

  const ics = construirIcs({ ...params, organizerEmail })
  const esCancelacion = params.metodo === "CANCEL"
  const subject = esCancelacion
    ? `Cancelada: ${params.tarea.contenido}`
    : `Entusiasmento: ${params.tarea.contenido}`
  const text = esCancelacion
    ? `Se canceló esta tarea de tu calendario: ${params.tarea.contenido}`
    : `Tarea de Entusiasmento agendada en tu calendario: ${params.tarea.contenido}`
  const html = `<p>${text}</p>`

  const resultado = await enviarEmail({
    to: params.participanteEmail,
    subject,
    text,
    html,
    attachments: [
      {
        filename: "tarea.ics",
        content: Buffer.from(ics, "utf8").toString("base64"),
        content_type: `text/calendar; charset=UTF-8; method=${params.metodo}`,
      },
    ],
  })

  if (!resultado.enviado) {
    console.warn(
      "No se pudo enviar la invitación de calendario de la tarea:",
      params.tarea.id,
      resultado.motivo
    )
  }

  return resultado
}

// Crea o actualiza el evento directo en el calendario propio del
// participante (ya conectado por OAuth) — a diferencia de la invitación por
// mail, esto no pasa por Resend ni pide ningún click: el evento aparece
// solo, porque se está escribiendo con el propio permiso de esa persona en
// SU calendario, no invitándola a uno ajeno.
async function crearOActualizarEventoDirecto(
  calendar: Awaited<ReturnType<typeof obtenerClienteCalendarParticipante>>,
  tarea: TareaParaIcs
): Promise<string | null> {
  if (!calendar) return null

  const { inicio, fin } = calcularInicioFin(tarea)
  const requestBody = {
    summary: tarea.contenido,
    description: "Tarea de Entusiasmento — ENTHEOS",
    start: { dateTime: inicio.toISOString() },
    end: { dateTime: fin.toISOString() },
  }

  try {
    if (tarea.calendario_google_event_id) {
      const { data } = await calendar.events.update({
        calendarId: "primary",
        eventId: tarea.calendario_google_event_id,
        requestBody,
      })
      return data.id || tarea.calendario_google_event_id
    }

    const { data } = await calendar.events.insert({ calendarId: "primary", requestBody })
    return data.id || null
  } catch (error) {
    console.warn("No se pudo crear/actualizar el evento directo de la tarea:", tarea.id, error)
    return null
  }
}

async function borrarEventoDirecto(
  calendar: Awaited<ReturnType<typeof obtenerClienteCalendarParticipante>>,
  eventId: string
) {
  if (!calendar) return

  try {
    await calendar.events.delete({ calendarId: "primary", eventId })
  } catch (error) {
    // Si la persona ya lo había borrado a mano desde Google Calendar, no es
    // un error real — igual queda registrado por si hace falta revisar.
    console.warn("No se pudo borrar el evento directo de calendario:", eventId, error)
  }
}

// Mantiene el calendario personal de la persona al día con una tarea
// puntual: la crea/actualiza si tiene fecha y hora y sigue pendiente, la
// cancela si se completó, se le sacó la fecha/hora, o se borró. Nunca tira
// — un fallo acá no debe romper la operación real sobre la tarea (mismo
// criterio que el resto de los mails transaccionales del proyecto).
export async function sincronizarTareaEnCalendario(
  supabase: SupabaseAdminClient,
  tareaId: number
) {
  try {
    const { data: tarea } = await supabase
      .from("entusiasmo_tareas")
      .select(
        "id, contenido, fecha, hora, completada, proyecto_id, calendario_ics_sequence, calendario_sincronizado_at, calendario_google_event_id"
      )
      .eq("id", tareaId)
      .maybeSingle<TareaParaIcs & { proyecto_id: number }>()

    if (!tarea) return

    const { data: proyecto } = await supabase
      .from("entusiasmo_proyectos")
      .select("participante_email, participante_nombre")
      .eq("id", tarea.proyecto_id)
      .maybeSingle<{ participante_email: string; participante_nombre: string | null }>()

    if (!proyecto?.participante_email) return

    const participanteNombre = proyecto.participante_nombre || proyecto.participante_email
    const debeEstarEnCalendario = Boolean(tarea.fecha && tarea.hora && !tarea.completada)

    // Si la persona ya conectó su propio Google, se escribe directo en SU
    // calendario (crear/actualizar/borrar el evento por API) — instantáneo,
    // sin mail ni click de por medio. Si no conectó todavía, sigue el
    // camino anterior (invitación por mail) como respaldo automático.
    if (await tieneGoogleConectado(proyecto.participante_email)) {
      const calendar = await obtenerClienteCalendarParticipante(proyecto.participante_email)

      if (!debeEstarEnCalendario) {
        if (tarea.calendario_google_event_id) {
          await borrarEventoDirecto(calendar, tarea.calendario_google_event_id)
          await supabase
            .from("entusiasmo_tareas")
            .update({ calendario_google_event_id: null })
            .eq("id", tareaId)
        }
        return
      }

      const eventId = await crearOActualizarEventoDirecto(calendar, tarea)

      if (eventId) {
        await supabase
          .from("entusiasmo_tareas")
          .update({ calendario_google_event_id: eventId })
          .eq("id", tareaId)
      }

      return
    }

    const yaSincronizada = Boolean(tarea.calendario_sincronizado_at)

    if (!debeEstarEnCalendario) {
      if (!yaSincronizada) return

      const resultado = await mandarInvitacion({
        tarea,
        sequence: tarea.calendario_ics_sequence + 1,
        metodo: "CANCEL",
        participanteEmail: proyecto.participante_email,
        participanteNombre,
      })

      // Solo se marca como cancelada si el mail realmente salió — si Resend
      // falla, mejor seguir mostrándola como "sincronizada" (con la
      // invitación vieja todavía activa en su calendario) que darla por
      // cancelada sin haber mandado nada.
      if (resultado.enviado) {
        await supabase
          .from("entusiasmo_tareas")
          .update({
            calendario_ics_sequence: tarea.calendario_ics_sequence + 1,
            calendario_sincronizado_at: null,
          })
          .eq("id", tareaId)
      }

      return
    }

    // "yaSincronizada" (calendario_sincronizado_at) solo dice si la
    // invitación está viva AHORA MISMO — una tarea que se canceló (por
    // completarse y después destildarse, por ejemplo) vuelve a null pero
    // calendario_ics_sequence queda en el número que ya se usó para esa
    // cancelación. Reenviarla con ese mismo número sería un duplicado a
    // ojos de un cliente de calendario estricto — hay que seguir subiendo
    // el número en cualquier envío que no sea el primero de todos.
    const yaSeMandoAlgunaVez = yaSincronizada || tarea.calendario_ics_sequence > 0
    const nuevaSequence = yaSeMandoAlgunaVez
      ? tarea.calendario_ics_sequence + 1
      : tarea.calendario_ics_sequence

    const resultado = await mandarInvitacion({
      tarea,
      sequence: nuevaSequence,
      metodo: "REQUEST",
      participanteEmail: proyecto.participante_email,
      participanteNombre,
    })

    if (resultado.enviado) {
      await supabase
        .from("entusiasmo_tareas")
        .update({
          calendario_ics_sequence: nuevaSequence,
          calendario_sincronizado_at: new Date().toISOString(),
        })
        .eq("id", tareaId)
    }
  } catch (error) {
    console.warn("No se pudo sincronizar la tarea al calendario:", tareaId, error)
  }
}

// Para "esta y las próximas": hay que mandar la cancelación ANTES de borrar
// las filas (una vez borradas ya no queda de dónde leer fecha/hora/nombre
// del participante para armar el .ics de cancelación).
export async function cancelarTareasEnCalendario(
  supabase: SupabaseAdminClient,
  tareaIds: number[]
) {
  for (const id of tareaIds) {
    await sincronizarTareaEnCalendarioComoCancelada(supabase, id)
  }
}

async function sincronizarTareaEnCalendarioComoCancelada(
  supabase: SupabaseAdminClient,
  tareaId: number
) {
  try {
    const { data: tarea } = await supabase
      .from("entusiasmo_tareas")
      .select(
        "id, contenido, fecha, hora, completada, proyecto_id, calendario_ics_sequence, calendario_sincronizado_at, calendario_google_event_id"
      )
      .eq("id", tareaId)
      .maybeSingle<TareaParaIcs & { proyecto_id: number }>()

    if (!tarea) return

    const { data: proyecto } = await supabase
      .from("entusiasmo_proyectos")
      .select("participante_email, participante_nombre")
      .eq("id", tarea.proyecto_id)
      .maybeSingle<{ participante_email: string; participante_nombre: string | null }>()

    if (!proyecto?.participante_email) return

    if (await tieneGoogleConectado(proyecto.participante_email)) {
      if (tarea.calendario_google_event_id) {
        const calendar = await obtenerClienteCalendarParticipante(proyecto.participante_email)
        await borrarEventoDirecto(calendar, tarea.calendario_google_event_id)
      }
      return
    }

    if (!tarea.calendario_sincronizado_at) return

    await mandarInvitacion({
      tarea,
      sequence: tarea.calendario_ics_sequence + 1,
      metodo: "CANCEL",
      participanteEmail: proyecto.participante_email,
      participanteNombre: proyecto.participante_nombre || proyecto.participante_email,
    })
  } catch (error) {
    console.warn("No se pudo cancelar la tarea en el calendario:", tareaId, error)
  }
}
