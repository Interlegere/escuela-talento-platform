import { NextResponse } from "next/server"
import {
  requireAuthenticatedActor,
  type ActivitySlug,
} from "@/lib/authz"
import { asegurarActividadBase } from "@/lib/core-activities"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { calcularMontosPagoMensualConfigurado } from "@/lib/payment-pricing"
import { normalizarModalidadPago } from "@/lib/billing"

type Body = {
  actividadSlug: string
  participanteNombre: string
  participanteEmail: string
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

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()

    const actividadSlug = body.actividadSlug as ActivitySlug
    const participanteNombre =
      auth.actor.role === "admin" && body.participanteNombre
        ? body.participanteNombre.trim()
        : auth.actor.name
    const participanteEmail =
      auth.actor.role === "admin" && body.participanteEmail
        ? body.participanteEmail.trim().toLowerCase()
        : auth.actor.email

    if (!actividadSlug || !participanteNombre || !participanteEmail) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios" },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const actividadBase =
      actividadSlug === "membresia"
        ? null
        : await asegurarActividadBase(
            actividadSlug as Exclude<ActivitySlug, "membresia">
          )

    const { data: actividad, error: actividadError } = await supabase
      .from("actividades")
      .select("*")
      .eq("slug", actividadBase?.slug || actividadSlug)
      .single()

    if (actividadError || !actividad) {
      return NextResponse.json(
        { error: "No se encontró la actividad", detalle: actividadError },
        { status: 404 }
      )
    }

    const { data: honorario, error: honorarioError } = await supabase
      .from("honorarios_participante")
      .select("*")
      .eq("actividad_id", actividad.id)
      .eq("participante_email", participanteEmail)
      .eq("activo", true)
      .maybeSingle()

    if (honorarioError) {
      return NextResponse.json(
        { error: "Error buscando honorario asignado", detalle: honorarioError },
        { status: 500 }
      )
    }

    if (!honorario) {
      return NextResponse.json(
        { error: "No tenés un honorario asignado para esta actividad." },
        { status: 403 }
      )
    }

    const honorarioRow = honorario as HonorarioRow
    const modalidadPago = normalizarModalidadPago(
      honorarioRow.modalidad_pago,
      actividadSlug
    )
    const nombreResuelto = honorarioRow.participante_nombre?.trim() || participanteNombre

    if (modalidadPago === "sesion") {
      return NextResponse.json(
        {
          error:
            "Esta actividad se abona por sesión. El cobro se gestiona al reservar cada encuentro.",
          modalidadPago,
          actividad,
        },
        { status: 409 }
      )
    }

    const { data: inscripcionExistente, error: inscripcionError } = await supabase
      .from("inscripciones")
      .select("*")
      .eq("actividad_id", actividad.id)
      .eq("participante_email", participanteEmail)
      .eq("estado", "activa")
      .maybeSingle()

    if (inscripcionError) {
      return NextResponse.json(
        { error: "Error buscando inscripción", detalle: inscripcionError },
        { status: 500 }
      )
    }

    let inscripcion = inscripcionExistente

    if (!inscripcion) {
      const { data: nuevaInscripcion, error: nuevaInscripcionError } = await supabase
        .from("inscripciones")
        .insert({
          actividad_id: actividad.id,
          participante_nombre: nombreResuelto,
          participante_email: participanteEmail,
          estado: "activa",
        })
        .select("*")
        .single()

      if (nuevaInscripcionError || !nuevaInscripcion) {
        return NextResponse.json(
          {
            error: "No se pudo crear la inscripción",
            detalle: nuevaInscripcionError,
          },
          { status: 500 }
        )
      }

      inscripcion = nuevaInscripcion
    }

    const ahora = new Date()
    const anio = ahora.getFullYear()
    const mes = ahora.getMonth() + 1

    let pagoExistente = null
    let pagoExistenteError = null

    if (modalidadPago === "proceso") {
      const resultado = await supabase
        .from("pagos_mensuales")
        .select("*")
        .eq("inscripcion_id", inscripcion.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      pagoExistente = resultado.data
      pagoExistenteError = resultado.error
    } else {
      const resultado = await supabase
        .from("pagos_mensuales")
        .select("*")
        .eq("inscripcion_id", inscripcion.id)
        .eq("anio", anio)
        .eq("mes", mes)
        .maybeSingle()

      pagoExistente = resultado.data
      pagoExistenteError = resultado.error
    }

    if (pagoExistenteError) {
      return NextResponse.json(
        {
          error: "Error buscando pago mensual",
          detalle: pagoExistenteError,
        },
        { status: 500 }
      )
    }

    if (pagoExistente) {
      const montoHonorario = String(honorarioRow.honorario_mensual)
      const monedaHonorario = honorarioRow.moneda || actividad.moneda || "ARS"

      if (
        String(pagoExistente.monto) !== montoHonorario ||
        String(pagoExistente.moneda || "") !== monedaHonorario
      ) {
        const { data: pagoActualizado, error: pagoActualizadoError } = await supabase
          .from("pagos_mensuales")
          .update({
            monto: montoHonorario,
            moneda: monedaHonorario,
          })
          .eq("id", pagoExistente.id)
          .select("*")
          .single()

        if (pagoActualizadoError || !pagoActualizado) {
          return NextResponse.json(
            {
              error: "No se pudo sincronizar el pago con el honorario asignado",
              detalle: pagoActualizadoError,
            },
            { status: 500 }
          )
        }

        return NextResponse.json({
          ok: true,
          actividad,
          inscripcion,
          pago: pagoActualizado,
          modalidadPago,
          resumenMontos: await calcularMontosPagoMensualConfigurado(
            pagoActualizado.monto
          ),
        })
      }

      return NextResponse.json({
        ok: true,
        actividad,
        inscripcion,
        pago: pagoExistente,
        modalidadPago,
        resumenMontos: await calcularMontosPagoMensualConfigurado(
          pagoExistente.monto
        ),
      })
    }

    const { data: nuevoPago, error: nuevoPagoError } = await supabase
      .from("pagos_mensuales")
      .insert({
        actividad_id: actividad.id,
        inscripcion_id: inscripcion.id,
        anio,
        mes,
        estado: "pendiente",
        monto: String(honorarioRow.honorario_mensual),
        moneda: honorarioRow.moneda || actividad.moneda || "ARS",
      })
      .select("*")
      .single()

    if (nuevoPagoError || !nuevoPago) {
      return NextResponse.json(
        {
          error: "No se pudo crear el pago mensual",
          detalle: nuevoPagoError,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      actividad,
      inscripcion,
      pago: nuevoPago,
      modalidadPago,
      resumenMontos: await calcularMontosPagoMensualConfigurado(nuevoPago.monto),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno al obtener o crear pago mensual",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
