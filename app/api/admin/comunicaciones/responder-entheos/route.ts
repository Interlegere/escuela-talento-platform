import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { enviarRespuestaEntheos } from "@/lib/comunicaciones"

type Body = {
  destinatarioEmail?: string
  destinatarioNombre?: string
  asunto?: string
  cuerpo?: string
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const destinatarioEmail = String(body.destinatarioEmail || "").trim()
    const asunto = String(body.asunto || "").trim()
    const cuerpo = String(body.cuerpo || "").trim()

    if (!destinatarioEmail || !asunto || !cuerpo) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios (destinatario, asunto o cuerpo)." },
        { status: 400 }
      )
    }

    const envio = await enviarRespuestaEntheos({
      destinatarioEmail,
      destinatarioNombre: body.destinatarioNombre?.trim() || null,
      asunto,
      cuerpo,
    })

    if (!envio.resultado.enviado) {
      return NextResponse.json(
        { error: envio.resultado.motivo || "No se pudo enviar la respuesta." },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno enviando la respuesta.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
