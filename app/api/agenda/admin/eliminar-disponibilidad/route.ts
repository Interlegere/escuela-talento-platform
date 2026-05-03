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
    const { error } = await supabase
      .from("disponibilidades")
      .delete()
      .eq("id", disponibilidadId)

    if (error) {
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
