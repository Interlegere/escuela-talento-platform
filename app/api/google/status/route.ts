import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { getGoogleCalendarConnectionStatus } from "@/lib/google-calendar"

export async function GET() {
  try {
    const auth = await requirePermission("agenda.manage")

    if ("response" in auth) {
      return auth.response
    }

    const status = await getGoogleCalendarConnectionStatus()

    return NextResponse.json({
      ok: true,
      ...status,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar el estado de Google Calendar.",
        detalle: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
