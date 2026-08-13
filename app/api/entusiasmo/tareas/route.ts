import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type TareaRow = {
  id: number
  proyecto_id: number
  contenido: string
  completada: boolean
  fecha: string | null
  hora: string | null
  prioridad: string | null
  created_at: string
  updated_at: string
}

type PostBody = {
  contenido?: string
  fecha?: string
  hora?: string
}

type PatchBody = {
  id?: number
  contenido?: string
  completada?: boolean
  fecha?: string | null
  hora?: string | null
  prioridad?: string | null
}

const PRIORIDADES_VALIDAS = ["verde", "amarillo", "rojo"]

async function resolverProyectoId(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  email: string
) {
  const { data } = await supabase
    .from("entusiasmo_proyectos")
    .select("id")
    .eq("participante_email", email)
    .maybeSingle()

  return data?.id as number | undefined
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

    // Un solo viaje a la base (join + filtro por email) en vez de resolver
    // primero el proyecto_id y recién después pedir las tareas.
    const { data, error } = await supabase
      .from("entusiasmo_tareas")
      .select("*, entusiasmo_proyectos!inner(participante_email)")
      .eq("entusiasmo_proyectos.participante_email", emailObjetivo)
      .order("fecha", { ascending: true, nullsFirst: false })
      .order("hora", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: "No se pudieron cargar las tareas.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, tareas: (data as TareaRow[]) || [] })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno cargando las tareas.", detalle: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return auth.response
    }

    const body: PostBody = await req.json()
    const contenido = String(body.contenido || "").trim()

    if (!contenido) {
      return NextResponse.json({ error: "Falta el contenido de la tarea." }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()
    let proyectoId = await resolverProyectoId(supabase, auth.actor.email)

    if (!proyectoId) {
      const { data: proyectoNuevo, error: crearError } = await supabase
        .from("entusiasmo_proyectos")
        .insert({ participante_email: auth.actor.email })
        .select("id")
        .single()

      if (crearError || !proyectoNuevo) {
        return NextResponse.json(
          { error: "No se pudo preparar tu espacio.", detalle: crearError },
          { status: 500 }
        )
      }

      proyectoId = proyectoNuevo.id
    }

    const { data, error } = await supabase
      .from("entusiasmo_tareas")
      .insert({
        proyecto_id: proyectoId,
        contenido,
        fecha: body.fecha?.trim() || null,
        hora: body.hora?.trim() || null,
      })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo guardar la tarea.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, tarea: data as TareaRow })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno guardando la tarea.", detalle: String(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return auth.response
    }

    const body: PatchBody = await req.json()
    const id = Number(body.id)

    if (!id) {
      return NextResponse.json({ error: "Falta el id de la tarea." }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()

    const { data: existente } = await supabase
      .from("entusiasmo_tareas")
      .select("proyecto_id, entusiasmo_proyectos!inner(participante_email)")
      .eq("id", id)
      .maybeSingle<{
        proyecto_id: number
        entusiasmo_proyectos: { participante_email: string }
      }>()

    if (!existente) {
      return NextResponse.json({ error: "No se encontró la tarea." }, { status: 404 })
    }

    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")
    const esDueno =
      existente.entusiasmo_proyectos?.participante_email === auth.actor.email

    if (!esDueno && !esAdmin) {
      return NextResponse.json(
        { error: "No podés editar la tarea de otra persona." },
        { status: 403 }
      )
    }

    const cambios: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.contenido !== undefined) cambios.contenido = body.contenido.trim()
    if (body.completada !== undefined) cambios.completada = Boolean(body.completada)
    if (body.fecha !== undefined) cambios.fecha = body.fecha?.trim() || null
    if (body.hora !== undefined) cambios.hora = body.hora?.trim() || null

    if (body.prioridad !== undefined) {
      const prioridad = body.prioridad?.trim() || null

      if (prioridad && !PRIORIDADES_VALIDAS.includes(prioridad)) {
        return NextResponse.json({ error: "Prioridad inválida." }, { status: 400 })
      }

      cambios.prioridad = prioridad
    }

    const { data, error } = await supabase
      .from("entusiasmo_tareas")
      .update(cambios)
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo actualizar la tarea.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, tarea: data as TareaRow })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno actualizando la tarea.", detalle: String(error) },
      { status: 500 }
    )
  }
}
