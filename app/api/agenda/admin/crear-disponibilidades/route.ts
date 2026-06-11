import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { normalizarModalidadPago } from "@/lib/billing"
import { asegurarActividadBase } from "@/lib/core-activities"
import { ESTADOS_DISPONIBILIDAD_ACTIVA } from "@/lib/disponibilidades"
import { normalizarDocumentosNotas } from "@/lib/documentos-notas"
import { calcularMontosPagoMensualConfigurado } from "@/lib/payment-pricing"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type DisponibilidadInsert = {
  titulo: string
  tipo: string
  actividad_slug?: string | null
  modo: "disponibilidad" | "actividad_fija" | "bloqueo"
  fecha: string
  hora: string
  duracion: string
  meet_link: string
  requiere_pago: boolean
  precio: string
  estado: "disponible" | "pendiente_pago" | "confirmada"
  reservado_por?: string | null
  es_recurrente: boolean
  dia_semana?: string | null
  excepcion_fechas?: string | null
  google_event_id?: string | null
  google_calendar_id?: string | null
  sync_status?: string | null
  last_synced_at?: string | null
  serie_id?: string | null
  participante_email?: string | null
  participante_nombre?: string | null
  notas_documentos?: unknown
}

type Body = {
  items: DisponibilidadInsert[]
}

class ValidationError extends Error {}

type TerapiaHonorarioConfig = {
  requierePago: boolean
  montoBase: string
  montoMercadoPago: string | null
  porcentajeRecargoMercadoPago: number | null
}

function esEncuentroIndividualFijo(item: DisponibilidadInsert) {
  return (
    item.modo === "actividad_fija" &&
    (item.actividad_slug === "mentorias" || item.actividad_slug === "terapia")
  )
}

function esGrupoConectandoFijo(item: DisponibilidadInsert) {
  return (
    item.modo === "actividad_fija" &&
    item.actividad_slug === "conectando-sentidos"
  )
}

function esErrorMigracionAgenda(error: unknown) {
  const err = error as { code?: string; message?: string }
  const mensaje = String(err?.message || "").toLowerCase()

  return (
    err?.code === "42703" ||
    mensaje.includes("could not find") ||
    mensaje.includes("schema cache") ||
    mensaje.includes("participante_email") ||
    mensaje.includes("participante_nombre") ||
    mensaje.includes("notas_documentos") ||
    mensaje.includes("sync_status") ||
    mensaje.includes("serie_id")
  )
}

function normalizarMonto(input: string | number | null | undefined) {
  return String(input || "")
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/[^\d]/g, "")
    .trim()
}

async function resolverConfiguracionPagoTerapia(
  participanteEmail: string
): Promise<TerapiaHonorarioConfig> {
  const actividadTerapia = await asegurarActividadBase("terapia")

  if (!actividadTerapia?.id) {
    return {
      requierePago: false,
      montoBase: "0",
      montoMercadoPago: null,
      porcentajeRecargoMercadoPago: null,
    }
  }

  const supabase = createAdminSupabaseClient()
  const { data: honorario } = await supabase
    .from("honorarios_participante")
    .select("honorario_mensual, modalidad_pago")
    .eq("actividad_id", actividadTerapia.id)
    .eq("participante_email", participanteEmail)
    .eq("activo", true)
    .maybeSingle()

  const modalidad = normalizarModalidadPago(
    honorario?.modalidad_pago,
    "terapia"
  )
  const montoBase = normalizarMonto(honorario?.honorario_mensual || "0")
  const requierePago =
    modalidad === "sesion" &&
    Boolean(montoBase) &&
    !Number.isNaN(Number(montoBase)) &&
    Number(montoBase) > 0

  if (!requierePago) {
    return {
      requierePago: false,
      montoBase,
      montoMercadoPago: null,
      porcentajeRecargoMercadoPago: null,
    }
  }

  const resumenMontos = await calcularMontosPagoMensualConfigurado(montoBase)

  return {
    requierePago: true,
    montoBase,
    montoMercadoPago: String(resumenMontos.montoMercadoPago),
    porcentajeRecargoMercadoPago:
      resumenMontos.porcentajeRecargoMercadoPago,
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("agenda.manage")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const items = Array.isArray(body.items) ? body.items : []

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No hay disponibilidades para crear." },
        { status: 400 }
      )
    }

    const clavesNuevas = new Set<string>()

    const itemsNormalizados = items.map((item) => {
      const participanteEmail = item.participante_email?.trim().toLowerCase() || null
      const participanteNombre = item.participante_nombre?.trim() || null
      const fecha = item.fecha?.trim() || ""
      const hora = item.hora?.trim() || ""
      const duracion = item.duracion?.trim() || ""
      const esEncuentroUnoAUno = esEncuentroIndividualFijo(item)
      const esConectandoGrupal = esGrupoConectandoFijo(item)

      if (esEncuentroUnoAUno && !participanteEmail) {
        throw new ValidationError(
          "Debes seleccionar un participante para crear una reunión o sesión fija de Mentoría/Terapia."
        )
      }

      if (esEncuentroUnoAUno && (!fecha || !hora || !duracion)) {
        throw new ValidationError(
          "Fecha, hora y duración son obligatorias para crear el encuentro individual."
        )
      }

      if (esConectandoGrupal && (!fecha || !hora)) {
        throw new ValidationError(
          "Fecha y hora son obligatorias para crear la sesión grupal de Conectando Sentidos."
        )
      }

      if (esEncuentroUnoAUno || esConectandoGrupal) {
        const clave = [
          item.actividad_slug,
          esEncuentroUnoAUno ? participanteEmail : "grupo",
          fecha,
          hora,
          item.modo,
        ].join("|")

        if (clavesNuevas.has(clave)) {
          throw new ValidationError(
            esConectandoGrupal
              ? "Ya hay una sesión grupal de Conectando Sentidos igual en esta solicitud. Revisá fecha y hora antes de crear."
              : "Ya hay un encuentro igual en esta solicitud. Revisá fecha y hora antes de crear."
          )
        }

        clavesNuevas.add(clave)
      }

      return {
        ...item,
        fecha,
        hora,
        duracion,
        meet_link: item.meet_link?.trim() || "",
        participante_email: esEncuentroUnoAUno ? participanteEmail : null,
        participante_nombre: esEncuentroUnoAUno ? participanteNombre : null,
        serie_id: item.es_recurrente ? item.serie_id?.trim() || null : null,
        sync_status: esEncuentroUnoAUno
          ? item.sync_status?.trim() || "pendiente"
          : item.sync_status,
        notas_documentos: normalizarDocumentosNotas(item.notas_documentos),
      }
    })

    const supabase = createAdminSupabaseClient()

    for (const item of itemsNormalizados) {
      if (!esEncuentroIndividualFijo(item) && !esGrupoConectandoFijo(item)) {
        continue
      }

      let consultaExistente = supabase
        .from("disponibilidades")
        .select("id, fecha, hora, estado, modo, actividad_slug")
        .eq("actividad_slug", item.actividad_slug)
        .eq("fecha", item.fecha)
        .eq("hora", item.hora)
        .eq("modo", item.modo)
        .in("estado", ESTADOS_DISPONIBILIDAD_ACTIVA)
        .limit(1)

      if (esEncuentroIndividualFijo(item)) {
        consultaExistente = consultaExistente.eq(
          "participante_email",
          item.participante_email
        )
      }

      const { data: existentes, error: existenteError } =
        await consultaExistente

      if (existenteError) {
        if (esErrorMigracionAgenda(existenteError)) {
          return NextResponse.json(
            {
              error:
                "Falta aplicar la migración de agenda para encuentros individuales.",
              detalle: existenteError.message,
            },
            { status: 409 }
          )
        }

        return NextResponse.json(
          {
            error: "No se pudo validar si el encuentro ya existe.",
            detalle: existenteError.message,
          },
          { status: 500 }
        )
      }

      const existente = (existentes || [])[0]

      if (existente) {
        if (esGrupoConectandoFijo(item)) {
          console.info("Bloqueo duplicado Conectando Sentidos", {
            id: existente.id,
            fecha: existente.fecha,
            hora: existente.hora,
            estado: existente.estado,
            modo: existente.modo,
            actividad_slug: existente.actividad_slug,
          })
        }

        return NextResponse.json(
          {
            error: esGrupoConectandoFijo(item)
              ? "Ya existe una sesión grupal de Conectando Sentidos para esa fecha y hora."
              : "Ya existe un encuentro individual para esa actividad, participante, fecha y hora.",
          },
          { status: 409 }
        )
      }
    }

    const { data, error } = await supabase
      .from("disponibilidades")
      .insert(itemsNormalizados)
      .select("*")

    if (error || !data) {
      if (error && esErrorMigracionAgenda(error)) {
        return NextResponse.json(
          {
            error:
              "Falta aplicar la migración de agenda para encuentros individuales.",
            detalle: error.message,
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        {
          error: "No se pudieron crear las disponibilidades.",
          detalle: error,
        },
        { status: 500 }
      )
    }

    if (data.length !== itemsNormalizados.length) {
      return NextResponse.json(
        {
          error:
            "La agenda no confirmó la creación de todos los encuentros solicitados.",
        },
        { status: 500 }
      )
    }

    const configuracionPagoPorEmail = new Map<string, TerapiaHonorarioConfig>()

    for (const item of data) {
      const actividadSlug = String(item.actividad_slug || "").trim().toLowerCase()
      const modo = String(item.modo || "").trim().toLowerCase()
      const participanteEmail = String(item.participante_email || "")
        .trim()
        .toLowerCase()
      const participanteNombre = String(item.participante_nombre || "").trim() || null

      if (
        actividadSlug !== "terapia" ||
        modo !== "actividad_fija" ||
        !participanteEmail
      ) {
        continue
      }

      const { data: reservaExistente, error: reservaExistenteError } = await supabase
        .from("reservas")
        .select("id")
        .eq("disponibilidad_id", item.id)
        .limit(1)
        .maybeSingle()

      if (reservaExistenteError) {
        return NextResponse.json(
          {
            error:
              "La sesión se creó, pero no se pudo validar la reserva asociada para Terapia.",
            detalle: reservaExistenteError.message,
          },
          { status: 500 }
        )
      }

      if (reservaExistente?.id) {
        continue
      }

      let configuracionPago = configuracionPagoPorEmail.get(participanteEmail)

      if (!configuracionPago) {
        configuracionPago = await resolverConfiguracionPagoTerapia(participanteEmail)
        configuracionPagoPorEmail.set(participanteEmail, configuracionPago)
      }

      const estadoReserva = configuracionPago.requierePago
        ? "pendiente_pago"
        : "confirmada"
      const estadoDisponibilidad = configuracionPago.requierePago
        ? "pendiente_pago"
        : "confirmada"

      const { error: reservaError } = await supabase.from("reservas").insert({
        disponibilidad_id: item.id,
        estado: estadoReserva,
        participante_nombre: participanteNombre,
        participante_email: participanteEmail,
        monto: configuracionPago.montoBase || "0",
        monto_transferencia: configuracionPago.montoBase || "0",
        monto_mercado_pago: configuracionPago.requierePago
          ? configuracionPago.montoMercadoPago
          : null,
        porcentaje_recargo_mercado_pago: configuracionPago.requierePago
          ? configuracionPago.porcentajeRecargoMercadoPago
          : null,
        medio_pago: configuracionPago.requierePago ? null : "sin_cargo",
        moneda: "ARS",
      })

      if (reservaError) {
        return NextResponse.json(
          {
            error:
              "La sesión se creó, pero no se pudo generar la reserva de cobro para Terapia.",
            detalle: reservaError.message,
          },
          { status: 500 }
        )
      }

      const { error: disponibilidadUpdateError } = await supabase
        .from("disponibilidades")
        .update({
          estado: estadoDisponibilidad,
          requiere_pago: configuracionPago.requierePago,
          precio: configuracionPago.requierePago
            ? configuracionPago.montoBase
            : item.precio || "",
          reservado_por: participanteNombre,
        })
        .eq("id", item.id)

      if (disponibilidadUpdateError) {
        return NextResponse.json(
          {
            error:
              "La sesión y la reserva se crearon, pero no se pudo actualizar el estado final de la disponibilidad.",
            detalle: disponibilidadUpdateError.message,
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      ok: true,
      items: data,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      {
        error: "Error interno creando disponibilidades",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
