import { NextResponse } from "next/server"
import { requireAuthenticatedActor } from "@/lib/authz"
import { tieneGoogleConectado } from "@/lib/entusiasmo-google-participante"

export async function GET() {
  const auth = await requireAuthenticatedActor()

  if ("response" in auth) {
    return auth.response
  }

  try {
    const conectado = await tieneGoogleConectado(auth.actor.email)
    return NextResponse.json({ ok: true, conectado })
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo consultar el estado de Google Calendar.", detalle: String(error) },
      { status: 500 }
    )
  }
}
