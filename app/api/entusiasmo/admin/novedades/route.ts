import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { calcularNovedadesPorParticipante } from "@/lib/entusiasmo-novedades"
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

    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")

    if (!esAdmin) {
      return NextResponse.json(
        { error: "No tenés permisos para ver esto." },
        { status: 403 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const novedades = await calcularNovedadesPorParticipante(supabase, auth.actor.email)

    return NextResponse.json({ ok: true, novedades })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno calculando novedades.", detalle: String(error) },
      { status: 500 }
    )
  }
}
