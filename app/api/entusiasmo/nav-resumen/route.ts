import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import {
  calcularHayAportesNuevos,
  calcularNovedadesPorParticipante,
} from "@/lib/entusiasmo-novedades"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

// Endpoint liviano para el punto rojo del menú de navegación: para el
// admin, si hay algo que revisar en cualquier participante; para
// cualquier otra persona, si tiene aportes nuevos propios.
export async function GET() {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return NextResponse.json({ ok: true, hayAlgoQueRevisar: false })
    }

    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")
    const supabase = createAdminSupabaseClient()

    if (esAdmin) {
      const novedades = await calcularNovedadesPorParticipante(supabase, auth.actor.email)
      const hayAlgoQueRevisar = Object.values(novedades).some(Boolean)
      return NextResponse.json({ ok: true, hayAlgoQueRevisar })
    }

    const hayAlgoQueRevisar = await calcularHayAportesNuevos(supabase, auth.actor.email)
    return NextResponse.json({ ok: true, hayAlgoQueRevisar })
  } catch {
    return NextResponse.json({ ok: true, hayAlgoQueRevisar: false })
  }
}
