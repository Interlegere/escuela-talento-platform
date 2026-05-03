import { NextResponse } from "next/server"
import { requireAuthenticatedActor, type ActivitySlug } from "@/lib/authz"
import { listarAgendaUnificada } from "@/lib/agenda-unificada"

export async function GET(req: Request) {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const { searchParams } = new URL(req.url)
    const actividadSlug = (searchParams.get("actividadSlug") || "") as ActivitySlug

    const items = await listarAgendaUnificada({
      actor: auth.actor,
      actividadSlug: actividadSlug || null,
    })

    return NextResponse.json({
      ok: true,
      items,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar la agenda unificada.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
