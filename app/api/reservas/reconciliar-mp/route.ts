import { NextResponse } from "next/server"
import { requireAuthenticatedActor } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  reservaId: number
}

type ReservaRow = {
  id: number
  estado: string
  participante_email?: string | null
  participante_nombre?: string | null
  disponibilidad_id: number
  mp_external_reference?: string | null
  mp_payment_id?: string | null
  mp_status?: string | null
}

type DisponibilidadRow = {
  id: number
  reservado_por?: string | null
}

type MercadoPagoSearchResult = {
  id?: number | string | null
  status?: string | null
  external_reference?: string | null
}

function pickRelevantPayment(results: MercadoPagoSearchResult[]) {
  const approved = results.find((item) => item?.status === "approved")
  if (approved) return approved
  return results[0] || null
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const body = (await req.json()) as Body
    const reservaId = Number(body.reservaId)

    if (!reservaId) {
      return NextResponse.json(
        { error: "Falta reservaId" },
        { status: 400 }
      )
    }

    const accessToken = process.env.MP_ACCESS_TOKEN

    if (!accessToken) {
      return NextResponse.json(
        { error: "Falta MP_ACCESS_TOKEN" },
        { status: 500 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: reserva, error: reservaError } = await supabase
      .from("reservas")
      .select(
        "id, estado, participante_email, participante_nombre, disponibilidad_id, mp_external_reference, mp_payment_id, mp_status"
      )
      .eq("id", reservaId)
      .single()

    if (reservaError || !reserva) {
      return NextResponse.json(
        { error: "No se encontró la reserva.", detalle: reservaError },
        { status: 404 }
      )
    }

    const reservaRow = reserva as ReservaRow
    const emailReserva = String(reservaRow.participante_email || "")
      .trim()
      .toLowerCase()

    if (auth.actor.role !== "admin" && emailReserva !== auth.actor.email) {
      return NextResponse.json(
        { error: "No tenés permisos para verificar esta reserva." },
        { status: 403 }
      )
    }

    if (reservaRow.estado === "confirmada") {
      return NextResponse.json({
        ok: true,
        reservaId,
        estado: reservaRow.estado,
        mpStatus: reservaRow.mp_status || null,
        alreadyConfirmed: true,
      })
    }

    const externalReference = (
      reservaRow.mp_external_reference || String(reservaRow.id)
    ).trim()

    const paymentSearchRes = await fetch(
      `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(
        externalReference
      )}&sort=date_created&criteria=desc&limit=10`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const paymentSearchData = await paymentSearchRes.json()

    if (!paymentSearchRes.ok) {
      return NextResponse.json(
        {
          error: "No se pudo consultar el estado del pago en Mercado Pago.",
          detalle: paymentSearchData,
        },
        { status: 500 }
      )
    }

    const results = Array.isArray(paymentSearchData.results)
      ? (paymentSearchData.results as MercadoPagoSearchResult[])
      : []

    const payment = pickRelevantPayment(results)

    if (!payment) {
      return NextResponse.json({
        ok: true,
        reservaId,
        estado: reservaRow.estado,
        mpStatus: reservaRow.mp_status || "pending",
        message:
          "Mercado Pago todavía no devolvió una confirmación para esta reserva.",
      })
    }

    const mpStatus = String(payment.status || "pending")
    const nuevoEstadoReserva =
      mpStatus === "approved" ? "confirmada" : "pendiente_pago"

    const { error: updateReservaError } = await supabase
      .from("reservas")
      .update({
        estado: nuevoEstadoReserva,
        medio_pago: "mercado_pago",
        mp_payment_id: payment.id
          ? String(payment.id)
          : reservaRow.mp_payment_id || null,
        mp_status: mpStatus,
        mp_external_reference: String(
          payment.external_reference || externalReference
        ),
      })
      .eq("id", reservaId)

    if (updateReservaError) {
      return NextResponse.json(
        {
          error: "No se pudo actualizar el estado de la reserva.",
          detalle: updateReservaError,
        },
        { status: 500 }
      )
    }

    if (mpStatus === "approved") {
      const { data: disponibilidad, error: disponibilidadError } = await supabase
        .from("disponibilidades")
        .select("id, reservado_por")
        .eq("id", reservaRow.disponibilidad_id)
        .single()

      if (disponibilidadError || !disponibilidad) {
        return NextResponse.json(
          {
            error:
              "Mercado Pago confirmó el pago, pero no se encontró la disponibilidad asociada.",
            detalle: disponibilidadError,
          },
          { status: 500 }
        )
      }

      const disponibilidadRow = disponibilidad as DisponibilidadRow

      const { error: updateDisponibilidadError } = await supabase
        .from("disponibilidades")
        .update({
          estado: "confirmada",
          reservado_por:
            reservaRow.participante_nombre ||
            disponibilidadRow.reservado_por ||
            null,
          mp_payment_id: payment.id ? String(payment.id) : null,
          mp_status: mpStatus,
          sync_status: "pendiente",
        })
        .eq("id", reservaRow.disponibilidad_id)

      if (updateDisponibilidadError) {
        return NextResponse.json(
          {
            error:
              "Mercado Pago confirmó el pago, pero no se pudo actualizar la disponibilidad.",
            detalle: updateDisponibilidadError,
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      ok: true,
      reservaId,
      estado: nuevoEstadoReserva,
      mpStatus,
      paymentId: payment.id ? String(payment.id) : null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error reconciliando la reserva con Mercado Pago.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
