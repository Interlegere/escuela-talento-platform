import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export async function GET(req: Request) {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return auth.response
    }

    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")

    if (!esAdmin) {
      return NextResponse.json(
        { error: "No tenés permisos para ver esto." },
        { status: 403 }
      )
    }

    const url = new URL(req.url)
    const emailObjetivo = url.searchParams.get("email")?.trim().toLowerCase()

    if (!emailObjetivo) {
      return NextResponse.json({ error: "Falta el email a consultar." }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()

    const [{ data: proyecto }, { data: lectura }] = await Promise.all([
      supabase
        .from("entusiasmo_proyectos")
        .select("id")
        .eq("participante_email", emailObjetivo)
        .maybeSingle(),
      supabase
        .from("entusiasmo_lecturas")
        .select("leido_at")
        .eq("lector_email", auth.actor.email)
        .eq("participante_email", emailObjetivo)
        .maybeSingle(),
    ])

    if (!proyecto) {
      return NextResponse.json({ ok: true, campos: [], produccionesIds: [], tareasIds: [] })
    }

    // Sin lectura registrada todavía = nunca lo vio este admin, así que
    // todo lo que exista cuenta como nuevo.
    const leidoAt = lectura?.leido_at ? new Date(lectura.leido_at as string) : new Date(0)

    const [{ data: camposActividad }, { data: producciones }, { data: tareas }] =
      await Promise.all([
        supabase
          .from("entusiasmo_campos_actividad")
          .select("campo, modificado_at")
          .eq("proyecto_id", proyecto.id)
          .gt("modificado_at", leidoAt.toISOString()),
        supabase
          .from("entusiasmo_producciones")
          .select("id, created_at, updated_at")
          .eq("proyecto_id", proyecto.id),
        supabase
          .from("entusiasmo_tareas")
          .select("id, created_at, updated_at")
          .eq("proyecto_id", proyecto.id),
      ])

    const campos = (camposActividad || []).map((c) => c.campo as string)

    const produccionesIds = (producciones || [])
      .filter((p) => {
        const ts = new Date((p.updated_at as string) || (p.created_at as string))
        return ts > leidoAt
      })
      .map((p) => p.id as number)

    const tareasIds = (tareas || [])
      .filter((t) => {
        const ts = new Date((t.updated_at as string) || (t.created_at as string))
        return ts > leidoAt
      })
      .map((t) => t.id as number)

    return NextResponse.json({ ok: true, campos, produccionesIds, tareasIds })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno calculando el detalle de novedades.", detalle: String(error) },
      { status: 500 }
    )
  }
}
