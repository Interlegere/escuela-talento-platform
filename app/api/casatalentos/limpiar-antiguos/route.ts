import { NextResponse } from "next/server"
import { obtenerFechaISOArgentina } from "@/lib/fechas"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const DIAS_RETENCION = 28

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = req.headers.get("authorization")

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const corteMs = Date.now() - DIAS_RETENCION * 24 * 60 * 60 * 1000
    const fechaCorte = obtenerFechaISOArgentina(new Date(corteMs))

    const supabase = createAdminSupabaseClient()

    const { data: videos, error: listarError } = await supabase
      .from("casatalentos_videos")
      .select("id, storage_path")
      .lt("fecha_semana", fechaCorte)

    if (listarError) {
      return NextResponse.json(
        { error: "No se pudieron listar los videos antiguos", detalle: listarError },
        { status: 500 }
      )
    }

    const borrados: number[] = []
    const omitidos: { id: number; motivo: string }[] = []

    for (const video of videos || []) {
      const { error: deleteError } = await supabase
        .from("casatalentos_videos")
        .delete()
        .eq("id", video.id)

      if (deleteError) {
        omitidos.push({ id: video.id, motivo: deleteError.message })
        continue
      }

      if (video.storage_path) {
        const { error: storageError } = await supabase.storage
          .from("casatalentos-videos")
          .remove([video.storage_path])

        if (storageError) {
          omitidos.push({
            id: video.id,
            motivo: `Fila borrada pero falló el archivo: ${storageError.message}`,
          })
          continue
        }
      }

      borrados.push(video.id)
    }

    return NextResponse.json({
      ok: true,
      fechaCorte,
      borrados: borrados.length,
      omitidos,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno limpiando videos antiguos",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
