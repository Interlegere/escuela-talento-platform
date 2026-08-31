import { NextResponse } from "next/server"
import { requireAuthenticatedActor } from "@/lib/authz"
import {
  faltaConfigurarGoogleParticipante,
  generarUrlConexionParticipante,
} from "@/lib/entusiasmo-google-participante"

export async function GET() {
  const auth = await requireAuthenticatedActor()

  if ("response" in auth) {
    return auth.response
  }

  if (faltaConfigurarGoogleParticipante()) {
    return NextResponse.json(
      {
        error:
          "Falta configurar GOOGLE_PARTICIPANTE_REDIRECT_URI (y las demás variables de Google) en el entorno.",
      },
      { status: 500 }
    )
  }

  return NextResponse.redirect(generarUrlConexionParticipante())
}
