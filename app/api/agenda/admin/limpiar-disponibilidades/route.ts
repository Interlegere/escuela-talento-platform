import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export async function POST() {
  try {
    const auth = await requirePermission("agenda.manage")

    if ("response" in auth) {
      return auth.response
    }

    const supabase = createAdminSupabaseClient()
    const { error } = await supabase
      .from("disponibilidades")
      .delete()
      .gt("id", 0)

    if (error) {
      return NextResponse.json(
        {
          error: "No se pudieron limpiar las disponibilidades.",
          detalle: error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno limpiando disponibilidades",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
