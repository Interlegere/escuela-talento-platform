import { NextResponse } from "next/server"
import {
  getCurrentActor,
  hasAnyPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { allowRequestedPreview } from "@/lib/dev-flags"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  asunto?: string
  contenido: string
  parentId?: number | null
  previewEnabled?: boolean
}

function permitePreview(valor?: boolean) {
  return allowRequestedPreview(valor)
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body
    const preview = permitePreview(body.previewEnabled)

    const auth = preview
      ? null
      : await requireActivityAccess("casatalentos", "casatalentos.admin")

    if (auth && "response" in auth) {
      return auth.response
    }

    const actorPreview = preview ? await getCurrentActor() : null
    const actor =
      auth && "actor" in auth
        ? auth.actor
        : actorPreview || {
            name: "Modo prueba",
            email: "preview@escuela.local",
            role: "participante" as const,
          }

    if (
      !hasAnyPermission(actor, [
        "casatalentos.comment",
        "casatalentos.admin",
      ])
    ) {
      return NextResponse.json(
        { error: "No tenés permisos para enviar mensajes." },
        { status: 403 }
      )
    }

    const contenido = (body.contenido || "").trim()
    const asunto = (body.asunto || "").trim()
    const parentId = body.parentId ? Number(body.parentId) : null

    if (!contenido) {
      return NextResponse.json(
        { error: "Escribí un mensaje antes de enviarlo." },
        { status: 400 }
      )
    }

    if (!parentId && !asunto) {
      return NextResponse.json(
        { error: "Escribí un asunto antes de enviarlo." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    if (parentId) {
      const { data: parent, error: parentError } = await supabase
        .from("casatalentos_mensajes")
        .select("id")
        .eq("id", parentId)
        .single()

      if (parentError || !parent) {
        return NextResponse.json(
          { error: "No se encontró el mensaje que querés responder." },
          { status: 404 }
        )
      }
    }

    const { data, error } = await supabase
      .from("casatalentos_mensajes")
      .insert({
        parent_id: parentId,
        asunto: parentId ? null : asunto,
        autor_nombre: actor.name,
        autor_email: actor.email || null,
        autor_rol: actor.role,
        contenido,
      })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo guardar el mensaje.", detalle: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, mensaje: data })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno guardando mensaje",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as {
      mensajeId?: number
      asunto?: string
      contenido?: string
      previewEnabled?: boolean
    }
    const preview = permitePreview(body.previewEnabled)

    const auth = preview
      ? null
      : await requireActivityAccess("casatalentos", "casatalentos.admin")

    if (auth && "response" in auth) {
      return auth.response
    }

    const actorPreview = preview ? await getCurrentActor() : null
    const actor =
      auth && "actor" in auth
        ? auth.actor
        : actorPreview || {
            name: "Modo prueba",
            email: "preview@escuela.local",
            role: "admin" as const,
          }

    if (!hasAnyPermission(actor, ["casatalentos.admin"])) {
      return NextResponse.json(
        { error: "Solo admin puede editar mensajes." },
        { status: 403 }
      )
    }

    const mensajeId = Number(body.mensajeId)
    const asunto = (body.asunto || "").trim()
    const contenido = (body.contenido || "").trim()

    if (!mensajeId || !contenido) {
      return NextResponse.json(
        { error: "Faltan datos para editar el mensaje." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data, error } = await supabase
      .from("casatalentos_mensajes")
      .update({
        asunto: asunto || null,
        contenido,
        updated_at: new Date().toISOString(),
      })
      .eq("id", mensajeId)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo editar el mensaje.", detalle: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, mensaje: data })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno editando mensaje",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
