import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
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

type Accion = "pausar" | "reanudar" | "eliminar" | "aprobar_y_enviar"

type Body = {
  id?: number
  accion?: Accion
}

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
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const id = Number(body.id)
    const accion = body.accion

    if (!id || !accion) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios (id o accion)." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    if (accion === "pausar" || accion === "reanudar") {
      const { error } = await supabase
        .from("comunicaciones_programadas")
        .update({
          activo: accion === "reanudar",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      if (error) {
        return NextResponse.json(
          { error: "No se pudo actualizar la programación.", detalle: error },
          { status: 500 }
        )
      }

      return NextResponse.json({ ok: true, id, accion })
    }

    if (accion === "eliminar") {
      const { error } = await supabase
        .from("comunicaciones_programadas")
        .delete()
        .eq("id", id)

      if (error) {
        return NextResponse.json(
          { error: "No se pudo eliminar la programación.", detalle: error },
          { status: 500 }
        )
      }

      return NextResponse.json({ ok: true, id, accion })
    }

    if (accion === "aprobar_y_enviar") {
      const { data: programacionData, error: fetchError } = await supabase
        .from("comunicaciones_programadas")
        .select(
          "id, nombre, tipo, actividad_slug, asunto, contenido, segmento, filtro_pago_pendiente, emails_manual, destinatarios_seleccionados, recurrencia, fecha_una_vez, dia_semana, dia_mes, intervalo_dias, hora"
        )
        .eq("id", id)
        .single()

      if (fetchError || !programacionData) {
        return NextResponse.json(
          { error: "No se encontró la programación.", detalle: fetchError },
          { status: 404 }
        )
      }

      const programacion = programacionData as ProgramacionRow

      const resultado = await listarDestinatariosSegmento({
        segmento: programacion.segmento,
        emailsManual: programacion.emails_manual || "",
        destinatariosSeleccionados: programacion.destinatarios_seleccionados || [],
        filtroPagoPendiente: programacion.filtro_pago_pendiente || "todos",
      })

      if (resultado.deshabilitado) {
        return NextResponse.json(
          { error: resultado.motivo || "Segmento no disponible." },
          { status: 400 }
        )
      }

      const resumen = await ejecutarEnvioMasivo({
        destinatarios: resultado.destinatarios,
        asunto: programacion.asunto,
        texto: programacion.contenido,
        html: null,
        tipo: programacion.tipo,
        actividadSlug: programacion.actividad_slug,
        segmento: programacion.segmento,
        enviadoPor: auth.actor.email,
        origenMetadata: "comunicaciones_programadas_aprobado",
      })

      const ahora = new Date()
      const actualizacion: Record<string, unknown> = {
        ultima_ejecucion_at: ahora.toISOString(),
        pendiente_aprobacion: false,
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

      const { error: updateError } = await supabase
        .from("comunicaciones_programadas")
        .update(actualizacion)
        .eq("id", id)

      if (updateError) {
        return NextResponse.json(
          {
            error: "El envío se realizó, pero no se pudo actualizar la programación.",
            detalle: updateError,
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ok: true,
        id,
        accion,
        resumen: {
          enviados: resumen.enviados,
          errores: resumen.errores,
          total: resumen.total,
        },
      })
    }

    return NextResponse.json({ error: "Acción inválida." }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno ejecutando la acción sobre la programación.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
