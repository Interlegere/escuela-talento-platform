import { NextResponse } from "next/server"
import {
  calcularProximaEjecucion,
  type Recurrencia,
} from "@/lib/comunicaciones-programadas"
import {
  ejecutarEnvioMasivo,
  listarDestinatariosSegmento,
  type FiltroPagoPendiente,
  type SegmentoComunicacion,
} from "@/lib/comunicaciones"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type ProgramacionRow = {
  id: number
  nombre: string
  tipo: string
  actividad_slug: string | null
  asunto: string
  contenido: string
  segmento: SegmentoComunicacion
  filtro_pago_pendiente: FiltroPagoPendiente | null
  emails_manual: string | null
  destinatarios_seleccionados: Array<{ email?: string | null; fuente?: string | null }> | null
  recurrencia: Recurrencia
  fecha_una_vez: string | null
  dia_semana: number | null
  dia_mes: number | null
  intervalo_dias: number | null
  hora: string
  modo_disparo: "automatico" | "requiere_aprobacion"
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = req.headers.get("authorization")

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const supabase = createAdminSupabaseClient()
    const ahora = new Date()

    const { data: pendientes, error } = await supabase
      .from("comunicaciones_programadas")
      .select(
        "id, nombre, tipo, actividad_slug, asunto, contenido, segmento, filtro_pago_pendiente, emails_manual, destinatarios_seleccionados, recurrencia, fecha_una_vez, dia_semana, dia_mes, intervalo_dias, hora, modo_disparo"
      )
      .eq("activo", true)
      .eq("pendiente_aprobacion", false)
      .lte("proxima_ejecucion", ahora.toISOString())

    if (error) {
      return NextResponse.json(
        { error: "No se pudieron cargar las programaciones", detalle: error },
        { status: 500 }
      )
    }

    const procesadas: Array<{
      id: number
      nombre: string
      accion: "enviado" | "pendiente_aprobacion" | "error"
      resumen?: { enviados: number; errores: number; total: number }
      motivo?: string
    }> = []

    for (const programacion of (pendientes as ProgramacionRow[] | null) || []) {
      if (programacion.modo_disparo === "requiere_aprobacion") {
        await supabase
          .from("comunicaciones_programadas")
          .update({ pendiente_aprobacion: true, updated_at: ahora.toISOString() })
          .eq("id", programacion.id)

        procesadas.push({
          id: programacion.id,
          nombre: programacion.nombre,
          accion: "pendiente_aprobacion",
        })
        continue
      }

      try {
        const resultado = await listarDestinatariosSegmento({
          segmento: programacion.segmento,
          emailsManual: programacion.emails_manual || "",
          destinatariosSeleccionados: programacion.destinatarios_seleccionados || [],
          filtroPagoPendiente: programacion.filtro_pago_pendiente || "todos",
        })

        if (resultado.deshabilitado) {
          throw new Error(resultado.motivo || "Segmento no disponible.")
        }

        const resumen = await ejecutarEnvioMasivo({
          destinatarios: resultado.destinatarios,
          asunto: programacion.asunto,
          texto: programacion.contenido,
          html: null,
          tipo: programacion.tipo,
          actividadSlug: programacion.actividad_slug,
          segmento: programacion.segmento,
          origenMetadata: "comunicaciones_programadas",
        })

        const actualizacion: Record<string, unknown> = {
          ultima_ejecucion_at: ahora.toISOString(),
          updated_at: ahora.toISOString(),
        }

        if (programacion.recurrencia === "una_vez") {
          actualizacion.activo = false
        } else {
          actualizacion.proxima_ejecucion = calcularProximaEjecucion(
            {
              recurrencia: programacion.recurrencia,
              fechaUnaVez: programacion.fecha_una_vez,
              diaSemana: programacion.dia_semana,
              diaMes: programacion.dia_mes,
              intervaloDias: programacion.intervalo_dias,
              hora: programacion.hora,
              ultimaEjecucionAt: ahora.toISOString(),
            },
            ahora
          ).toISOString()
        }

        await supabase
          .from("comunicaciones_programadas")
          .update(actualizacion)
          .eq("id", programacion.id)

        procesadas.push({
          id: programacion.id,
          nombre: programacion.nombre,
          accion: "enviado",
          resumen: {
            enviados: resumen.enviados,
            errores: resumen.errores,
            total: resumen.total,
          },
        })
      } catch (procesoError) {
        procesadas.push({
          id: programacion.id,
          nombre: programacion.nombre,
          accion: "error",
          motivo:
            procesoError instanceof Error
              ? procesoError.message
              : String(procesoError),
        })
      }
    }

    return NextResponse.json({
      ok: true,
      fecha: ahora.toISOString(),
      procesadas,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno procesando comunicaciones programadas",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
