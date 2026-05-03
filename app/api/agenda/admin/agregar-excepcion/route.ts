import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  disponibilidadId: number
  fechaExcepcion: string
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("agenda.manage")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const disponibilidadId = Number(body.disponibilidadId)
    const fechaExcepcion = String(body.fechaExcepcion || "").trim()

    if (!disponibilidadId || !fechaExcepcion) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: item, error: itemError } = await supabase
      .from("disponibilidades")
      .select("*")
      .eq("id", disponibilidadId)
      .single()

    if (itemError || !item) {
      return NextResponse.json(
        {
          error: "No se encontró la disponibilidad.",
          detalle: itemError,
        },
        { status: 404 }
      )
    }

    const actuales = item.excepcion_fechas
      ? String(item.excepcion_fechas)
          .split(",")
          .map((fecha: string) => fecha.trim())
          .filter(Boolean)
      : []

    if (actuales.includes(fechaExcepcion)) {
      return NextResponse.json(
        { error: "Esa excepción ya existe." },
        { status: 400 }
      )
    }

    const nuevas = [...actuales, fechaExcepcion].join(",")

    const { error } = await supabase
      .from("disponibilidades")
      .update({
        excepcion_fechas: nuevas,
        sync_status:
          item.modo === "actividad_fija" || item.estado === "confirmada"
            ? "pendiente"
            : item.sync_status || "no_crear_hasta_reserva",
      })
      .eq("id", disponibilidadId)

    if (error) {
      return NextResponse.json(
        {
          error: "No se pudo agregar la excepción.",
          detalle: error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      disponibilidadId,
      fechaExcepcion,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno agregando excepción",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
