import { NextResponse } from "next/server"
import { requireAuthenticatedActor, type ActivitySlug } from "@/lib/authz"
import { listarAgendaUnificada } from "@/lib/agenda-unificada"

type Body = {
  actividadSlug?: string
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const body = (await req.json()) as Body
    const actividadSlug = body.actividadSlug as ActivitySlug

    if (
      actividadSlug !== "casatalentos" &&
      actividadSlug !== "conectando-sentidos" &&
      actividadSlug !== "mentorias" &&
      actividadSlug !== "terapia"
    ) {
      return NextResponse.json(
        { error: "Actividad inválida para agenda." },
        { status: 400 }
      )
    }

    const items = await listarAgendaUnificada({
      actor: auth.actor,
      actividadSlug,
    })

    return NextResponse.json({
      ok: true,
      items,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar la agenda de la actividad.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
