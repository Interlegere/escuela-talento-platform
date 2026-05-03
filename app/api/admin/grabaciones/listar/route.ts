import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export async function GET() {
  try {
    const auth = await requirePermission("grabaciones.manage")

    if ("response" in auth) {
      return auth.response
    }

    const supabase = createAdminSupabaseClient()

    const { data, error } = await supabase
      .from("grabaciones")
      .select(`
        *,
        actividades (
          id,
          slug,
          nombre
        )
      `)
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "No se pudieron listar las grabaciones", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      grabaciones: data || [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno listando grabaciones",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
