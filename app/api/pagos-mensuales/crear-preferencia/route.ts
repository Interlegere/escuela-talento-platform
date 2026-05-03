import { NextResponse } from "next/server"
import { requireAuthenticatedActor } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { obtenerAppUrl } from "@/lib/server-url"
import { calcularMontosPagoMensualConfigurado } from "@/lib/payment-pricing"

type Body = {
  pagoMensualId: number
  participanteNombre?: string
  participanteEmail?: string
}

type MercadoPagoPayload = {
  items: Array<{
    title: string
    quantity: number
    unit_price: number
  }>
  external_reference: string
  back_urls?: {
    success: string
    failure: string
    pending: string
  }
  auto_return?: "approved"
  notification_url?: string
  payer?: {
    name: string
    email?: string
  }
}

type PagoMensualRow = {
  id: number
  actividad_id: number | null
  inscripcion_id: number | null
  anio: number
  mes: number
  monto: string | number | null
}

type ActividadRow = {
  id: number
  nombre?: string | null
}

type InscripcionRow = {
  id: number
  participante_nombre?: string | null
  participante_email?: string | null
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const pagoMensualId = Number(body.pagoMensualId)

    if (!pagoMensualId) {
      return NextResponse.json(
        { error: "Falta pagoMensualId" },
        { status: 400 }
      )
    }

    const accessToken = process.env.MP_ACCESS_TOKEN
    const appUrl = obtenerAppUrl(req)

    if (!accessToken) {
      return NextResponse.json(
        { error: "Falta MP_ACCESS_TOKEN en .env.local" },
        { status: 500 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: pago, error: pagoError } = await supabase
      .from("pagos_mensuales")
      .select("*")
      .eq("id", pagoMensualId)
      .single()

    if (pagoError || !pago) {
      return NextResponse.json(
        { error: "No se encontró el pago mensual", detalle: pagoError },
        { status: 404 }
      )
    }

    const pagoRow = pago as PagoMensualRow

    const [{ data: actividad }, { data: inscripcion }] = await Promise.all([
      pagoRow.actividad_id
        ? supabase
            .from("actividades")
            .select("id, nombre")
            .eq("id", pagoRow.actividad_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      pagoRow.inscripcion_id
        ? supabase
            .from("inscripciones")
            .select("id, participante_nombre, participante_email")
            .eq("id", pagoRow.inscripcion_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const actividadRow = actividad as ActividadRow | null
    const inscripcionRow = inscripcion as InscripcionRow | null

    const emailPago = (inscripcionRow?.participante_email || "").trim().toLowerCase()
    const puedeAdministrar = auth.actor.role === "admin"

    if (!puedeAdministrar && emailPago !== auth.actor.email) {
      return NextResponse.json(
        { error: "No tenés permisos para iniciar este pago." },
        { status: 403 }
      )
    }

    const { montoMercadoPago, porcentajeRecargoMercadoPago } =
      await calcularMontosPagoMensualConfigurado(pagoRow.monto)
    const monto = montoMercadoPago

    if (Number.isNaN(monto) || monto <= 0) {
      return NextResponse.json(
        { error: "El monto del pago mensual es inválido." },
        { status: 400 }
      )
    }

    const participanteNombre =
      auth.actor.role === "admin" && body.participanteNombre?.trim()
        ? body.participanteNombre.trim()
        : inscripcionRow?.participante_nombre?.trim() || auth.actor.name
    const participanteEmail =
      auth.actor.role === "admin" && body.participanteEmail?.trim()
        ? body.participanteEmail.trim().toLowerCase()
        : emailPago || auth.actor.email

    const externalReference = `mensual_${pagoMensualId}`
    const isPublicUrl =
      appUrl.startsWith("https://") && !appUrl.includes("localhost")

    const mpPayload: MercadoPagoPayload = {
      items: [
        {
          title: `${actividadRow?.nombre || "Actividad"} ${String(pagoRow.mes).padStart(2, "0")}/${pagoRow.anio}`,
          quantity: 1,
          unit_price: monto,
        },
      ],
      external_reference: externalReference,
    }

    if (isPublicUrl) {
      mpPayload.back_urls = {
        success: `${appUrl}/pagos?mp_status=success&pago_mensual_id=${pagoMensualId}`,
        failure: `${appUrl}/pagos?mp_status=failure&pago_mensual_id=${pagoMensualId}`,
        pending: `${appUrl}/pagos?mp_status=pending&pago_mensual_id=${pagoMensualId}`,
      }
      mpPayload.auto_return = "approved"
      mpPayload.notification_url = `${appUrl}/api/pagos-mensuales/mp-webhook`
    }

    if (participanteNombre) {
      mpPayload.payer = {
        name: participanteNombre,
      }

      if (participanteEmail) {
        mpPayload.payer.email = participanteEmail
      }
    }

    const mpResponse = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(mpPayload),
      }
    )

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      return NextResponse.json(
        {
          error: "Error creando preferencia en Mercado Pago",
          detalle: mpData,
        },
        { status: 500 }
      )
    }

    const { error: updateError } = await supabase
      .from("pagos_mensuales")
      .update({
        mp_external_reference: externalReference,
        mp_status: "pending",
      })
      .eq("id", pagoMensualId)

    if (updateError) {
      return NextResponse.json(
        {
          error: "Se creó la preferencia pero no se pudo actualizar el pago mensual",
          detalle: updateError,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      init_point: mpData.init_point,
      pago_mensual_id: pagoMensualId,
      porcentaje_recargo_mercado_pago: porcentajeRecargoMercadoPago,
      monto_mercado_pago: montoMercadoPago,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno al crear la preferencia mensual",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
