import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export async function POST() {
  try {
    const auth = await requirePermission("casatalentos.admin")

    if ("response" in auth) {
      return auth.response
    }

    const supabase = createAdminSupabaseClient()

    const { data: videos } = await supabase
      .from("casatalentos_videos")
      .select("storage_path")

    const paths = (videos || [])
      .map((v) => v.storage_path)
      .filter((p): p is string => Boolean(p))

    if (paths.length > 0) {
      await supabase.storage.from("casatalentos-videos").remove(paths)
    }

    const { error: votosError } = await supabase
      .from("casatalentos_votos")
      .delete()
      .gt("id", 0)

    if (votosError) {
      return NextResponse.json(
        { error: "No se pudieron limpiar los votos", detalle: votosError },
        { status: 500 }
      )
    }

    const { error: videosError } = await supabase
      .from("casatalentos_videos")
      .delete()
      .gt("id", 0)

    if (videosError) {
      return NextResponse.json(
        { error: "No se pudieron limpiar los videos", detalle: videosError },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno limpiando CasaTalentos",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
