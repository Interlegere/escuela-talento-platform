import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  requireActivityAccess,
} from "@/lib/authz"
import {
  esActividadEspacio,
  listarParticipantesActividad,
} from "@/lib/espacios"

type Body = {
  actividadSlug?: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body

    if (!body.actividadSlug || !esActividadEspacio(body.actividadSlug)) {
      return NextResponse.json(
        { error: "Actividad inválida para este espacio." },
        { status: 400 }
      )
    }

    const auth = await requireActivityAccess(
      body.actividadSlug,
      getActivityAdminPermission(body.actividadSlug)
    )

    if ("response" in auth) {
      return auth.response
    }

    if (auth.actor.role !== "admin") {
      return NextResponse.json(
        { error: "Solo admin puede listar participantes." },
        { status: 403 }
      )
    }

    const participantes = await listarParticipantesActividad(body.actividadSlug)

    return NextResponse.json({
      ok: true,
      participantes,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron cargar los participantes.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
