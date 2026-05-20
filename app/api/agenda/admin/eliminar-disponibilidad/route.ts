import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  disponibilidadId: number
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("agenda.manage")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const disponibilidadId = Number(body.disponibilidadId)

    if (!disponibilidadId) {
      return NextResponse.json(
        { error: "Falta disponibilidadId." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: reservas, error: reservasError } = await supabase
      .from("reservas")
      .select("id")
      .eq("disponibilidad_id", disponibilidadId)
      .limit(1)

    if (reservasError) {
      return NextResponse.json(
        {
          error: "No se pudo validar si el encuentro tiene reservas.",
          detalle: reservasError,
        },
        { status: 500 }
      )
    }

    if ((reservas || []).length > 0) {
      return NextResponse.json(
        {
          error:
            "No se puede eliminar este encuentro porque tiene reservas asociadas.",
        },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from("disponibilidades")
      .update({
        estado: "cancelada",
        sync_status: "pendiente",
      })
      .eq("id", disponibilidadId)
      .select("id, estado")
      .single()

    if (error || !data) {
      return NextResponse.json(
        {
          error: "No se pudo eliminar la disponibilidad.",
          detalle: error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      disponibilidadId,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno eliminando disponibilidad",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
