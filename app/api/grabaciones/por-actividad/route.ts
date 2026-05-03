import { NextResponse } from "next/server"
import {
  requireActivityAccess,
  type ActivitySlug,
  type Permission,
} from "@/lib/authz"
import { allowRequestedPreview } from "@/lib/dev-flags"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const actividadAdminPermissionMap: Partial<Record<ActivitySlug, Permission>> = {
  casatalentos: "casatalentos.admin",
  "conectando-sentidos": "conectando.admin",
}

export async function POST(req: Request) {
  try {
    const { actividadSlug, previewEnabled } = await req.json()

    if (!actividadSlug) {
      return NextResponse.json(
        { error: "Falta actividadSlug" },
        { status: 400 }
      )
    }

    const permitePreview = allowRequestedPreview(previewEnabled === true)

    if (!permitePreview) {
      const auth = await requireActivityAccess(
        actividadSlug as ActivitySlug,
        actividadAdminPermissionMap[actividadSlug as ActivitySlug]
      )

      if ("response" in auth) {
        return auth.response
      }
    }

    const supabase = createAdminSupabaseClient()

    const { data: actividad } = await supabase
      .from("actividades")
      .select("*")
      .eq("slug", actividadSlug)
      .single()

    if (!actividad) {
      return NextResponse.json(
        { error: "Actividad no encontrada" },
        { status: 404 }
      )
    }

    const { data, error } = await supabase
      .from("grabaciones")
      .select("*")
      .eq("actividad_id", actividad.id)
      .eq("visible", true)
      .order("fecha", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "Error cargando grabaciones", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      grabaciones: data || [],
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno", detalle: String(error) },
      { status: 500 }
    )
  }
}
