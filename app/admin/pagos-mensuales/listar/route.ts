import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type PagoMensualRow = {
  id: number
  actividad_id: number | null
  inscripcion_id: number | null
  anio: number
  mes: number
  estado: string
  medio_pago?: string | null
  monto: string
  moneda: string
  comprobante_nombre_archivo?: string | null
  comprobante_url?: string | null
  observaciones_admin?: string | null
}

type ReservaPagoPendienteRow = {
  id: number
  estado: string
  medio_pago?: string | null
  monto?: string | null
  monto_transferencia?: string | null
  monto_mercado_pago?: string | null
  porcentaje_recargo_mercado_pago?: number | null
  comprobante_nombre_archivo?: string | null
  comprobante_url?: string | null
  observaciones_admin?: string | null
  participante_nombre?: string | null
  participante_email?: string | null
  disponibilidades?:
    | {
        id: number
        titulo?: string | null
        actividad_slug?: string | null
        fecha?: string | null
        hora?: string | null
        duracion?: string | null
      }[]
    | null
}

type ActividadRow = {
  id: number
  slug?: string | null
  nombre?: string | null
}

type InscripcionRow = {
  id: number
  participante_nombre?: string | null
  participante_email?: string | null
}

export async function GET() {
  try {
    const auth = await requirePermission("pagos.review")

    if ("response" in auth) {
      return auth.response
    }

    const supabase = createAdminSupabaseClient()

    const { data, error } = await supabase
      .from("pagos_mensuales")
      .select("*")
      .eq("estado", "en_revision")
      .order("comprobante_subido_at", { ascending: false })

    const { data: reservasData, error: reservasError } = await supabase
      .from("reservas")
      .select(
        "id, estado, medio_pago, monto, monto_transferencia, monto_mercado_pago, porcentaje_recargo_mercado_pago, comprobante_nombre_archivo, comprobante_url, observaciones_admin, participante_nombre, participante_email, disponibilidades(id, titulo, actividad_slug, fecha, hora, duracion)"
      )
      .eq("estado", "pendiente_pago")
      .not("comprobante_nombre_archivo", "is", null)
      .order("comprobante_subido_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "No se pudieron listar los pagos", detalle: error },
        { status: 500 }
      )
    }

    if (reservasError) {
      return NextResponse.json(
        {
          error: "No se pudieron listar las reservas pendientes",
          detalle: reservasError,
        },
        { status: 500 }
      )
    }

    const pagosRaw = (data || []) as PagoMensualRow[]

    const actividadIds = Array.from(
      new Set(pagosRaw.map((item) => item.actividad_id).filter((value): value is number => Boolean(value)))
    )
    const inscripcionIds = Array.from(
      new Set(
        pagosRaw
          .map((item) => item.inscripcion_id)
          .filter((value): value is number => Boolean(value))
      )
    )

    const [{ data: actividadesData, error: actividadesError }, { data: inscripcionesData, error: inscripcionesError }] =
      await Promise.all([
        actividadIds.length > 0
          ? supabase
              .from("actividades")
              .select("id, slug, nombre")
              .in("id", actividadIds)
          : Promise.resolve({ data: [], error: null }),
        inscripcionIds.length > 0
          ? supabase
              .from("inscripciones")
              .select("id, participante_nombre, participante_email")
              .in("id", inscripcionIds)
          : Promise.resolve({ data: [], error: null }),
      ])

    if (actividadesError) {
      return NextResponse.json(
        { error: "No se pudieron cargar las actividades de los pagos", detalle: actividadesError },
        { status: 500 }
      )
    }

    if (inscripcionesError) {
      return NextResponse.json(
        { error: "No se pudieron cargar los participantes de los pagos", detalle: inscripcionesError },
        { status: 500 }
      )
    }

    const actividadesPorId = new Map(
      (((actividadesData as ActividadRow[] | null) || [])).map((item) => [
        item.id,
        { slug: item.slug || "", nombre: item.nombre || "" },
      ])
    )
    const inscripcionesPorId = new Map(
      (((inscripcionesData as InscripcionRow[] | null) || [])).map((item) => [
        item.id,
        {
          participante_nombre: item.participante_nombre || "",
          participante_email: item.participante_email || "",
        },
      ])
    )

    const pagos = pagosRaw.map((item) => {
      const actividad = item.actividad_id
        ? actividadesPorId.get(item.actividad_id)
        : null
      const inscripcion = item.inscripcion_id
        ? inscripcionesPorId.get(item.inscripcion_id)
        : null

      return {
        id: item.id,
        anio: item.anio,
        mes: item.mes,
        estado: item.estado,
        medio_pago: item.medio_pago,
        monto: item.monto,
        moneda: item.moneda,
        comprobante_nombre_archivo: item.comprobante_nombre_archivo,
        comprobante_url: item.comprobante_url,
        observaciones_admin: item.observaciones_admin,
        actividad_slug: actividad?.slug || "",
        actividad_nombre: actividad?.nombre || "",
        participante_nombre: inscripcion?.participante_nombre || "",
        participante_email: inscripcion?.participante_email || "",
      }
    })

    const reservasPendientes = (
      (reservasData as ReservaPagoPendienteRow[] | null) || []
    ).map((item) => {
      const disponibilidad = item.disponibilidades?.[0] || null

      return {
        id: item.id,
        estado: item.estado,
        medio_pago: item.medio_pago || null,
        monto: item.monto || null,
        monto_transferencia: item.monto_transferencia || item.monto || null,
        monto_mercado_pago: item.monto_mercado_pago || null,
        porcentaje_recargo_mercado_pago:
          item.porcentaje_recargo_mercado_pago ?? null,
        comprobante_nombre_archivo: item.comprobante_nombre_archivo || null,
        comprobante_url: item.comprobante_url || null,
        observaciones_admin: item.observaciones_admin || null,
        participante_nombre: item.participante_nombre || "",
        participante_email: item.participante_email || "",
        actividad_slug: disponibilidad?.actividad_slug || "",
        actividad_nombre:
          disponibilidad?.actividad_slug === "terapia"
            ? "Terapia"
            : disponibilidad?.actividad_slug === "mentorias"
              ? "Mentorías"
              : disponibilidad?.actividad_slug || "",
        titulo: disponibilidad?.titulo || "Encuentro",
        fecha: disponibilidad?.fecha || "",
        hora: disponibilidad?.hora || "",
        duracion: disponibilidad?.duracion || "",
      }
    })

    return NextResponse.json({
      ok: true,
      pagos,
      reservasPendientes,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno listando pagos",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
