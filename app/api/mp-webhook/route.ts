import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { crearEventoGoogleDesdeReserva } from "@/lib/google-calendar"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const paymentId = body.data?.id

    console.info("[mp-webhook] Notificación recibida", {
      type: body.type,
      paymentId: paymentId || null,
    })

    if (body.type !== "payment") {
      return NextResponse.json({ ok: true, ignored: true })
    }

    if (!paymentId) {
      return NextResponse.json(
        { ok: false, error: "Falta paymentId en webhook" },
        { status: 400 }
      )
    }

    const accessToken = process.env.MP_ACCESS_TOKEN
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "Falta MP_ACCESS_TOKEN" },
        { status: 500 }
      )
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { ok: false, error: "Faltan variables de Supabase" },
        { status: 500 }
      )
    }

    const paymentRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const paymentData = await paymentRes.json()

    if (!paymentRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo consultar el pago",
          detalle: paymentData,
        },
        { status: 500 }
      )
    }

    const externalReference = paymentData.external_reference
    const status = paymentData.status

    if (!externalReference) {
      return NextResponse.json(
        { ok: false, error: "El pago no trae external_reference" },
        { status: 400 }
      )
    }

    const reservaId = Number(externalReference)

    if (Number.isNaN(reservaId)) {
      return NextResponse.json(
        { ok: false, error: "external_reference inválido" },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: reserva, error: reservaError } = await supabase
      .from("reservas")
      .select("*")
      .eq("id", reservaId)
      .single()

    if (reservaError || !reserva) {
      return NextResponse.json(
        { ok: false, error: "No se encontró la reserva", detalle: reservaError },
        { status: 404 }
      )
    }

    const nuevoEstadoReserva =
      status === "approved" ? "confirmada" : "pendiente_pago"

    const { error: updateReservaError } = await supabase
      .from("reservas")
      .update({
        estado: nuevoEstadoReserva,
        medio_pago: "mercado_pago",
        mp_payment_id: String(paymentId),
        mp_status: status,
        mp_external_reference: String(externalReference),
      })
      .eq("id", reservaId)

    if (updateReservaError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Error actualizando la reserva",
          detalle: updateReservaError,
        },
        { status: 500 }
      )
    }

    if (status === "approved") {
      const { data: disponibilidad, error: disponibilidadError } = await supabase
        .from("disponibilidades")
        .select("*")
        .eq("id", reserva.disponibilidad_id)
        .single()

      if (disponibilidadError || !disponibilidad) {
        return NextResponse.json(
          {
            ok: false,
            error: "Pago aprobado, pero no se encontró la disponibilidad",
            detalle: disponibilidadError,
          },
          { status: 500 }
        )
      }

      const { error: updateDisponibilidadError } = await supabase
        .from("disponibilidades")
        .update({
          estado: "confirmada",
          reservado_por: reserva.participante_nombre,
          mp_payment_id: String(paymentId),
          mp_status: status,
          sync_status: "pendiente",
        })
        .eq("id", reserva.disponibilidad_id)

      if (updateDisponibilidadError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Pago aprobado pero falló la actualización de disponibilidad",
            detalle: updateDisponibilidadError,
          },
          { status: 500 }
        )
      }

      try {
        await crearEventoGoogleDesdeReserva({
          reserva: {
            ...reserva,
            estado: "confirmada",
            mp_payment_id: String(paymentId),
            mp_status: status,
          },
          disponibilidad: {
            ...disponibilidad,
            estado: "confirmada",
          },
          googleOwnerEmail: process.env.GOOGLE_CALENDAR_OWNER_EMAIL,
        })
      } catch (googleError: unknown) {
        const message =
          googleError instanceof Error
            ? googleError.message
            : String(googleError)

        return NextResponse.json(
          {
            ok: false,
            error: "Pago aprobado, pero falló la creación del evento en Google Calendar",
            detalle: message,
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      ok: true,
      paymentId,
      reservaId,
      status,
    })
  } catch (error: unknown) {
    console.error("[mp-webhook] Error webhook:", error)

    const message = error instanceof Error ? error.message : String(error)

    return NextResponse.json(
      {
        ok: false,
        error: message || "Error webhook",
      },
      { status: 500 }
    )
  }
}
