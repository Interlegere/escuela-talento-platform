import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  grabacionId: number
  visible: boolean
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("grabaciones.manage")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()

    const { grabacionId, visible } = body

    if (!grabacionId || typeof visible !== "boolean") {
      return NextResponse.json(
        { error: "Faltan datos obligatorios" },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { error } = await supabase
      .from("grabaciones")
      .update({
        visible,
        updated_at: new Date().toISOString(),
      })
      .eq("id", grabacionId)

    if (error) {
      return NextResponse.json(
        { error: "No se pudo actualizar la visibilidad", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      grabacionId,
      visible,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno actualizando visibilidad",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
