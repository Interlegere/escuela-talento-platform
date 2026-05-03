import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  reservaId?: number
  realizada?: boolean
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("terapia.admin")

    if ("response" in auth) {
      return auth.response
    }

    const body = (await req.json()) as Body
    const reservaId = Number(body.reservaId)
    const realizada = body.realizada !== false

    if (!reservaId) {
      return NextResponse.json(
        { error: "Falta reservaId." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: reserva, error: reservaError } = await supabase
      .from("reservas")
      .select("id, disponibilidad_id, estado")
      .eq("id", reservaId)
      .single()

    if (reservaError || !reserva) {
      return NextResponse.json(
        {
          error: "No se encontró la reserva.",
          detalle: reservaError,
        },
        { status: 404 }
      )
    }

    const { data: disponibilidad, error: disponibilidadError } = await supabase
      .from("disponibilidades")
      .select("id, actividad_slug")
      .eq("id", reserva.disponibilidad_id)
      .single()

    if (disponibilidadError || !disponibilidad) {
      return NextResponse.json(
        {
          error: "No se encontró la disponibilidad vinculada.",
          detalle: disponibilidadError,
        },
        { status: 404 }
      )
    }

    if (disponibilidad.actividad_slug !== "terapia") {
      return NextResponse.json(
        { error: "Esta acción solo aplica a sesiones de Terapia." },
        { status: 400 }
      )
    }

    const { data: reservaActualizada, error: updateError } = await supabase
      .from("reservas")
      .update({
        realizada_at: realizada ? new Date().toISOString() : null,
        realizada_por_email: realizada ? auth.actor.email : null,
      })
      .eq("id", reservaId)
      .select("id, realizada_at, realizada_por_email")
      .single()

    if (updateError || !reservaActualizada) {
      return NextResponse.json(
        {
          error: "No se pudo actualizar la sesión.",
          detalle: updateError,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      reserva: reservaActualizada,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno actualizando la sesión de Terapia.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
