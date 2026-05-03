import { NextResponse } from "next/server"
import {
  hasAnyPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  videoId: number
  autorNombre: string
  autorEmail?: string
  contenido: string
}

export async function POST(req: Request) {
  try {
    const auth = await requireActivityAccess("casatalentos", "casatalentos.admin")

    if ("response" in auth) {
      return auth.response
    }

    if (
      !hasAnyPermission(auth.actor, [
        "casatalentos.comment",
        "casatalentos.admin",
      ])
    ) {
      return NextResponse.json(
        { error: "No tenés permisos para comentar." },
        { status: 403 }
      )
    }

    const body: Body = await req.json()

    const videoId = Number(body.videoId)
    const autorNombre = auth.actor.name
    const autorEmail = auth.actor.email
    const contenido = (body.contenido || "").trim()

    if (!videoId) {
      return NextResponse.json(
        { error: "Falta videoId" },
        { status: 400 }
      )
    }

    if (!contenido) {
      return NextResponse.json(
        { error: "Escribe un comentario antes de enviarlo." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: video, error: videoError } = await supabase
      .from("casatalentos_videos")
      .select("id")
      .eq("id", videoId)
      .single()

    if (videoError || !video) {
      return NextResponse.json(
        {
          error: "No se encontró el video para comentar.",
          detalle: videoError?.message || "video no encontrado",
        },
        { status: 404 }
      )
    }

    const { data, error } = await supabase
      .from("casatalentos_comentarios")
      .insert({
        video_id: videoId,
        autor_nombre: autorNombre,
        autor_email: autorEmail || null,
        contenido,
      })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        {
          error: "No se pudo guardar el comentario.",
          detalle: error.message || "error de base de datos",
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        comentario: data,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error en /api/casatalentos/comentar:", error)

    return NextResponse.json(
      {
        error: "Error interno guardando comentario",
        detalle: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
