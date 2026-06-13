import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { sincronizarDisponibilidadConGoogle } from "@/lib/google-calendar"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

function errorGoogleCalendar(error: string) {
  const mensaje = error.toLowerCase()

  if (
    mensaje.includes("no se encontró token de google calendar") ||
    mensaje.includes("google_calendar_owner_email") ||
    mensaje.includes("invalid_grant") ||
    mensaje.includes("unauthorized")
  ) {
    return {
      error:
        "No hay una cuenta de Google Calendar conectada para generar el Meet. Conectá la cuenta configurada o cargá un Meet manual.",
      necesitaConexionGoogle: true,
    }
  }

  return {
    error: error || "Error sincronizando con Google Calendar",
    necesitaConexionGoogle: false,
  }
}

export async function POST(req: NextRequest) {
  let disponibilidadId = 0
  const supabase = createAdminSupabaseClient()

  try {
    const auth = await requirePermission("agenda.manage")

    if ("response" in auth) {
      return auth.response
    }

    const body = await req.json()
    disponibilidadId = Number(body.disponibilidadId)

    if (!disponibilidadId) {
      return NextResponse.json(
        { error: "Falta disponibilidadId" },
        { status: 400 }
      )
    }

    const resultado = await sincronizarDisponibilidadConGoogle({
      disponibilidadId,
      actorEmail: auth.actor.email,
    })

    return NextResponse.json({
      ok: true,
      ...resultado,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)

    if (disponibilidadId) {
      try {
        await supabase
          .from("disponibilidades")
          .update({ sync_status: "error" })
          .eq("id", disponibilidadId)
      } catch (updateError) {
        console.error("No se pudo marcar sync_status=error", updateError)
      }
    }

    console.error("Error sincronizando disponibilidad con Google", {
      disponibilidadId,
      error: message,
    })

    return NextResponse.json(errorGoogleCalendar(message), { status: 500 })
  }
}
