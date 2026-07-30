import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export async function GET() {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const supabase = createAdminSupabaseClient()

    const { data, error } = await supabase
      .from("comunicacion_recibidos")
      .select("*")
      .order("recibido_at", { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json(
        { error: "No se pudieron cargar los emails recibidos.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, recibidos: data || [] })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno cargando los emails recibidos.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
