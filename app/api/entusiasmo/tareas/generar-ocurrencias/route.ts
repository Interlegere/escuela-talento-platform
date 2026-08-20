import { NextResponse } from "next/server"
import { completarHorizonteDeSeries } from "@/lib/entusiasmo-tareas-series"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = req.headers.get("authorization")

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const supabase = createAdminSupabaseClient()
    const resultado = await completarHorizonteDeSeries(supabase)

    return NextResponse.json({ ok: true, ...resultado })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno generando ocurrencias de tareas.", detalle: String(error) },
      { status: 500 }
    )
  }
}
