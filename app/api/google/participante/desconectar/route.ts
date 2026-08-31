import { NextResponse } from "next/server"
import { requireAuthenticatedActor } from "@/lib/authz"
import { desconectarGoogleParticipante } from "@/lib/entusiasmo-google-participante"

export async function POST() {
  const auth = await requireAuthenticatedActor()

  if ("response" in auth) {
    return auth.response
  }

  try {
    await desconectarGoogleParticipante(auth.actor.email)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo desconectar Google Calendar.", detalle: String(error) },
      { status: 500 }
    )
  }
}
