import { NextResponse } from "next/server"
import { requireAuthenticatedActor } from "@/lib/authz"
import { esZonaHorariaValida } from "@/lib/fechas"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  zonaHoraria?: string
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const body = (await req.json()) as Body
    const zonaHoraria = String(body.zonaHoraria || "").trim()

    if (!esZonaHorariaValida(zonaHoraria)) {
      return NextResponse.json({ error: "Zona horaria inválida." }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()
    const { error } = await supabase
      .from("usuarios_plataforma")
      .update({ zona_horaria: zonaHoraria })
      .eq("email", auth.actor.email)

    if (error) {
      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo guardar la zona horaria.", detalle: String(error) },
      { status: 500 }
    )
  }
}
