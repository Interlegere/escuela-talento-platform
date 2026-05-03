import { NextResponse } from "next/server"
import {
  esErrorConfiguracionEspacios,
  resolverContextoEspacio,
} from "@/lib/espacios"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  actividadSlug?: string
  participanteEmail?: string
  recursoId?: number
  titulo?: string
  descripcion?: string
  recursoTipo?: string
  url?: string
  visible?: boolean
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body

    if (!body.actividadSlug) {
      return NextResponse.json(
        { error: "Falta actividadSlug." },
        { status: 400 }
      )
    }

    const contexto = await resolverContextoEspacio({
      actividadSlug: body.actividadSlug,
      participanteEmail: body.participanteEmail,
    })

    if ("response" in contexto) {
      return contexto.response
    }

    if (!contexto.esAdmin) {
      return NextResponse.json(
        { error: "No tenés permisos para cargar recursos." },
        { status: 403 }
      )
    }

    const espacio = contexto.espacio

    if (!espacio) {
      return NextResponse.json(
        { error: "No se encontró el espacio configurado." },
        { status: 404 }
      )
    }

    if (!body.titulo?.trim() || !body.url?.trim()) {
      return NextResponse.json(
        { error: "Completá al menos título y URL." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from("espacios_recursos")
      .insert({
        espacio_id: espacio.id,
        titulo: body.titulo.trim(),
        descripcion: body.descripcion?.trim() || null,
        recurso_tipo: body.recursoTipo?.trim() || "enlace",
        url: body.url.trim(),
        visible: body.visible !== false,
        created_by_email: contexto.actor.email,
      })
      .select("*")
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      ok: true,
      recurso: data,
    })
  } catch (error) {
    if (esErrorConfiguracionEspacios(error)) {
      return NextResponse.json(
        { error: "Falta configurar las tablas de espacios." },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: "No se pudo guardar el recurso.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Body

    if (!body.actividadSlug || !body.recursoId) {
      return NextResponse.json(
        { error: "Faltan datos para actualizar el recurso." },
        { status: 400 }
      )
    }

    const contexto = await resolverContextoEspacio({
      actividadSlug: body.actividadSlug,
      participanteEmail: body.participanteEmail,
    })

    if ("response" in contexto) {
      return contexto.response
    }

    if (!contexto.esAdmin) {
      return NextResponse.json(
        { error: "No tenés permisos para editar recursos." },
        { status: 403 }
      )
    }

    const espacio = contexto.espacio

    if (!espacio) {
      return NextResponse.json(
        { error: "No se encontró el espacio configurado." },
        { status: 404 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from("espacios_recursos")
      .update({
        visible: body.visible === true,
      })
      .eq("id", body.recursoId)
      .eq("espacio_id", espacio.id)
      .select("*")
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      ok: true,
      recurso: data,
    })
  } catch (error) {
    if (esErrorConfiguracionEspacios(error)) {
      return NextResponse.json(
        { error: "Falta configurar las tablas de espacios." },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: "No se pudo actualizar el recurso.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
