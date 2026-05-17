import { NextResponse } from "next/server"
import { requireActivityAccess } from "@/lib/authz"
import {
  esHDRActividadSlug,
  guardarNotaPersonalGeneralHDR,
  guardarRespuestaHDR,
  type GuardarRespuestaInput,
  type GuardarNotaPersonalGeneralInput,
} from "@/lib/hdr"

type Body = Partial<GuardarRespuestaInput & GuardarNotaPersonalGeneralInput> & {
  tipo?: "respuesta" | "notas_generales"
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body
    const actividadSlug = String(body.actividadSlug || "").trim()

    if (!esHDRActividadSlug(actividadSlug)) {
      return NextResponse.json(
        { error: "Actividad HDR inválida." },
        { status: 400 }
      )
    }

    const coordenadaId = String(body.coordenadaId || "").trim()
    const tipo = body.tipo || "respuesta"

    const auth = await requireActivityAccess(actividadSlug)

    if ("response" in auth) {
      return auth.response
    }

    if (tipo === "notas_generales") {
      const nota = await guardarNotaPersonalGeneralHDR(auth.actor, {
        actividadSlug,
        contenido: String(body.contenido || ""),
        participanteEmail: String(body.participanteEmail || ""),
      })

      return NextResponse.json({
        ok: true,
        nota,
      })
    }

    if (!coordenadaId) {
      return NextResponse.json(
        { error: "Falta la coordenada a responder." },
        { status: 400 }
      )
    }

    const respuesta = await guardarRespuestaHDR(auth.actor, {
      actividadSlug,
      coordenadaId,
      respuesta: String(body.respuesta || ""),
      participanteEmail: String(body.participanteEmail || ""),
    })

    return NextResponse.json({
      ok: true,
      respuesta,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo guardar la respuesta.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
