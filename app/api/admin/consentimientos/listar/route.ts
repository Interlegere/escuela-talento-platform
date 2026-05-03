import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const { searchParams } = new URL(req.url)
    const actividad = searchParams.get("actividad")?.trim().toLowerCase() || ""
    const usuario = searchParams.get("usuario")?.trim().toLowerCase() || ""

    const supabase = createAdminSupabaseClient()
    let query = supabase
      .from("consentimientos")
      .select(
        "id, user_email, actividad, aceptado, version, created_at, disponibilidad_id, fecha_encuentro, hora_encuentro"
      )
      .order("created_at", { ascending: false })

    if (actividad) {
      query = query.eq("actividad", actividad)
    }

    if (usuario) {
      query = query.ilike("user_email", `%${usuario}%`)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      ok: true,
      consentimientos: data || [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron listar los consentimientos.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
