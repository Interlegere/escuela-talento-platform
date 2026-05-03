import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("pagos.review")

    if ("response" in auth) {
      return auth.response
    }

    const { searchParams } = new URL(req.url)
    const pagoMensualId = Number(searchParams.get("pagoMensualId"))

    if (!pagoMensualId) {
      return NextResponse.json(
        { error: "Falta pagoMensualId" },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: pago, error: pagoError } = await supabase
      .from("pagos_mensuales")
      .select("comprobante_url, comprobante_nombre_archivo")
      .eq("id", pagoMensualId)
      .single()

    if (pagoError || !pago?.comprobante_url) {
      return NextResponse.json(
        { error: "No se encontró comprobante", detalle: pagoError },
        { status: 404 }
      )
    }

    const { data, error } = await supabase.storage
      .from("comprobantes-pagos")
      .download(pago.comprobante_url)

    if (error || !data) {
      return NextResponse.json(
        { error: "No se pudo descargar el comprobante", detalle: error },
        { status: 500 }
      )
    }

    return new Response(data, {
      headers: {
        "Content-Type": data.type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${pago.comprobante_nombre_archivo || "comprobante"}"`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno abriendo comprobante",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
