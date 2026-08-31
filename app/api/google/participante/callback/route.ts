import { NextRequest, NextResponse } from "next/server"
import { requireAuthenticatedActor } from "@/lib/authz"
import { intercambiarCodigoYGuardar } from "@/lib/entusiasmo-google-participante"
import { obtenerAppUrl } from "@/lib/server-url"

export async function GET(req: NextRequest) {
  const appUrl = obtenerAppUrl(req)

  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const code = req.nextUrl.searchParams.get("code")

    if (!code) {
      const params = new URLSearchParams({ google_error: "Falta code en la respuesta de Google." })
      return NextResponse.redirect(`${appUrl}/perfil?${params.toString()}`)
    }

    await intercambiarCodigoYGuardar(auth.actor.email, code)

    const params = new URLSearchParams({ google_success: "Tu Google Calendar quedó conectado." })
    return NextResponse.redirect(`${appUrl}/perfil?${params.toString()}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error conectando Google Calendar."
    const params = new URLSearchParams({ google_error: message })
    return NextResponse.redirect(`${appUrl}/perfil?${params.toString()}`)
  }
}
