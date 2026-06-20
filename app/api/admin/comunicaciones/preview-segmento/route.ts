import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import {
  listarDestinatariosSegmento,
  type FiltroPagoPendiente,
  type SegmentoComunicacion,
} from "@/lib/comunicaciones"

type Body = {
  segmento?: SegmentoComunicacion
  emailsManual?: string | null
  destinatariosSeleccionados?: Array<{ email?: string | null; fuente?: string | null }>
  filtroPagoPendiente?: FiltroPagoPendiente | null
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const body = (await req.json()) as Body
    const segmento = body.segmento

    if (!segmento) {
      return NextResponse.json(
        { error: "Falta seleccionar un segmento." },
        { status: 400 }
      )
    }

    const resultado = await listarDestinatariosSegmento({
      segmento,
      emailsManual: body.emailsManual || "",
      destinatariosSeleccionados: body.destinatariosSeleccionados || [],
      filtroPagoPendiente: body.filtroPagoPendiente || "todos",
    })

    return NextResponse.json({
      ok: true,
      segmento,
      total: resultado.destinatarios.length,
      destinatarios: resultado.destinatarios,
      deshabilitado: resultado.deshabilitado,
      motivo: resultado.motivo,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo previsualizar el segmento.",
      },
      { status: 500 }
    )
  }
}
