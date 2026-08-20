import { NextResponse } from "next/server"
import { getActivityAdminPermission, requireActivityAccess } from "@/lib/authz"
import { calcularPuntosDelMes } from "@/lib/entusiasmo-puntos"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export async function GET() {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return auth.response
    }

    const supabase = createAdminSupabaseClient()
    const puntos = await calcularPuntosDelMes(supabase)

    return NextResponse.json({ ok: true, ...puntos })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno calculando los puntos.", detalle: String(error) },
      { status: 500 }
    )
  }
}
