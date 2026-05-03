import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  videoId: number
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("casatalentos.admin")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const { videoId } = body

    if (!videoId) {
      return NextResponse.json(
        { error: "Falta videoId" },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: video, error: buscarError } = await supabase
      .from("casatalentos_videos")
      .select("*")
      .eq("id", videoId)
      .single()

    if (buscarError || !video) {
      return NextResponse.json(
        { error: "No se encontró el video", detalle: buscarError },
        { status: 404 }
      )
    }

    if (video.storage_path) {
      await supabase.storage
        .from("casatalentos-videos")
        .remove([video.storage_path])
    }

    const { error: deleteError } = await supabase
      .from("casatalentos_videos")
      .delete()
      .eq("id", videoId)

    if (deleteError) {
      return NextResponse.json(
        { error: "No se pudo eliminar el video", detalle: deleteError },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      videoId,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno eliminando video",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
