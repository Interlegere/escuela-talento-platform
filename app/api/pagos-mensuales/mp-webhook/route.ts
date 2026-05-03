import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const paymentId = body.data?.id

    console.info("[mp-webhook-mensual] Notificación recibida", {
      type: body.type,
      paymentId: paymentId || null,
    })

    if (body.type !== "payment") {
      return NextResponse.json({ ok: true, ignored: true })
    }

    if (!paymentId) {
      return NextResponse.json(
        { ok: false, error: "Falta paymentId" },
        { status: 400 }
      )
    }

    const accessToken = process.env.MP_ACCESS_TOKEN
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!accessToken || !supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { ok: false, error: "Faltan variables de entorno" },
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
          error: "No se pudo consultar el pago mensual",
          detalle: paymentData,
        },
        { status: 500 }
      )
    }

    const externalReference = paymentData.external_reference
    const status = paymentData.status

    if (!externalReference || !String(externalReference).startsWith("mensual_")) {
      return NextResponse.json(
        { ok: false, error: "external_reference inválido" },
        { status: 400 }
      )
    }

    const pagoMensualId = Number(String(externalReference).replace("mensual_", ""))

    if (Number.isNaN(pagoMensualId)) {
      return NextResponse.json(
        { ok: false, error: "pagoMensualId inválido" },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const nuevoEstado = status === "approved" ? "pagado" : "pendiente"

    const { error: updateError } = await supabase
      .from("pagos_mensuales")
      .update({
        estado: nuevoEstado,
        medio_pago: "mercado_pago",
        mp_payment_id: String(paymentId),
        mp_status: status,
        mp_external_reference: String(externalReference),
      })
      .eq("id", pagoMensualId)

    if (updateError) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo actualizar el pago mensual",
          detalle: updateError,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      pagoMensualId,
      paymentId,
      status,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Error en webhook mensual",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
