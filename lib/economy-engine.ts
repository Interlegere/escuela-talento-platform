import type { ActivitySlug } from "@/lib/authz"
import { estaDentroDeGraciaMensual } from "@/lib/activity-rules"
import { normalizarModalidadPago } from "@/lib/billing"
import { asegurarActividadBase } from "@/lib/core-activities"
import { obtenerDiasGraciaPorActividadConfigurado } from "@/lib/payment-pricing"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export type EconomyPaymentMode =
  | "mensual"
  | "proceso"
  | "sesion"
  | "sin_configurar"

export type EconomyStatus =
  | "al_dia"
  | "pendiente_pago"
  | "en_revision"
  | "rechazado"
  | "gracia"
  | "sin_configurar"
  | "no_aplica"
  | "cancelado"

export type EconomyAction =
  | "pagar"
  | "subir_comprobante"
  | "esperar_revision"
  | "contactar_admin"
  | "sin_accion"

export type EconomyRawActivityContext = {
  actividadSlug: ActivitySlug | string
  actividadExiste?: boolean
  inscripcionActiva: boolean
  honorarioId?: number | null
  honorarioActivo?: boolean | null
  honorarioModalidadRaw?: string | null
  honorarioMonto?: string | number | null
  honorarioMoneda?: string | null
  pagoMensualId?: number | null
  pagoMensualEstado?: string | null
  pagoMensualMonto?: string | number | null
  pagoMensualMoneda?: string | null
  pagoMensualAnio?: number | null
  pagoMensualMes?: number | null
  fechaActual?: Date
  diasGraciaConfigurados?: number | null
}

export type EconomyRawEncounterContext = {
  actividadSlug: ActivitySlug | string
  disponibilidadEstado?: string | null
  reservaId?: number | null
  reservaEstado?: string | null
  medioPago?: string | null
  monto?: string | number | null
  montoTransferencia?: string | number | null
  montoMercadoPago?: string | number | null
  moneda?: string | null
  comprobanteNombreArchivo?: string | null
  mpStatus?: string | null
  honorarioModalidadRaw?: string | null
}

export type ResolvedActivityEconomy = {
  modalidad: EconomyPaymentMode
  estado: EconomyStatus
  requierePago: boolean
  accesoEconomicoHabilitado: boolean
  monto: number | null
  moneda: string | null
  periodo: string | null
  pagoMensualId: number | null
  detalle: string
  accionSiguiente: EconomyAction
  origen: string
}

export type ResolvedEncounterEconomy = {
  estado: EconomyStatus
  requierePago: boolean
  accesoEconomicoHabilitado: boolean
  monto: number | null
  moneda: string | null
  reservaId: number | null
  comprobantePendiente: boolean
  detalle: string
  accionSiguiente: EconomyAction
  origen: string
}

type LoaderActivityRow = {
  id: number
  slug?: string | null
}

type LoaderInscripcionRow = {
  id: number
}

type LoaderHonorarioRow = {
  id: number
  modalidad_pago?: string | null
  honorario_mensual?: string | number | null
  moneda?: string | null
  activo?: boolean | null
}

type LoaderPagoRow = {
  id: number
  estado?: string | null
  monto?: string | number | null
  moneda?: string | null
  anio?: number | null
  mes?: number | null
}

function normalizarMonto(value?: string | number | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizarActividadSlug(
  actividadSlug: ActivitySlug | string
): ActivitySlug | string {
  return String(actividadSlug || "").trim().toLowerCase()
}

function resolverModalidadEconomica(
  actividadSlug: ActivitySlug | string,
  honorarioModalidadRaw?: string | null,
  honorarioActivo?: boolean | null
): EconomyPaymentMode {
  if (honorarioActivo === false) {
    return "sin_configurar"
  }

  if (!String(honorarioModalidadRaw || "").trim()) {
    return "sin_configurar"
  }

  const modalidad = normalizarModalidadPago(honorarioModalidadRaw, actividadSlug)

  if (modalidad === "sesion") return "sesion"
  if (modalidad === "proceso") return "proceso"
  return "mensual"
}

function construirPeriodoPago(
  anio?: number | null,
  mes?: number | null
) {
  if (!anio || !mes) return null
  return `${String(mes).padStart(2, "0")}/${anio}`
}

export function resolverAccionEconomicaSiguiente(params: {
  estado: EconomyStatus
  modalidad: EconomyPaymentMode
  requierePago: boolean
  comprobantePendiente?: boolean
}) {
  const { estado, modalidad, requierePago, comprobantePendiente = false } = params

  if (!requierePago) return "sin_accion" as const
  if (estado === "al_dia") {
    return "sin_accion" as const
  }
  if (estado === "gracia") {
    return "pagar" as const
  }
  if (estado === "en_revision") {
    return "esperar_revision" as const
  }
  if (estado === "sin_configurar") {
    return "contactar_admin" as const
  }
  if (estado === "no_aplica" && modalidad === "sesion") {
    return "sin_accion" as const
  }
  if (estado === "rechazado") {
    return comprobantePendiente ? "subir_comprobante" : "pagar" as const
  }
  if (estado === "pendiente_pago") {
    return comprobantePendiente ? "esperar_revision" : "pagar" as const
  }
  return "sin_accion" as const
}

export function resolverDetalleEconomico(params:
  | {
      tipo: "actividad"
      contexto: EconomyRawActivityContext
      resuelto: Omit<ResolvedActivityEconomy, "detalle">
    }
  | {
      tipo: "encuentro"
      contexto: EconomyRawEncounterContext
      resuelto: Omit<ResolvedEncounterEconomy, "detalle">
    }
) {
  if (params.tipo === "actividad") {
    const { contexto, resuelto } = params
    const actividad = normalizarActividadSlug(contexto.actividadSlug)
    const nombreActividad = actividad === "mentorias"
      ? "Mentorías"
      : actividad === "terapia"
        ? "Terapia"
        : String(contexto.actividadSlug || "la actividad")

    switch (resuelto.estado) {
      case "al_dia":
        return "Pago al día."
      case "gracia":
        return "Acceso habilitado dentro del período de gracia."
      case "sin_configurar":
        return `Falta configurar el encuadre económico de ${nombreActividad}.`
      case "no_aplica":
        return resuelto.modalidad === "sesion"
          ? "El cobro se resuelve encuentro por encuentro."
          : "No aplica cobro económico para esta actividad."
      case "en_revision":
        return "Hay un comprobante pendiente de revisión."
      case "rechazado":
        return "El último pago fue rechazado y necesita regularización."
      case "pendiente_pago":
        return resuelto.modalidad === "proceso"
          ? "Todavía no hay un pago aprobado para este proceso."
          : "Todavía no hay un pago aprobado para el período actual."
      default:
        return "Estado económico sin resolver."
    }
  }

  const { contexto, resuelto } = params
  const actividad = normalizarActividadSlug(contexto.actividadSlug)
  const nombre = actividad === "terapia" ? "sesión" : "encuentro"

  switch (resuelto.estado) {
    case "cancelado":
      return "Encuentro cancelado. No corresponde cobro."
    case "al_dia":
      return "Pago confirmado. El requisito económico está cumplido."
    case "en_revision":
      return "Hay un comprobante pendiente de revisión para este encuentro."
    case "rechazado":
      return `El pago de esta ${nombre} fue rechazado y necesita regularización.`
    case "pendiente_pago":
      return `La ${nombre} sigue pendiente de pago.`
    case "no_aplica":
      return "Este encuentro no tiene un cobro económico aplicable."
    case "sin_configurar":
      return "Falta configurar el encuadre económico de este encuentro."
    default:
      return "Estado económico del encuentro sin resolver."
  }
}

export function resolverEconomiaActividad(
  contexto: EconomyRawActivityContext
): ResolvedActivityEconomy {
  const actividadSlug = normalizarActividadSlug(contexto.actividadSlug)
  const fechaActual = contexto.fechaActual || new Date()
  const modalidad = resolverModalidadEconomica(
    actividadSlug,
    contexto.honorarioModalidadRaw,
    contexto.honorarioActivo
  )
  const monto =
    normalizarMonto(contexto.pagoMensualMonto) ??
    normalizarMonto(contexto.honorarioMonto)
  const moneda = contexto.pagoMensualMoneda || contexto.honorarioMoneda || null
  const periodo = construirPeriodoPago(
    contexto.pagoMensualAnio,
    contexto.pagoMensualMes
  )

  let estado: EconomyStatus = "pendiente_pago"
  let requierePago = true
  let accesoEconomicoHabilitado = false
  let origen = "actividad"

  if (contexto.actividadExiste === false || !contexto.inscripcionActiva) {
    estado = "no_aplica"
    requierePago = false
    origen = !contexto.inscripcionActiva ? "inscripcion:inactiva" : "actividad:inexistente"
  } else if (!contexto.honorarioId || modalidad === "sin_configurar") {
    estado = "sin_configurar"
    requierePago = false
    origen = "honorario:faltante"
  } else if (modalidad === "sesion") {
    estado = "no_aplica"
    requierePago = false
    origen = "honorario:sesion"
  } else {
    const pagoEstado = String(contexto.pagoMensualEstado || "").trim().toLowerCase()

    if (!pagoEstado) {
      if (
        actividadSlug !== "terapia" &&
        actividadSlug !== "membresia" &&
        estaDentroDeGraciaMensual(contexto.diasGraciaConfigurados, fechaActual)
      ) {
        estado = "gracia"
        accesoEconomicoHabilitado = true
        origen = "gracia"
      } else {
        estado = "pendiente_pago"
        origen = "pago:ausente"
      }
    } else if (pagoEstado === "pagado") {
      estado = "al_dia"
      accesoEconomicoHabilitado = true
      origen = "pago:pagado"
    } else if (pagoEstado === "en_revision") {
      estado = "en_revision"
      origen = "pago:en_revision"
    } else if (pagoEstado === "rechazado") {
      estado = "rechazado"
      origen = "pago:rechazado"
    } else if (
      actividadSlug !== "terapia" &&
      actividadSlug !== "membresia" &&
      estaDentroDeGraciaMensual(contexto.diasGraciaConfigurados, fechaActual)
    ) {
      estado = "gracia"
      accesoEconomicoHabilitado = true
      origen = `gracia:${pagoEstado}`
    } else {
      estado = "pendiente_pago"
      origen = `pago:${pagoEstado}`
    }
  }

  const accionSiguiente: EconomyAction = resolverAccionEconomicaSiguiente({
    estado,
    modalidad,
    requierePago,
  })

  const parcial: Omit<ResolvedActivityEconomy, "detalle"> = {
    modalidad,
    estado,
    requierePago,
    accesoEconomicoHabilitado,
    monto,
    moneda,
    periodo,
    pagoMensualId: contexto.pagoMensualId || null,
    accionSiguiente,
    origen,
  }

  return {
    ...parcial,
    detalle: resolverDetalleEconomico({
      tipo: "actividad",
      contexto,
      resuelto: parcial,
    }),
  }
}

export function resolverEconomiaEncuentro(
  contexto: EconomyRawEncounterContext
): ResolvedEncounterEconomy {
  const actividadSlug = normalizarActividadSlug(contexto.actividadSlug)
  const disponibilidadEstado = String(contexto.disponibilidadEstado || "")
    .trim()
    .toLowerCase()
  const reservaEstado = String(contexto.reservaEstado || "").trim().toLowerCase()
  const mpStatus = String(contexto.mpStatus || "").trim().toLowerCase()
  const monto =
    normalizarMonto(contexto.montoTransferencia) ??
    normalizarMonto(contexto.monto) ??
    normalizarMonto(contexto.montoMercadoPago)
  const moneda = contexto.moneda || "ARS"
  const comprobantePendiente = Boolean(contexto.comprobanteNombreArchivo)

  let estado: EconomyStatus = "no_aplica"
  let requierePago = false
  let accesoEconomicoHabilitado = false
  let origen = "encuentro"

  if (disponibilidadEstado === "cancelada") {
    estado = "cancelado"
    origen = "disponibilidad:cancelada"
  } else if (reservaEstado === "confirmada") {
    estado = "al_dia"
    requierePago = true
    accesoEconomicoHabilitado = true
    origen = "reserva:confirmada"
  } else if (reservaEstado === "pendiente_pago") {
    requierePago = true

    if (mpStatus === "rejected") {
      estado = "rechazado"
      origen = "reserva:mp_rejected"
    } else if (comprobantePendiente) {
      estado = "en_revision"
      origen = "reserva:comprobante"
    } else {
      estado = "pendiente_pago"
      origen = "reserva:pendiente_pago"
    }
  } else if (actividadSlug === "terapia") {
    estado = "no_aplica"
    origen = "terapia:sin_reserva"
  }

  const accionSiguiente: EconomyAction = resolverAccionEconomicaSiguiente({
    estado,
    modalidad: "sesion",
    requierePago,
    comprobantePendiente,
  })

  const parcial: Omit<ResolvedEncounterEconomy, "detalle"> = {
    estado,
    requierePago,
    accesoEconomicoHabilitado,
    monto,
    moneda,
    reservaId: contexto.reservaId || null,
    comprobantePendiente,
    accionSiguiente,
    origen,
  }

  return {
    ...parcial,
    detalle: resolverDetalleEconomico({
      tipo: "encuentro",
      contexto,
      resuelto: parcial,
    }),
  }
}

export async function obtenerEconomiaActividadActual(
  actividadSlug: Exclude<ActivitySlug, "membresia">,
  participanteEmail: string
) {
  const supabase = createAdminSupabaseClient()
  const actividad = await asegurarActividadBase(actividadSlug)

  if (!actividad?.id) {
    return resolverEconomiaActividad({
      actividadSlug,
      actividadExiste: false,
      inscripcionActiva: false,
    })
  }

  const email = String(participanteEmail || "").trim().toLowerCase()

  const { data: inscripcion } = await supabase
    .from("inscripciones")
    .select("id")
    .eq("actividad_id", actividad.id)
    .eq("participante_email", email)
    .eq("estado", "activa")
    .maybeSingle<LoaderInscripcionRow>()

  if (!inscripcion?.id) {
    return resolverEconomiaActividad({
      actividadSlug,
      actividadExiste: true,
      inscripcionActiva: false,
    })
  }

  const { data: honorario } = await supabase
    .from("honorarios_participante")
    .select("id, modalidad_pago, honorario_mensual, moneda, activo")
    .eq("actividad_id", actividad.id)
    .eq("participante_email", email)
    .eq("activo", true)
    .maybeSingle<LoaderHonorarioRow>()

  const modalidad = resolverModalidadEconomica(
    actividadSlug,
    honorario?.modalidad_pago,
    honorario?.activo
  )

  let pago: LoaderPagoRow | null = null

  if (honorario?.id && modalidad !== "sin_configurar" && modalidad !== "sesion") {
    if (modalidad === "proceso") {
      const { data } = await supabase
        .from("pagos_mensuales")
        .select("id, estado, monto, moneda, anio, mes")
        .eq("inscripcion_id", inscripcion.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<LoaderPagoRow>()

      pago = data || null
    } else {
      const ahora = new Date()
      const anio = ahora.getFullYear()
      const mes = ahora.getMonth() + 1

      const { data } = await supabase
        .from("pagos_mensuales")
        .select("id, estado, monto, moneda, anio, mes")
        .eq("inscripcion_id", inscripcion.id)
        .eq("anio", anio)
        .eq("mes", mes)
        .maybeSingle<LoaderPagoRow>()

      pago = data || null
    }
  }

  const diasGraciaConfigurados = await obtenerDiasGraciaPorActividadConfigurado(
    actividadSlug
  )

  return resolverEconomiaActividad({
    actividadSlug,
    actividadExiste: true,
    inscripcionActiva: true,
    honorarioId: honorario?.id || null,
    honorarioActivo: honorario?.activo ?? null,
    honorarioModalidadRaw: honorario?.modalidad_pago || null,
    honorarioMonto: honorario?.honorario_mensual ?? null,
    honorarioMoneda: honorario?.moneda || null,
    pagoMensualId: pago?.id || null,
    pagoMensualEstado: pago?.estado || null,
    pagoMensualMonto: pago?.monto ?? null,
    pagoMensualMoneda: pago?.moneda || null,
    pagoMensualAnio: pago?.anio ?? null,
    pagoMensualMes: pago?.mes ?? null,
    diasGraciaConfigurados,
  })
}
