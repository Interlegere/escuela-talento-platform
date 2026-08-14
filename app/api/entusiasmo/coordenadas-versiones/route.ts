import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type VersionRow = {
  id: number
  campo: string
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
        { error: "No podés ver las versiones de otra persona." },
        { status: 403 }
      )
    }

    const emailObjetivo = emailConsultado || auth.actor.email
    const supabase = createAdminSupabaseClient()

    const { data, error } = await supabase
      .from("entusiasmo_coordenadas_versiones")
      .select("id, campo, contenido, created_at, entusiasmo_proyectos!inner(participante_email)")
      .eq("entusiasmo_proyectos.participante_email", emailObjetivo)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "No se pudieron cargar las versiones anteriores.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, versiones: (data as VersionRow[]) || [] })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno cargando las versiones anteriores.", detalle: String(error) },
      { status: 500 }
    )
  }
}
