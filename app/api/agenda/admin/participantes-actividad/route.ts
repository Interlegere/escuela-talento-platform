import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { listarParticipantesActividad } from "@/lib/espacios"

type Body = {
  actividadSlug?: string
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("agenda.manage")

    if ("response" in auth) {
      return auth.response
    }

    const body = (await req.json()) as Body
    const actividadSlug = body.actividadSlug

    if (actividadSlug !== "mentorias" && actividadSlug !== "terapia") {
      return NextResponse.json(
        { error: "Actividad inválida para listar participantes." },
        { status: 400 }
      )
    }

    const participantes = await listarParticipantesActividad(actividadSlug)

    return NextResponse.json({
      ok: true,
      participantes,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron cargar los participantes de la actividad.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
