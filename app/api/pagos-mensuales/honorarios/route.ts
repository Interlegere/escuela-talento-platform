import { NextResponse } from "next/server"
import { requireAuthenticatedActor } from "@/lib/authz"
import { resolverEconomiaActividad } from "@/lib/economy-engine"
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

type InscripcionRow = {
  id: number
  actividad_id: number
  participante_email?: string | null
  estado?: string | null
}

type PagoRow = {
  id: number
  inscripcion_id?: number | null
  estado?: string | null
  monto?: string | number | null
  moneda?: string | null
  anio?: number | null
  mes?: number | null
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

    const { data: inscripciones, error: inscripcionesError } =
      actividadIds.length > 0
        ? await supabase
            .from("inscripciones")
            .select("id, actividad_id, participante_email, estado")
            .eq("participante_email", auth.actor.email)
            .eq("estado", "activa")
            .in("actividad_id", actividadIds)
        : { data: [], error: null }

    if (inscripcionesError) {
      return NextResponse.json(
        { error: "No se pudieron cargar las inscripciones activas", detalle: inscripcionesError },
        { status: 500 }
      )
    }

    const inscripcionesRows = (inscripciones || []) as InscripcionRow[]
    const inscripcionPorActividad = new Map(
      inscripcionesRows.map((item) => [item.actividad_id, item])
    )
    const inscripcionIds = inscripcionesRows.map((item) => item.id)

    const { data: pagos, error: pagosError } =
      inscripcionIds.length > 0
        ? await supabase
            .from("pagos_mensuales")
            .select("id, inscripcion_id, estado, monto, moneda, anio, mes")
            .in("inscripcion_id", inscripcionIds)
            .order("created_at", { ascending: false })
        : { data: [], error: null }

    if (pagosError) {
      return NextResponse.json(
        { error: "No se pudieron cargar los pagos asociados", detalle: pagosError },
        { status: 500 }
      )
    }

    const pagosRows = (pagos || []) as PagoRow[]
    const pagosPorInscripcion = new Map<number, PagoRow[]>()
    for (const pago of pagosRows) {
      const inscripcionId = Number(pago.inscripcion_id || 0)
      if (!inscripcionId) continue
      const existentes = pagosPorInscripcion.get(inscripcionId) || []
      existentes.push(pago)
      pagosPorInscripcion.set(inscripcionId, existentes)
    }

    return NextResponse.json({
      ok: true,
      honorarios: honorariosRows
        .map((item) => {
          const actividad = actividadesPorId.get(item.actividad_id)
          if (!actividad) return null

          const inscripcion = inscripcionPorActividad.get(item.actividad_id) || null
          const modalidadPago = normalizarModalidadPago(
            item.modalidad_pago,
            actividad.slug
          )
          const pagoActual =
            modalidadPago === "proceso"
              ? (inscripcion?.id
                  ? (pagosPorInscripcion.get(inscripcion.id) || [])[0] || null
                  : null)
              : (inscripcion?.id
                  ? (pagosPorInscripcion.get(inscripcion.id) || []).find((pago) => {
                      const ahora = new Date()
                      return (
                        Number(pago.anio || 0) === ahora.getFullYear() &&
                        Number(pago.mes || 0) === ahora.getMonth() + 1
                      )
                    }) || null
                  : null)
          const economia = resolverEconomiaActividad({
            actividadSlug: actividad.slug,
            actividadExiste: true,
            inscripcionActiva: Boolean(inscripcion?.id),
            honorarioId: item.id,
            honorarioActivo: item.activo ?? null,
            honorarioModalidadRaw: item.modalidad_pago || null,
            honorarioMonto: item.honorario_mensual,
            honorarioMoneda: item.moneda || null,
            pagoMensualId: pagoActual?.id || null,
            pagoMensualEstado: pagoActual?.estado || null,
            pagoMensualMonto: pagoActual?.monto ?? null,
            pagoMensualMoneda: pagoActual?.moneda || null,
            pagoMensualAnio: pagoActual?.anio ?? null,
            pagoMensualMes: pagoActual?.mes ?? null,
          })

          return {
            id: item.id,
            actividadSlug: actividad.slug,
            actividadNombre: actividad.nombre || actividad.slug,
            actividadDescripcion: actividad.descripcion || "",
            participanteNombre: item.participante_nombre || auth.actor.name,
            participanteEmail: item.participante_email,
            honorarioMensual: item.honorario_mensual,
            modalidadPago,
            moneda: item.moneda || "ARS",
            economia,
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
