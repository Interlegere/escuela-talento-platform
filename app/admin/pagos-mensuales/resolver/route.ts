import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  pagoMensualId: number
  accion: "aprobar" | "rechazar"
  observacionesAdmin?: string
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

    const { error } = await supabase
      .from("pagos_mensuales")
      .update({
        estado: nuevoEstado,
        observaciones_admin: observacionesAdmin || null,
      })
      .eq("id", pagoMensualId)

    if (error) {
      return NextResponse.json(
        { error: "No se pudo actualizar el pago", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      pagoMensualId,
      estado: nuevoEstado,
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
