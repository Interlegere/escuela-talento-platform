import { NextResponse } from "next/server"
import {
  esErrorConfiguracionEspacios,
  resolverContextoEspacio,
} from "@/lib/espacios"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { tieneContenidoRecurso } from "@/lib/recursos"

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

    if (
      !body.titulo?.trim() ||
      !tieneContenidoRecurso({
        descripcion: body.descripcion,
        url: body.url,
      })
    ) {
      return NextResponse.json(
        {
          error:
            "Completá el título y agregá una descripción, una URL o un archivo.",
        },
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
        url: body.url?.trim() || "",
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

    const actualizacion: Record<string, unknown> = {
      visible: body.visible === true,
    }

    if (body.titulo !== undefined) {
      if (
        !body.titulo.trim() ||
        !tieneContenidoRecurso({
          descripcion: body.descripcion,
          url: body.url,
        })
      ) {
        return NextResponse.json(
          {
            error:
              "Completá el título y agregá una descripción, una URL o un archivo.",
          },
          { status: 400 }
        )
      }

      actualizacion.titulo = body.titulo.trim()
      actualizacion.descripcion = body.descripcion?.trim() || null
      actualizacion.recurso_tipo = body.recursoTipo?.trim() || "enlace"
      actualizacion.url = body.url?.trim() || ""
    }

    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from("espacios_recursos")
      .update(actualizacion)
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

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as Body

    if (!body.actividadSlug || !body.recursoId) {
      return NextResponse.json(
        { error: "Faltan datos para eliminar el recurso." },
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
        { error: "No tenés permisos para eliminar recursos." },
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
    const { error } = await supabase
      .from("espacios_recursos")
      .delete()
      .eq("id", body.recursoId)
      .eq("espacio_id", espacio.id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      ok: true,
      recursoId: body.recursoId,
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
        error: "No se pudo eliminar el recurso.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
