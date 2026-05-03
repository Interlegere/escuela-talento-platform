import { NextResponse } from "next/server"
import { requireAuthenticatedActor } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { normalizarModalidadPago } from "@/lib/billing"

type ActividadRow = {
  id: number
  slug: string
  nombre?: string | null
  descripcion?: string | null
}

type HonorarioRow = {
  id: number
  actividad_id: number
  participante_email: string
  participante_nombre?: string | null
  honorario_mensual: string | number
  modalidad_pago?: string | null
  moneda?: string | null
  activo?: boolean | null
}

export async function GET() {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const supabase = createAdminSupabaseClient()

    const { data: honorarios, error } = await supabase
      .from("honorarios_participante")
      .select("*")
      .eq("participante_email", auth.actor.email)
      .eq("activo", true)
      .order("updated_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "No se pudieron cargar los honorarios asignados", detalle: error },
        { status: 500 }
      )
    }

    const honorariosRows = (honorarios || []) as HonorarioRow[]
    const actividadIds = Array.from(new Set(honorariosRows.map((item) => item.actividad_id)))

    const { data: actividades, error: actividadesError } =
      actividadIds.length > 0
        ? await supabase
            .from("actividades")
            .select("id, slug, nombre, descripcion")
            .in("id", actividadIds)
        : { data: [], error: null }

    if (actividadesError) {
      return NextResponse.json(
        { error: "No se pudieron cargar las actividades asignadas", detalle: actividadesError },
        { status: 500 }
      )
    }

    const actividadesPorId = new Map(
      (((actividades as ActividadRow[] | null) || [])).map((item) => [
        item.id,
        item,
      ])
    )

    return NextResponse.json({
      ok: true,
      honorarios: honorariosRows
        .map((item) => {
          const actividad = actividadesPorId.get(item.actividad_id)
          if (!actividad) return null

          return {
            id: item.id,
            actividadSlug: actividad.slug,
            actividadNombre: actividad.nombre || actividad.slug,
            actividadDescripcion: actividad.descripcion || "",
            participanteNombre: item.participante_nombre || auth.actor.name,
            participanteEmail: item.participante_email,
            honorarioMensual: item.honorario_mensual,
            modalidadPago: normalizarModalidadPago(item.modalidad_pago, actividad.slug),
            moneda: item.moneda || "ARS",
          }
        })
        .filter(Boolean),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno cargando honorarios del participante",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
