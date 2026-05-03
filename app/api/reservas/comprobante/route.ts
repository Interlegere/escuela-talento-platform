import { NextResponse } from "next/server"
import {
  hasPermission,
  requireAuthenticatedActor,
} from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export async function GET(req: Request) {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const { searchParams } = new URL(req.url)
    const reservaId = Number(searchParams.get("reservaId"))

    if (!reservaId || Number.isNaN(reservaId)) {
      return NextResponse.json(
        { error: "Falta una reserva válida." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: reserva, error: reservaError } = await supabase
      .from("reservas")
      .select("participante_email, comprobante_url, comprobante_nombre_archivo")
      .eq("id", reservaId)
      .single()

    if (reservaError || !reserva?.comprobante_url) {
      return NextResponse.json(
        { error: "No se encontró comprobante para esta reserva." },
        { status: 404 }
      )
    }

    const esAdmin = hasPermission(auth.actor, "terapia.admin")
    const esTitular =
      String(reserva.participante_email || "").trim().toLowerCase() ===
      auth.actor.email

    if (!esAdmin && !esTitular) {
      return NextResponse.json(
        { error: "No tenés permisos para abrir este comprobante." },
        { status: 403 }
      )
    }

    const { data: archivo, error: downloadError } = await supabase.storage
      .from("comprobantes-pagos")
      .download(reserva.comprobante_url)

    if (downloadError || !archivo) {
      return NextResponse.json(
        { error: "No se pudo descargar el comprobante.", detalle: downloadError },
        { status: 500 }
      )
    }

    return new NextResponse(archivo, {
      headers: {
        "Content-Type": archivo.type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${reserva.comprobante_nombre_archivo || "comprobante"}"`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno abriendo comprobante de reserva",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
