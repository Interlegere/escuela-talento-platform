import { NextResponse } from "next/server"
import { requireAuthenticatedActor } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  pagoMensualId: number
}

type PagoMensualRow = {
  id: number
  estado: string
  mp_external_reference?: string | null
  mp_payment_id?: string | null
  mp_status?: string | null
  inscripciones?: {
    participante_email?: string | null
  } | null
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
    const pagoMensualId = Number(body.pagoMensualId)

    if (!pagoMensualId) {
      return NextResponse.json(
        { error: "Falta pagoMensualId" },
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

    const { data: pago, error: pagoError } = await supabase
      .from("pagos_mensuales")
      .select("id, estado, mp_external_reference, mp_payment_id, mp_status, inscripciones(participante_email)")
      .eq("id", pagoMensualId)
      .single()

    if (pagoError || !pago) {
      return NextResponse.json(
        { error: "No se encontró el pago mensual", detalle: pagoError },
        { status: 404 }
      )
    }

    const pagoRow = pago as PagoMensualRow
    const emailPago = (pagoRow.inscripciones?.participante_email || "")
      .trim()
      .toLowerCase()

    if (auth.actor.role !== "admin" && emailPago !== auth.actor.email) {
      return NextResponse.json(
        { error: "No tenés permisos para verificar este pago." },
        { status: 403 }
      )
    }

    if (pagoRow.estado === "pagado") {
      return NextResponse.json({
        ok: true,
        pagoMensualId,
        estado: pagoRow.estado,
        mpStatus: pagoRow.mp_status || null,
        alreadyPaid: true,
      })
    }

    const externalReference = (pagoRow.mp_external_reference || "").trim()

    if (!externalReference) {
      return NextResponse.json(
        {
          error:
            "Este pago todavía no tiene una referencia de Mercado Pago para verificar.",
        },
        { status: 409 }
      )
    }

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
      return NextResponse.json(
        {
          ok: true,
          pagoMensualId,
          estado: pagoRow.estado,
          mpStatus: pagoRow.mp_status || "pending",
          message:
            "Mercado Pago todavía no devolvió una confirmación para este pago.",
        }
      )
    }

    const mpStatus = String(payment.status || "pending")
    const nuevoEstado = mpStatus === "approved" ? "pagado" : "pendiente"

    const { error: updateError } = await supabase
      .from("pagos_mensuales")
      .update({
        estado: nuevoEstado,
        medio_pago: "mercado_pago",
        mp_payment_id: payment.id ? String(payment.id) : pagoRow.mp_payment_id || null,
        mp_status: mpStatus,
        mp_external_reference: String(
          payment.external_reference || externalReference
        ),
      })
      .eq("id", pagoMensualId)

    if (updateError) {
      return NextResponse.json(
        {
          error: "No se pudo actualizar el estado del pago mensual.",
          detalle: updateError,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      pagoMensualId,
      estado: nuevoEstado,
      mpStatus,
      paymentId: payment.id ? String(payment.id) : null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error reconciliando el pago con Mercado Pago.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
