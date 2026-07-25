import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  requireActivityAccess,
} from "@/lib/authz"
import {
  esActividadEspacio,
  listarParticipantesActividad,
  type EspacioActividadSlug,
} from "@/lib/espacios"

type Body = {
  actividadSlug?: string
}

function esActividadPermitida(
  actividadSlug: string
): actividadSlug is "casatalentos" | EspacioActividadSlug {
  return actividadSlug === "casatalentos" || esActividadEspacio(actividadSlug)
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body

    if (!body.actividadSlug || !esActividadPermitida(body.actividadSlug)) {
      return NextResponse.json(
        { error: "Actividad inválida para listar participantes." },
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
