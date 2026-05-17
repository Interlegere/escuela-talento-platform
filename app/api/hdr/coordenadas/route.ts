import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import {
  actualizarCoordenadaHDR,
  cargarHDRActividad,
  crearCoordenadaHDR,
  esHDRActividadSlug,
  type ActualizarCoordenadaInput,
  type CrearCoordenadaInput,
  type HDRActividadSlug,
} from "@/lib/hdr"

type Body = Partial<CrearCoordenadaInput & ActualizarCoordenadaInput>

function leerActividadSlug(value: unknown): HDRActividadSlug | null {
  const slug = String(value || "").trim()
  return esHDRActividadSlug(slug) ? slug : null
}

export async function GET(req: Request) {
  try {
    const actividadSlug = leerActividadSlug(
      new URL(req.url).searchParams.get("actividadSlug")
    )

    if (!actividadSlug) {
      return NextResponse.json(
        { error: "Actividad HDR inválida." },
        { status: 400 }
      )
    }

    const adminPermission = getActivityAdminPermission(actividadSlug)
    const auth = await requireActivityAccess(actividadSlug, adminPermission)

    if ("response" in auth) {
      return auth.response
    }

    const payload = await cargarHDRActividad(actividadSlug, auth.actor)
    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar la Hoja de Ruta.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body
    const actividadSlug = leerActividadSlug(body.actividadSlug)

    if (!actividadSlug) {
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
        { error: "Solo admin puede crear coordenadas." },
        { status: 403 }
      )
    }

    const titulo = String(body.titulo || "").trim()
    const alcance = String(body.alcance || "").trim()
    const participanteEmail = String(body.participanteEmail || "").trim()

    if (!titulo) {
      return NextResponse.json(
        { error: "El título es obligatorio." },
        { status: 400 }
      )
    }

    if (alcance !== "global" && alcance !== "individual") {
      return NextResponse.json(
        { error: "El alcance de la coordenada es inválido." },
        { status: 400 }
      )
    }

    if (alcance === "individual" && !participanteEmail) {
      return NextResponse.json(
        { error: "Debes seleccionar un participante para la coordenada individual." },
        { status: 400 }
      )
    }

    const coordenada = await crearCoordenadaHDR(auth.actor, {
      actividadSlug,
      titulo,
      descripcion: String(body.descripcion || ""),
      descripcionHtml: String(body.descripcionHtml || ""),
      orden: Number(body.orden || 0),
      activo: body.activo !== false,
      alcance,
      participanteEmail: alcance === "individual" ? participanteEmail : null,
    })

    return NextResponse.json({
      ok: true,
      coordenada,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo crear la coordenada.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Body
    const actividadSlug = leerActividadSlug(body.actividadSlug)

    if (!actividadSlug) {
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
        { error: "Solo admin puede editar coordenadas." },
        { status: 403 }
      )
    }

    const id = String(body.id || "").trim()
    const titulo = String(body.titulo || "").trim()

    if (!id || !titulo) {
      return NextResponse.json(
        { error: "Faltan datos para editar la coordenada." },
        { status: 400 }
      )
    }

    const coordenada = await actualizarCoordenadaHDR({
      id,
      actividadSlug,
      titulo,
      descripcion: String(body.descripcion || ""),
      descripcionHtml: String(body.descripcionHtml || ""),
      orden: Number(body.orden || 0),
      activo: body.activo !== false,
    })

    return NextResponse.json({
      ok: true,
      coordenada,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo editar la coordenada.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
