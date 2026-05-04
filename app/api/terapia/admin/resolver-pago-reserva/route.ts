import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { crearEventoGoogleDesdeReserva } from "@/lib/google-calendar"

type Body = {
  reservaId?: number
  accion?: "aprobar" | "rechazar"
  observacionesAdmin?: string
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("terapia.admin")

    if ("response" in auth) {
      return auth.response
    }

    const body = (await req.json()) as Body
    const reservaId = Number(body.reservaId)
    const accion = body.accion
    const observacionesAdmin = String(body.observacionesAdmin || "").trim()

    if (!reservaId || Number.isNaN(reservaId) || !accion) {
      return NextResponse.json(
        { error: "Faltan datos válidos para resolver la reserva." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: reservaData, error: reservaError } = await supabase
      .from("reservas")
      .select("*, disponibilidades(*)")
      .eq("id", reservaId)
      .single()

    if (reservaError || !reservaData?.disponibilidades) {
      return NextResponse.json(
        { error: "No se encontró la reserva." },
        { status: 404 }
      )
    }

    const reserva = reservaData
    const disponibilidad = reservaData.disponibilidades

    if (accion === "rechazar") {
      const [{ error: updateReservaError }, { error: updateDisponibilidadError }] =
        await Promise.all([
          supabase
            .from("reservas")
            .update({
              estado: "cancelada",
              observaciones_admin: observacionesAdmin || null,
            })
            .eq("id", reservaId),
          supabase
            .from("disponibilidades")
            .update({
              estado: "disponible",
              reservado_por: null,
            })
            .eq("id", disponibilidad.id),
        ])

      if (updateReservaError || updateDisponibilidadError) {
        return NextResponse.json(
          {
            error: "No se pudo rechazar la reserva.",
            detalle: updateReservaError || updateDisponibilidadError,
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ok: true,
        reservaId,
        accion,
      })
    }

    const [{ error: updateReservaError }, { error: updateDisponibilidadError }] =
      await Promise.all([
        supabase
          .from("reservas")
          .update({
            estado: "confirmada",
            observaciones_admin: observacionesAdmin || null,
          })
          .eq("id", reservaId),
        supabase
          .from("disponibilidades")
          .update({
            estado: "confirmada",
            reservado_por: reserva.participante_nombre,
            sync_status: "pendiente",
          })
          .eq("id", disponibilidad.id),
      ])

    if (updateReservaError || updateDisponibilidadError) {
      return NextResponse.json(
        {
          error: "No se pudo aprobar la reserva.",
          detalle: updateReservaError || updateDisponibilidadError,
        },
        { status: 500 }
      )
    }

    let advertencia: string | null = null

    try {
      await crearEventoGoogleDesdeReserva({
        reserva: {
          ...reserva,
          estado: "confirmada",
          observaciones_admin: observacionesAdmin || null,
        },
        disponibilidad: {
          ...disponibilidad,
          estado: "confirmada",
        },
        googleOwnerEmail: process.env.GOOGLE_CALENDAR_OWNER_EMAIL,
      })
    } catch (googleError) {
      advertencia =
        "La reserva fue aprobada, pero no se pudo crear el evento en Google Calendar automáticamente. Podés revisarlo o cargarlo manualmente."
      console.error("Error creando evento de Google Calendar", googleError)
    }

    return NextResponse.json({
      ok: true,
      reservaId,
      accion,
      advertencia,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno resolviendo el pago de la reserva",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
