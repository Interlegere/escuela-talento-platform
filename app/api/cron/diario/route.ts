import { NextResponse } from "next/server"
import { obtenerPartesArgentina } from "@/lib/fechas"

async function llamarInterno(origin: string, path: string, cronSecret: string) {
  try {
    const res = await fetch(`${origin}${path}`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  } catch (error) {
    return { status: 500, error: String(error) }
  }
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = req.headers.get("authorization")

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const origin = new URL(req.url).origin
    const ahora = new Date()
    const partes = obtenerPartesArgentina(ahora)
    const diaSemana = new Date(
      Date.UTC(partes.year, partes.month - 1, partes.day)
    ).getUTCDay()

    const resultados: Record<string, unknown> = {}

    // Comunicaciones programadas: se revisa todos los días. Al correr una
    // sola vez por día (límite de crons del plan de Vercel), la "hora"
    // elegida al programar un envío no se respeta al minuto: si ya pasó ese
    // horario en el día, se envía en la corrida del día siguiente.
    resultados.comunicacionesProgramadas = await llamarInterno(
      origin,
      "/api/comunicaciones/procesar-programadas",
      cronSecret
    )

    // Reintento de encuentros que quedaron sin sincronizar con Google
    // Calendar (pendiente/error/sincronizando trabado): la sincronización
    // normal solo se dispara al tocar un botón en /agenda, así que sin este
    // reintento diario un fallo puntual queda así para siempre en silencio.
    resultados.reintentoSyncGoogle = await llamarInterno(
      origin,
      "/api/agenda/admin/reintentar-sync-pendientes",
      cronSecret
    )

    // Limpieza de videos antiguos de CasaTalentos: solo los domingos
    // (antes corría con su propio cron semanal).
    if (diaSemana === 0) {
      resultados.limpiezaCasaTalentos = await llamarInterno(
        origin,
        "/api/casatalentos/limpiar-antiguos",
        cronSecret
      )
    }

    // Generación de cobros mensuales: solo el día 1 de cada mes
    // (antes corría con su propio cron mensual).
    if (partes.day === 1) {
      resultados.cobrosMensuales = await llamarInterno(
        origin,
        "/api/pagos-mensuales/generar-cobros-mensuales",
        cronSecret
      )
    }

    // Agente de Entusiasmento: se llama todos los días, decide adentro si
    // hoy corresponde enviar según el calendario alternado (ver
    // lib/agente-entusiasmo-calendario.ts) — igual patrón que comunicaciones
    // programadas, arriba.
    resultados.agenteEntusiasmoDiario = await llamarInterno(
      origin,
      "/api/entusiasmo/agente/diario",
      cronSecret
    )

    // Tareas semanales recurrentes: mantiene el horizonte de ocurrencias
    // generadas de cada serie activa (para que nunca falte la "próxima"),
    // se revisa todos los días.
    resultados.tareasRecurrentes = await llamarInterno(
      origin,
      "/api/entusiasmo/tareas/generar-ocurrencias",
      cronSecret
    )

    return NextResponse.json({
      ok: true,
      fecha: ahora.toISOString(),
      diaSemana,
      diaDelMes: partes.day,
      resultados,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno en el cron diario", detalle: String(error) },
      { status: 500 }
    )
  }
}
