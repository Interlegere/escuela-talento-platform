import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type AporteRow = {
  id: number
  proyecto_id: number
  produccion_id: number | null
  autor_nombre: string | null
  autor_email: string | null
  contenido: string
  campo: string | null
  fragmento: string | null
  created_at: string
}

type Body = {
  participanteEmail?: string
  contenido?: string
  campo?: string
  fragmento?: string
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
        { error: "No podés ver los aportes de otra persona." },
        { status: 403 }
      )
    }

    const emailObjetivo = emailConsultado || auth.actor.email
    const supabase = createAdminSupabaseClient()

    const { data: proyecto } = await supabase
      .from("entusiasmo_proyectos")
      .select("id")
      .eq("participante_email", emailObjetivo)
      .maybeSingle()

    if (!proyecto) {
      return NextResponse.json({ ok: true, aportes: [] })
    }

    const { data, error } = await supabase
      .from("entusiasmo_aportes")
      .select("*")
      .eq("proyecto_id", proyecto.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "No se pudieron cargar los aportes.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, aportes: (data as AporteRow[]) || [] })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno cargando los aportes.", detalle: String(error) },
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

    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")

    if (!esAdmin) {
      return NextResponse.json(
        { error: "Por ahora solo el admin puede dejar aportes." },
        { status: 403 }
      )
    }

    const body: Body = await req.json()
    const emailObjetivo = body.participanteEmail?.trim().toLowerCase()
    const contenido = String(body.contenido || "").trim()

    if (!emailObjetivo || !contenido) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios (destinatario o contenido)." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: proyectoExistente } = await supabase
      .from("entusiasmo_proyectos")
      .select("id")
      .eq("participante_email", emailObjetivo)
      .maybeSingle()

    let proyectoId = proyectoExistente?.id as number | undefined

    if (!proyectoId) {
      const { data: proyectoNuevo, error: crearError } = await supabase
        .from("entusiasmo_proyectos")
        .insert({ participante_email: emailObjetivo })
        .select("id")
        .single()

      if (crearError || !proyectoNuevo) {
        return NextResponse.json(
          { error: "No se pudo preparar el espacio de esa persona.", detalle: crearError },
          { status: 500 }
        )
      }

      proyectoId = proyectoNuevo.id
    }

    const { data, error } = await supabase
      .from("entusiasmo_aportes")
      .insert({
        proyecto_id: proyectoId,
        autor_email: auth.actor.email,
        autor_nombre: auth.actor.name || auth.actor.email,
        contenido,
        campo: body.campo?.trim() || null,
        fragmento: body.fragmento?.trim() || null,
      })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo guardar el aporte.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, aporte: data as AporteRow })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno guardando el aporte.", detalle: String(error) },
      { status: 500 }
    )
  }
}
