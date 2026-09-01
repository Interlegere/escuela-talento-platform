import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type VersionRow = {
  id: number
  tarea_id: number
  contenido: string
  created_at: string
}

export async function GET(req: Request) {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return auth.response
    }

    const url = new URL(req.url)
    const emailConsultado = url.searchParams.get("email")?.trim().toLowerCase()
    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")

    if (emailConsultado && emailConsultado !== auth.actor.email && !esAdmin) {
      return NextResponse.json(
        { error: "No podés ver las tareas de otra persona." },
        { status: 403 }
      )
    }

    const emailObjetivo = emailConsultado || auth.actor.email
    const supabase = createAdminSupabaseClient()

    const { data: proyecto } = await supabase
      .from("entusiasmo_proyectos")
      .select("id")
      .eq("participante_email", emailObjetivo)
      .maybeSingle<{ id: number }>()

    if (!proyecto) {
      return NextResponse.json({ ok: true, versiones: [] })
    }

    const { data: tareas } = await supabase
      .from("entusiasmo_tareas")
      .select("id")
      .eq("proyecto_id", proyecto.id)

    const tareaIds = (tareas || []).map((t) => t.id as number)

    if (tareaIds.length === 0) {
      return NextResponse.json({ ok: true, versiones: [] })
    }

    const { data, error } = await supabase
      .from("entusiasmo_tareas_versiones")
      .select("id, tarea_id, contenido, created_at")
      .in("tarea_id", tareaIds)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "No se pudieron cargar las versiones anteriores de las tareas.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, versiones: (data as VersionRow[]) || [] })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno cargando las versiones anteriores de las tareas.", detalle: String(error) },
      { status: 500 }
    )
  }
}
