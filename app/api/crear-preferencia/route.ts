import { NextResponse } from "next/server"
import {
  hasPermission,
  requireAuthenticatedActor,
} from "@/lib/authz"
import { normalizarModalidadPago } from "@/lib/billing"
import { asegurarActividadBase } from "@/lib/core-activities"
import { calcularMontosPagoMensualConfigurado } from "@/lib/payment-pricing"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { obtenerAppUrl } from "@/lib/server-url"

type CrearPreferenciaBody = {
  disponibilidadId?: number
  reservaId?: number
  comprador?: string
  email?: string
  telefono?: string
  mensaje?: string
  prepararSolo?: boolean
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

type DisponibilidadRow = {
  id: number
  titulo: string
  actividad_slug?: string | null
  modo?: string | null
  meet_link?: string | null
  requiere_pago?: boolean | null
  precio?: string | null
  estado?: string | null
}

type ReservaRow = {
  id: number
  disponibilidad_id: number
  estado?: string | null
  participante_nombre?: string | null
  participante_email?: string | null
  monto?: string | null
  monto_transferencia?: string | null
  monto_mercado_pago?: string | null
  medio_pago?: string | null
  mp_preference_id?: string | null
  mp_external_reference?: string | null
  disponibilidades?: DisponibilidadRow | null
}

function normalizarMonto(input: string | number | null | undefined) {
  return String(input || "")
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/[^\d]/g, "")
    .trim()
}

function abrirPayloadMercadoPago(params: {
  reservaId: number
  monto: number
  titulo: string
  appUrl: string
  participanteNombre?: string | null
  participanteEmail?: string | null
}) {
  const { reservaId, monto, titulo, appUrl, participanteNombre, participanteEmail } =
    params

  const isPublicUrl =
    appUrl.startsWith("https://") && !appUrl.includes("localhost")

  const payload: MercadoPagoPayload = {
    items: [
      {
        title: titulo,
        quantity: 1,
        unit_price: monto,
      },
    ],
    external_reference: String(reservaId),
  }

  if (isPublicUrl) {
    payload.back_urls = {
      success: `${appUrl}/agenda?mp_status=success&reserva_id=${reservaId}`,
      failure: `${appUrl}/agenda?mp_status=failure&reserva_id=${reservaId}`,
      pending: `${appUrl}/agenda?mp_status=pending&reserva_id=${reservaId}`,
    }

    payload.auto_return = "approved"
    payload.notification_url = `${appUrl}/api/mp-webhook`
  }

  if (participanteNombre) {
    payload.payer = {
      name: participanteNombre,
    }

    if (participanteEmail) {
      payload.payer.email = participanteEmail
    }
  }

  return payload
}

async function crearPreferenciaMercadoPago(params: {
  accessToken: string
  appUrl: string
  reserva: ReservaRow
  disponibilidad: DisponibilidadRow
}) {
  const { accessToken, appUrl, reserva, disponibilidad } = params
  const montoBase = normalizarMonto(
    reserva.monto_transferencia || reserva.monto || disponibilidad.precio || "0"
  )
  const resumenMontos = await calcularMontosPagoMensualConfigurado(montoBase)
  const montoMercadoPago = resumenMontos.montoMercadoPago

  if (!montoMercadoPago || Number.isNaN(Number(montoMercadoPago))) {
    throw new Error("El monto para Mercado Pago es inválido.")
  }

  const mpPayload = abrirPayloadMercadoPago({
    reservaId: reserva.id,
    monto: Number(montoMercadoPago),
    titulo: disponibilidad.titulo,
    appUrl,
    participanteNombre: reserva.participante_nombre,
    participanteEmail: reserva.participante_email,
  })

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
    throw new Error(
      `Error creando preferencia en Mercado Pago: ${JSON.stringify(mpData)}`
    )
  }

  return {
    initPoint: mpData.init_point as string | undefined,
    preferenceId: (mpData.id as string | undefined) || null,
    resumenMontos,
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    if (!hasPermission(auth.actor, "agenda.reserve")) {
      return NextResponse.json(
        { error: "No tenés permisos para reservar." },
        { status: 403 }
      )
    }

    const body: CrearPreferenciaBody = await req.json()
    const {
      disponibilidadId,
      reservaId,
      comprador,
      email,
      telefono,
      mensaje,
      prepararSolo = false,
    } = body

    const supabase = createAdminSupabaseClient()
    const appUrl = obtenerAppUrl(req)

    const participanteNombre =
      auth.actor.role === "admin" && comprador?.trim()
        ? comprador.trim()
        : auth.actor.name
    const participanteEmail =
      auth.actor.role === "admin" && email?.trim()
        ? email.trim().toLowerCase()
        : auth.actor.email

    if (reservaId) {
      const { data: reservaExistente, error: reservaExistenteError } = await supabase
        .from("reservas")
        .select("*, disponibilidades(*)")
        .eq("id", reservaId)
        .single()

      const reserva = reservaExistente as ReservaRow | null

      if (reservaExistenteError || !reserva || !reserva.disponibilidades) {
        return NextResponse.json(
          { error: "No se encontró la reserva para iniciar el pago." },
          { status: 404 }
        )
      }

      const esAdmin = auth.actor.role === "admin"
      const esTitular =
        String(reserva.participante_email || "").trim().toLowerCase() ===
        auth.actor.email

      if (!esAdmin && !esTitular) {
        return NextResponse.json(
          { error: "No tenés permisos para pagar esta reserva." },
          { status: 403 }
        )
      }

      const accessToken = process.env.MP_ACCESS_TOKEN

      if (!accessToken) {
        return NextResponse.json(
          { error: "Falta MP_ACCESS_TOKEN en .env.local" },
          { status: 500 }
        )
      }

      const preferencia = await crearPreferenciaMercadoPago({
        accessToken,
        appUrl,
        reserva,
        disponibilidad: reserva.disponibilidades,
      })

      const { error: updateReservaError } = await supabase
        .from("reservas")
        .update({
          medio_pago: "mercado_pago",
          mp_preference_id: preferencia.preferenceId,
          mp_external_reference: String(reserva.id),
          mp_status: "pending",
          monto_mercado_pago: String(preferencia.resumenMontos.montoMercadoPago),
          porcentaje_recargo_mercado_pago:
            preferencia.resumenMontos.porcentajeRecargoMercadoPago,
        })
        .eq("id", reserva.id)

      if (updateReservaError) {
        return NextResponse.json(
          {
            error:
              "Se creó la preferencia, pero no se pudo actualizar la reserva.",
            detalle: updateReservaError,
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ok: true,
        init_point: preferencia.initPoint,
        reserva_id: reserva.id,
        requiere_pago: true,
        resumenMontos: preferencia.resumenMontos,
      })
    }

    if (!disponibilidadId) {
      return NextResponse.json(
        { error: "Falta disponibilidadId" },
        { status: 400 }
      )
    }

    const { data: disponibilidadData, error: disponibilidadError } = await supabase
      .from("disponibilidades")
      .select("*")
      .eq("id", disponibilidadId)
      .single()

    const disponibilidad = disponibilidadData as DisponibilidadRow | null

    if (disponibilidadError || !disponibilidad) {
      return NextResponse.json(
        {
          error: "No se encontró la disponibilidad",
          detalle: disponibilidadError,
        },
        { status: 404 }
      )
    }

    if (disponibilidad.modo && disponibilidad.modo !== "disponibilidad") {
      return NextResponse.json(
        { error: "Este registro no es reservable" },
        { status: 400 }
      )
    }

    const { data: reservaActivaData } = await supabase
      .from("reservas")
      .select("*, disponibilidades(*)")
      .eq("disponibilidad_id", disponibilidad.id)
      .in("estado", ["pendiente_pago", "confirmada"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const reservaActiva = reservaActivaData as ReservaRow | null

    if (reservaActiva) {
      const esMismoParticipante =
        String(reservaActiva.participante_email || "").trim().toLowerCase() ===
        participanteEmail

      if (esMismoParticipante && reservaActiva.estado === "pendiente_pago") {
        const resumenMontos = await calcularMontosPagoMensualConfigurado(
          reservaActiva.monto_transferencia || reservaActiva.monto || "0"
        )

        return NextResponse.json({
          ok: true,
          requiere_pago: true,
          reserva_id: reservaActiva.id,
          resumenMontos,
          ya_existia: true,
        })
      }

      return NextResponse.json(
        {
          error:
            "Este horario ya está reservado o en proceso de pago por otra persona.",
        },
        { status: 409 }
      )
    }

    if (disponibilidad.estado !== "disponible") {
      return NextResponse.json(
        {
          error: "La disponibilidad ya no está disponible",
          estado_actual: disponibilidad.estado,
        },
        { status: 400 }
      )
    }

    let requierePago = Boolean(disponibilidad.requiere_pago)
    let montoBase = normalizarMonto(disponibilidad.precio || "0")
    const disponibilidadTieneHonorario =
      Boolean(montoBase) &&
      !Number.isNaN(Number(montoBase)) &&
      Number(montoBase) > 0

    if (
      disponibilidad.actividad_slug === "terapia" &&
      disponibilidad.modo === "disponibilidad" &&
      participanteEmail
    ) {
      const actividadTerapia = await asegurarActividadBase("terapia")
      let honorarioTerapia:
        | {
            honorario_mensual?: string | number | null
            modalidad_pago?: string | null
          }
        | null = null

      if (actividadTerapia?.id) {
        const { data } = await supabase
          .from("honorarios_participante")
          .select("honorario_mensual, modalidad_pago")
          .eq("actividad_id", actividadTerapia.id)
          .eq("participante_email", participanteEmail)
          .eq("activo", true)
          .maybeSingle()

        honorarioTerapia = data
      }

      if (honorarioTerapia) {
        const modalidad = normalizarModalidadPago(
          honorarioTerapia.modalidad_pago,
          "terapia"
        )

        if (modalidad === "sesion") {
          requierePago = true
          montoBase = normalizarMonto(honorarioTerapia.honorario_mensual || "0")
        }

        if (modalidad === "proceso") {
          requierePago = false
          montoBase = "0"
        }
      } else if (disponibilidadTieneHonorario) {
        requierePago = true
      } else {
        return NextResponse.json(
          {
            error:
              "Todavía no hay un honorario configurado para esta sesión de Terapia. Definilo desde Admin Pagos o cargalo al crear la disponibilidad.",
          },
          { status: 409 }
        )
      }
    }

    if (
      requierePago &&
      (!montoBase || Number.isNaN(Number(montoBase)) || Number(montoBase) <= 0)
    ) {
      return NextResponse.json(
        {
          error:
            "El honorario configurado para esta reserva es inválido. Revisalo desde Admin Pagos.",
          precio_original: disponibilidad.precio,
          monto_convertido: montoBase,
        },
        { status: 400 }
      )
    }

    const resumenMontos = await calcularMontosPagoMensualConfigurado(montoBase)

    const { data: reservaData, error: reservaError } = await supabase
      .from("reservas")
      .insert({
        disponibilidad_id: disponibilidad.id,
        estado: requierePago ? "pendiente_pago" : "confirmada",
        participante_nombre: participanteNombre,
        participante_email: participanteEmail || null,
        participante_telefono: telefono?.trim() || null,
        participante_mensaje: mensaje?.trim() || null,
        monto: montoBase,
        monto_transferencia: montoBase,
        monto_mercado_pago: requierePago
          ? String(resumenMontos.montoMercadoPago)
          : null,
        porcentaje_recargo_mercado_pago: requierePago
          ? resumenMontos.porcentajeRecargoMercadoPago
          : null,
        medio_pago: requierePago ? null : "sin_cargo",
        moneda: "ARS",
      })
      .select("*")
      .single()

    const reserva = reservaData as ReservaRow | null

    if (reservaError || !reserva) {
      return NextResponse.json(
        {
          error: "No se pudo crear la reserva",
          detalle: reservaError,
        },
        { status: 500 }
      )
    }

    const estadoDisponibilidadDestino = requierePago
      ? "pendiente_pago"
      : "confirmada"

    const { error: updateDisponibilidadError } = await supabase
      .from("disponibilidades")
      .update({
        estado: estadoDisponibilidadDestino,
        reservado_por: participanteNombre,
      })
      .eq("id", disponibilidad.id)

    if (updateDisponibilidadError) {
      return NextResponse.json(
        {
          error:
            "Se creó la reserva, pero no se pudo actualizar la disponibilidad.",
          detalle: updateDisponibilidadError,
        },
        { status: 500 }
      )
    }

    if (!requierePago) {
      return NextResponse.json({
        ok: true,
        requiere_pago: false,
        reserva_id: reserva.id,
        message: "Reserva confirmada sin pago",
      })
    }

    if (prepararSolo) {
      return NextResponse.json({
        ok: true,
        requiere_pago: true,
        reserva_id: reserva.id,
        resumenMontos,
      })
    }

    const accessToken = process.env.MP_ACCESS_TOKEN

    if (!accessToken) {
      return NextResponse.json(
        { error: "Falta MP_ACCESS_TOKEN en .env.local" },
        { status: 500 }
      )
    }

    const preferencia = await crearPreferenciaMercadoPago({
      accessToken,
      appUrl,
      reserva,
      disponibilidad,
    })

    const { error: updateReservaError } = await supabase
      .from("reservas")
      .update({
        medio_pago: "mercado_pago",
        mp_preference_id: preferencia.preferenceId,
        mp_external_reference: String(reserva.id),
        mp_status: "pending",
        monto_mercado_pago: String(preferencia.resumenMontos.montoMercadoPago),
        porcentaje_recargo_mercado_pago:
          preferencia.resumenMontos.porcentajeRecargoMercadoPago,
      })
      .eq("id", reserva.id)

    if (updateReservaError) {
      return NextResponse.json(
        {
          error: "Se creó la preferencia pero no se pudo actualizar la reserva",
          detalle: updateReservaError,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      init_point: preferencia.initPoint,
      reserva_id: reserva.id,
      requiere_pago: true,
      resumenMontos: preferencia.resumenMontos,
    })
  } catch (error) {
    console.error("[crear-preferencia] catch error:", error)

    return NextResponse.json(
      {
        error: "Error interno al crear la preferencia",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
