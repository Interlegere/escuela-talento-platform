import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { compararAgendaConGoogle } from "@/lib/agenda-reconciliacion"
import { getGoogleCalendarConnectionStatus } from "@/lib/google-calendar"

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("agenda.manage")

    if ("response" in auth) {
      return auth.response
    }

    const status = await getGoogleCalendarConnectionStatus()

    if (!status.connected) {
      return NextResponse.json(
        {
          error:
            "Google Calendar no está conectado. Conectalo primero desde /google-calendar.",
        },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(req.url)
    const diasAtras = searchParams.get("diasAtras")
    const diasAdelante = searchParams.get("diasAdelante")

    const resultado = await compararAgendaConGoogle({
      diasAtras: diasAtras ? Number(diasAtras) : undefined,
      diasAdelante: diasAdelante ? Number(diasAdelante) : undefined,
    })

    return NextResponse.json({
      ok: true,
      ...resultado,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo comparar la agenda con Google Calendar.",
        detalle: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
