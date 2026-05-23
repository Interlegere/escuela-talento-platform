import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { buscarDestinatariosComunicacion } from "@/lib/comunicaciones"

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const { searchParams } = new URL(req.url)
    const q = String(searchParams.get("q") || "").trim()
    const resultado = await buscarDestinatariosComunicacion(q)

    return NextResponse.json({
      ok: true,
      destinatarios: resultado.destinatarios,
      advertencia: resultado.advertencia,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron buscar destinatarios.",
      },
      { status: 500 }
    )
  }
}
