import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import {
  crearAporteHDR,
  esHDRActividadSlug,
  type CrearAporteInput,
} from "@/lib/hdr"

type Body = Partial<CrearAporteInput>

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body
    const actividadSlug = String(body.actividadSlug || "").trim()

    if (!esHDRActividadSlug(actividadSlug)) {
      return NextResponse.json(
        { error: "Actividad HDR inválida." },
        { status: 400 }
      )
    }

    const adminPermission = getActivityAdminPermission(actividadSlug)

    if (!adminPermission) {
      return NextResponse.json(
        { error: "La actividad no tiene permiso admin configurado." },
        { status: 400 }
      )
    }

    const auth = await requireActivityAccess(actividadSlug, adminPermission)

    if ("response" in auth) {
      return auth.response
    }

    if (!hasPermission(auth.actor, adminPermission)) {
      return NextResponse.json(
        { error: "Solo admin puede escribir aportes." },
        { status: 403 }
      )
    }

    const coordenadaId = String(body.coordenadaId || "").trim()
    const participanteEmail = String(body.participanteEmail || "").trim()
    const contenido = String(body.contenido || "").trim()

    if (!coordenadaId || !participanteEmail || !contenido) {
      return NextResponse.json(
        { error: "Faltan datos para guardar el aporte." },
        { status: 400 }
      )
    }

    const aporte = await crearAporteHDR(auth.actor, {
      actividadSlug,
      coordenadaId,
      participanteEmail,
      contenido,
    })

    return NextResponse.json({
      ok: true,
      aporte,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo guardar el aporte.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
