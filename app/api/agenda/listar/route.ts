import { NextResponse } from "next/server"
import { requireAuthenticatedActor } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { normalizarModalidadPago } from "@/lib/billing"
import { asegurarActividadBase } from "@/lib/core-activities"

export async function GET() {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const supabase = createAdminSupabaseClient()
    const esAdmin = auth.actor.role === "admin"

    const { data: disponibilidadesCrudas, error: disponibilidadesError } = await supabase
      .from("disponibilidades")
      .select("*")
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true })

    if (disponibilidadesError) {
      return NextResponse.json(
        {
          error: "Error cargando disponibilidades",
          detalle: disponibilidadesError,
        },
        { status: 500 }
      )
    }

    const disponibilidades = esAdmin
      ? disponibilidadesCrudas || []
      : (disponibilidadesCrudas || []).filter((item) => {
          const participanteAsignado =
            String(item.participante_email || "").trim().toLowerCase()
          const esPropiaFijaUnoAUno =
            item.modo === "actividad_fija" &&
            (item.actividad_slug === "mentorias" || item.actividad_slug === "terapia") &&
            participanteAsignado === auth.actor.email
          const esActividadGrupalFija =
            item.modo === "actividad_fija" &&
            (item.actividad_slug === "casatalentos" ||
              item.actividad_slug === "conectando-sentidos")
          const esDisponibilidadReservablePublica =
            item.modo === "disponibilidad" && item.estado === "disponible"

          return (
            esPropiaFijaUnoAUno ||
            esActividadGrupalFija ||
            esDisponibilidadReservablePublica
          )
        })

    let disponibilidadesFinales = disponibilidades

    if (!esAdmin) {
      const actividadTerapia = await asegurarActividadBase("terapia")

      disponibilidadesFinales = disponibilidades.map((item) => {
        if (
          item.actividad_slug !== "terapia" ||
          item.modo !== "disponibilidad"
        ) {
          return item
        }

        const monto = String(item.precio || "")
          .replace(/[^\d]/g, "")
          .trim()
        const requierePagoConfigurado =
          Boolean(monto) &&
          !Number.isNaN(Number(monto)) &&
          Number(monto) > 0

        return {
          ...item,
          requiere_pago: requierePagoConfigurado || Boolean(item.requiere_pago),
          precio: monto,
        }
      })

      if (actividadTerapia?.id) {
        const { data: honorarioTerapia } = await supabase
          .from("honorarios_participante")
          .select("honorario_mensual, modalidad_pago")
          .eq("actividad_id", actividadTerapia.id)
          .eq("participante_email", auth.actor.email)
          .eq("activo", true)
          .maybeSingle()

        if (honorarioTerapia) {
          const modalidad = normalizarModalidadPago(
            honorarioTerapia.modalidad_pago,
            "terapia"
          )

          disponibilidadesFinales = disponibilidadesFinales.map((item) => {
            if (
              item.actividad_slug !== "terapia" ||
              item.modo !== "disponibilidad"
            ) {
              return item
            }

            if (modalidad === "sesion") {
              return {
                ...item,
                requiere_pago: true,
                precio: String(honorarioTerapia.honorario_mensual),
              }
            }

            if (modalidad === "proceso") {
              return {
                ...item,
                requiere_pago: false,
              }
            }

            return item
          })
        }
      }
    }

    let reservasQuery = supabase
      .from("reservas")
      .select("*, disponibilidades(*)")
      .order("created_at", { ascending: false })

    if (!esAdmin) {
      reservasQuery = reservasQuery.eq("participante_email", auth.actor.email)
    }

    const { data: reservas, error: reservasError } = await reservasQuery

    if (reservasError) {
      return NextResponse.json(
        {
          error: "Error cargando reservas",
          detalle: reservasError,
        },
        { status: 500 }
      )
    }

    let pagosQuery = supabase
      .from("pagos_mensuales")
      .select("*, actividades(*), inscripciones(*)")
      .order("created_at", { ascending: false })

    if (!esAdmin) {
      pagosQuery = pagosQuery.eq("inscripciones.participante_email", auth.actor.email)
    }

    const { data: pagosMensuales, error: pagosError } = await pagosQuery

    if (pagosError) {
      return NextResponse.json(
        {
          error: "Error cargando pagos mensuales",
          detalle: pagosError,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      disponibilidades: disponibilidadesFinales,
      reservas: reservas || [],
      pagosMensuales: pagosMensuales || [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno cargando agenda",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
