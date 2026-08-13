import { NextResponse } from "next/server"
import { ejecutarAgenteEntusiasmoDiario } from "@/lib/agente-entusiasmo"

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = req.headers.get("authorization")

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const resultado = await ejecutarAgenteEntusiasmoDiario()
    return NextResponse.json({ ok: true, ...resultado })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno ejecutando el agente de Entusiasmento.", detalle: String(error) },
      { status: 500 }
    )
  }
}
