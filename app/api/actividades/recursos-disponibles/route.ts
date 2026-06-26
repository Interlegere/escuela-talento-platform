import { NextResponse } from "next/server"
import {
  cargarRecursosActividad,
  getActivityAdminPermission,
  hasPermission,
  requireAuthenticatedActor,
  resolveActivityAccess,
  type ActivitySlug,
} from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  actividadSlug: string
  participanteEmail?: string
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const actividadSlug = body.actividadSlug as ActivitySlug
    const participanteEmail =
      auth.actor.role === "admin" && body.participanteEmail
        ? body.participanteEmail.trim().toLowerCase()
        : auth.actor.email

    if (!actividadSlug) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios" },
        { status: 400 }
      )
    }

    const adminPermission = getActivityAdminPermission(actividadSlug)

    if (adminPermission && hasPermission(auth.actor, adminPermission)) {
      const supabase = createAdminSupabaseClient()
      const { data: actividad } = await supabase
        .from("actividades")
        .select("*")
        .eq("slug", actividadSlug)
        .maybeSingle()

      const recursos =
        actividad?.id && participanteEmail
          ? await cargarRecursosActividad(supabase, actividad.id, participanteEmail)
          : []

      return NextResponse.json({
        ok: true,
        acceso: true,
        motivo: "permiso_admin",
        actividad: actividad || null,
        recursos,
      })
    }

    let acceso

    try {
      acceso = await resolveActivityAccess(actividadSlug, participanteEmail)
    } catch (error) {
      if (String(error).includes("Actividad no encontrada")) {
        return NextResponse.json({
          ok: true,
          acceso: false,
          motivo: "actividad_no_configurada",
          actividad: null,
          recursos: [],
        })
      }

      throw error
    }

    return NextResponse.json({
      ok: true,
      acceso: acceso.acceso,
      motivo: acceso.motivo,
      actividad: acceso.actividad,
      recursos: acceso.recursos,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno resolviendo recursos",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
