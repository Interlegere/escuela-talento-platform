import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { enviarResolucionPagoIndividual } from "@/lib/comunicaciones"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  pagoMensualId: number
  accion: "aprobar" | "rechazar"
  observacionesAdmin?: string
}

function periodoTexto(anio?: number | null, mes?: number | null) {
  if (!anio || !mes) return null
  return `${String(mes).padStart(2, "0")}/${anio}`
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("pagos.review")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()

    const { pagoMensualId, accion, observacionesAdmin } = body

    if (!pagoMensualId || !accion) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios" },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const nuevoEstado = accion === "aprobar" ? "pagado" : "rechazado"

    const { data: pagoActualizado, error } = await supabase
      .from("pagos_mensuales")
      .update({
        estado: nuevoEstado,
        observaciones_admin: observacionesAdmin || null,
      })
      .eq("id", pagoMensualId)
      .select("id, actividad_id, inscripcion_id, anio, mes, monto, moneda")
      .single()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo actualizar el pago", detalle: error },
        { status: 500 }
      )
    }

    let advertencia: string | null = null

    try {
      const [{ data: inscripcion }, { data: actividad }] = await Promise.all([
        supabase
          .from("inscripciones")
          .select("participante_email, participante_nombre")
          .eq("id", pagoActualizado.inscripcion_id)
          .maybeSingle(),
        supabase
          .from("actividades")
          .select("slug, nombre")
          .eq("id", pagoActualizado.actividad_id)
          .maybeSingle(),
      ])

      if (inscripcion?.participante_email) {
        const envio = await enviarResolucionPagoIndividual({
          destinatarioEmail: inscripcion.participante_email,
          destinatarioNombre: inscripcion.participante_nombre || null,
          actividadSlug: actividad?.slug || null,
          actividadNombre: actividad?.nombre || actividad?.slug || "tu actividad",
          accion: accion === "aprobar" ? "aprobado" : "rechazado",
          monto: pagoActualizado.monto,
          moneda: pagoActualizado.moneda,
          periodo: periodoTexto(pagoActualizado.anio, pagoActualizado.mes),
          observacionesAdmin: observacionesAdmin || null,
        })

        if (!envio.resultado.enviado) {
          advertencia =
            "El pago se actualizó, pero no se pudo enviar el mail de aviso al participante."
        }
      }
    } catch (mailError) {
      advertencia =
        "El pago se actualizó, pero no se pudo enviar el mail de aviso al participante."
      console.error("Error enviando aviso de resolución de pago", mailError)
    }

    return NextResponse.json({
      ok: true,
      pagoMensualId,
      estado: nuevoEstado,
      advertencia,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno resolviendo pago",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
