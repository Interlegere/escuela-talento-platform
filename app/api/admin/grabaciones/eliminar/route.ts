import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  grabacionId: number
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("grabaciones.manage")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const { grabacionId } = body

    if (!grabacionId) {
      return NextResponse.json(
        { error: "Falta grabacionId" },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { error } = await supabase
      .from("grabaciones")
      .delete()
      .eq("id", grabacionId)

    if (error) {
      return NextResponse.json(
        { error: "No se pudo eliminar la grabación", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      grabacionId,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno eliminando grabación",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
