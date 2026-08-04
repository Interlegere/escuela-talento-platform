import { NextResponse } from "next/server"
import { sincronizarDisponibilidadConGoogle } from "@/lib/google-calendar"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const ESTADOS_SIN_REINTENTO = ["cancelada"]
const SYNC_STATUS_A_REINTENTAR = ["pendiente", "error", "sincronizando"]

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = req.headers.get("authorization")

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const supabase = createAdminSupabaseClient()
    const hoy = new Date().toISOString().slice(0, 10)

    const { data: pendientes, error } = await supabase
      .from("disponibilidades")
      .select("id, titulo, fecha, hora, estado, sync_status")
      .gte("fecha", hoy)
      .in("sync_status", SYNC_STATUS_A_REINTENTAR)
      .not("estado", "in", `(${ESTADOS_SIN_REINTENTO.join(",")})`)
      .order("fecha", { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: "No se pudieron cargar las disponibilidades pendientes", detalle: error },
        { status: 500 }
      )
    }

    const procesadas: Array<{
      id: number
      titulo: string | null
      fecha: string
      accion: "sincronizado" | "error"
      motivo?: string
    }> = []

    for (const item of pendientes || []) {
      try {
        await sincronizarDisponibilidadConGoogle({ disponibilidadId: item.id })
        procesadas.push({
          id: item.id,
          titulo: item.titulo,
          fecha: item.fecha,
          accion: "sincronizado",
        })
      } catch (syncError) {
        procesadas.push({
          id: item.id,
          titulo: item.titulo,
          fecha: item.fecha,
          accion: "error",
          motivo:
            syncError instanceof Error ? syncError.message : String(syncError),
        })
      }
    }

    return NextResponse.json({
      ok: true,
      fecha: new Date().toISOString(),
      total: procesadas.length,
      procesadas,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno reintentando sincronización con Google Calendar",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
