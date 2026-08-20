import { obtenerFechaISOArgentina } from "@/lib/fechas"
import { otorgarPuntoTareaSiCorresponde } from "@/lib/entusiasmo-puntos"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type SupabaseAdminClient = ReturnType<typeof createAdminSupabaseClient>

// Cuántas semanas adelante se mantienen generadas las ocurrencias de una
// serie activa — ni tan poco que se quede sin la "próxima", ni tanto que
// se generen decenas de filas de una.
const SEMANAS_ADELANTE = 8

function aFechaUTC(fechaISO: string) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia))
}

function aFechaISO(fecha: Date) {
  return fecha.toISOString().slice(0, 10)
}

// Próximas `cantidad` fechas (incluido hoy si coincide) en las que cae
// `diaSemana` (0=domingo..6=sábado), a partir de `desde`.
export function calcularProximasFechas(
  diaSemana: number,
  cantidad: number,
  desde: string = obtenerFechaISOArgentina()
) {
  const fechas: string[] = []
  const cursor = aFechaUTC(desde)
  const diferencia = (diaSemana - cursor.getUTCDay() + 7) % 7
  cursor.setUTCDate(cursor.getUTCDate() + diferencia)

  for (let i = 0; i < cantidad; i++) {
    fechas.push(aFechaISO(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }

  return fechas
}

export async function generarOcurrenciasIniciales(
  supabase: SupabaseAdminClient,
  serie: {
    id: number
    proyecto_id: number
    contenido: string
    dia_semana: number
    hora: string | null
    prioridad: string | null
  },
  participanteEmail: string
) {
  const fechas = calcularProximasFechas(serie.dia_semana, SEMANAS_ADELANTE)

  const { error } = await supabase.from("entusiasmo_tareas").insert(
    fechas.map((fecha) => ({
      proyecto_id: serie.proyecto_id,
      contenido: serie.contenido,
      fecha,
      hora: serie.hora,
      prioridad: serie.prioridad,
      serie_id: serie.id,
    }))
  )

  if (error) {
    throw error
  }

  await otorgarPuntoTareaSiCorresponde(supabase, participanteEmail, "creada")
}

// Para cada serie activa, si la última ocurrencia generada queda a menos
// de SEMANAS_ADELANTE de hoy, genera más para volver a completar el
// horizonte — mismo patrón de "reintento diario" ya usado en el proyecto
// para no depender de que alguien vuelva a tocar un botón.
export async function completarHorizonteDeSeries(supabase: SupabaseAdminClient) {
  const hoy = obtenerFechaISOArgentina()
  const limiteHorizonte = aFechaISO(
    (() => {
      const fecha = aFechaUTC(hoy)
      fecha.setUTCDate(fecha.getUTCDate() + SEMANAS_ADELANTE * 7)
      return fecha
    })()
  )

  const { data: series, error: seriesError } = await supabase
    .from("entusiasmo_tareas_series")
    .select("id, proyecto_id, contenido, dia_semana, hora, prioridad, entusiasmo_proyectos!inner(participante_email)")
    .eq("activa", true)

  if (seriesError) {
    throw seriesError
  }

  let seriesCompletadas = 0

  for (const serie of series || []) {
    const { data: ultimaOcurrencia } = await supabase
      .from("entusiasmo_tareas")
      .select("fecha")
      .eq("serie_id", serie.id)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle()

    const ultimaFecha = ultimaOcurrencia?.fecha as string | undefined

    if (ultimaFecha && ultimaFecha >= limiteHorizonte) {
      continue
    }

    // SEMANAS_ADELANTE acá es solo una cota superior de cuántas fechas
    // semanales podrían hacer falta (nunca hacen falta más para volver a
    // completar un horizonte de esa misma extensión) — el corte real de
    // cuántas se generan lo da el filtro por `limiteHorizonte` de abajo,
    // así el top-up completa solo el faltante y no duplica el horizonte
    // entero cada vez que se lo llama.
    const fechas = calcularProximasFechas(
      serie.dia_semana,
      SEMANAS_ADELANTE,
      ultimaFecha
        ? aFechaISO(
            (() => {
              const fecha = aFechaUTC(ultimaFecha)
              fecha.setUTCDate(fecha.getUTCDate() + 1)
              return fecha
            })()
          )
        : hoy
    ).filter((fecha) => (!ultimaFecha || fecha > ultimaFecha) && fecha <= limiteHorizonte)

    if (fechas.length === 0) continue

    const { error: insertError } = await supabase.from("entusiasmo_tareas").insert(
      fechas.map((fecha) => ({
        proyecto_id: serie.proyecto_id,
        contenido: serie.contenido,
        fecha,
        hora: serie.hora,
        prioridad: serie.prioridad,
        serie_id: serie.id,
      }))
    )

    if (insertError) {
      console.warn("No se pudo completar el horizonte de una serie de tareas:", insertError)
      continue
    }

    const participanteEmail = (
      serie as unknown as { entusiasmo_proyectos: { participante_email: string } }
    ).entusiasmo_proyectos.participante_email

    await otorgarPuntoTareaSiCorresponde(supabase, participanteEmail, "creada")
    seriesCompletadas += 1
  }

  return { seriesRevisadas: (series || []).length, seriesCompletadas }
}

// "Esta y las próximas": borra esta ocurrencia y las futuras ya generadas
// de la misma serie, y desactiva la serie para que no se generen más.
export async function cancelarSerieDesdeOcurrencia(
  supabase: SupabaseAdminClient,
  serieId: number,
  fechaDesde: string
) {
  const { error: deleteError } = await supabase
    .from("entusiasmo_tareas")
    .delete()
    .eq("serie_id", serieId)
    .gte("fecha", fechaDesde)

  if (deleteError) {
    throw deleteError
  }

  const { error: desactivarError } = await supabase
    .from("entusiasmo_tareas_series")
    .update({ activa: false })
    .eq("id", serieId)

  if (desactivarError) {
    throw desactivarError
  }
}
