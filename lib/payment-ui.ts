import type { BillingMode } from "@/lib/billing"

export type PagoUiItem = {
  id: string
  origen: "mensualidad" | "proceso" | "sesion"
  actividadSlug: string
  actividadNombre: string
  titulo: string
  descripcion: string
  monto: number | null
  moneda: string | null
  estado:
    | "pendiente_pago"
    | "en_revision"
    | "rechazado"
    | "pagado"
  accionPrincipal: "pagar_mp" | "esperar_revision" | "ninguna"
  accionSecundaria: "subir_comprobante" | "ver_detalle" | null
  fechaRelevante: string | null
  vencimiento: string | null
  reservaId: number | null
  pagoMensualId: number | null
  proximoPaso: string
  prioridad: "alta" | "media" | "baja"
  participanteNombre?: string | null
  participanteEmail?: string | null
  modalidadPago?: BillingMode
  montoTransferencia?: string | number | null
  montoMercadoPago?: string | number | null
  porcentajeRecargoMercadoPago?: number | null
  comprobanteNombreArchivo?: string | null
}

export type PagoUiActividadSource = {
  id: number
  actividadSlug: string
  actividadNombre: string
  participanteNombre: string
  participanteEmail: string
  honorarioMensual: string | number
  modalidadPago: BillingMode
  moneda: string
  economia?: {
    modalidad?: string | null
    estado?: string | null
    requierePago?: boolean
    accesoEconomicoHabilitado?: boolean
    detalle?: string | null
    periodo?: string | null
    pagoMensualId?: number | null
  } | null
}

export type PagoUiTerapiaSource = {
  id: string | number
  reservaId?: number | null
  titulo: string
  fecha: string
  hora: string
  duracion: string
  estado: string
  montoTransferencia?: string | null
  montoMercadoPago?: string | null
  porcentajeRecargoMercadoPago?: number | null
  comprobanteNombreArchivo?: string | null
  mpStatus?: string | null
}

function normalizarMonto(value?: string | number | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatearFechaPagoUi(fecha?: string | null, hora?: string | null) {
  if (!fecha) return null

  const base = new Date(`${fecha}T${String(hora || "00:00").slice(0, 5)}:00`)
  if (Number.isNaN(base.getTime())) {
    return [fecha, hora].filter(Boolean).join(" ")
  }

  return base.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: hora ? "2-digit" : undefined,
    minute: hora ? "2-digit" : undefined,
  })
}

function prioridadDesdeEstado(
  estado: PagoUiItem["estado"],
  origen: PagoUiItem["origen"]
): PagoUiItem["prioridad"] {
  if (estado === "rechazado") return "alta"
  if (estado === "pendiente_pago" && origen === "sesion") return "alta"
  if (estado === "pendiente_pago") return "media"
  if (estado === "en_revision") return "media"
  return "baja"
}

function tituloMensualidad(source: PagoUiActividadSource) {
  const periodo = source.economia?.periodo || null

  if (source.modalidadPago === "proceso") {
    return source.actividadSlug === "terapia"
      ? "Proceso de Terapia"
      : `Proceso de ${source.actividadNombre}`
  }

  if (source.actividadSlug === "mentorias") {
    return periodo
      ? `Mensualidad de Mentorías — ${periodo}`
      : "Mensualidad de Mentorías"
  }

  return periodo
    ? `${source.actividadNombre} — ${periodo}`
    : `Mensualidad de ${source.actividadNombre}`
}

function descripcionActividad(source: PagoUiActividadSource) {
  const estado = source.economia?.estado || ""

  if (estado === "rechazado") {
    return "Tu pago necesita regularización para mantener el acceso habilitado."
  }

  if (estado === "en_revision") {
    return "Recibimos tu comprobante. Estamos verificándolo y te avisaremos cuando se habilite."
  }

  if (estado === "pagado" || estado === "al_dia") {
    return "Pago acreditado correctamente."
  }

  return "Completá el pago para mantener tu actividad habilitada."
}

function mapEstadoActividad(source: PagoUiActividadSource): PagoUiItem["estado"] | null {
  const estado = source.economia?.estado || ""

  if (estado === "pendiente_pago") return "pendiente_pago"
  if (estado === "en_revision") return "en_revision"
  if (estado === "rechazado") return "rechazado"
  if (estado === "al_dia") return "pagado"

  return null
}

export function crearPagoUiDesdeActividad(
  source: PagoUiActividadSource
): PagoUiItem | null {
  const estado = mapEstadoActividad(source)
  if (!estado) return null

  const origen: PagoUiItem["origen"] =
    source.modalidadPago === "proceso"
      ? "proceso"
      : source.modalidadPago === "sesion"
        ? "sesion"
        : "mensualidad"

  const accionPrincipal =
    estado === "en_revision"
      ? "esperar_revision"
      : estado === "pagado"
        ? "ninguna"
        : "pagar_mp"

  const accionSecundaria =
    estado === "pendiente_pago" || estado === "rechazado"
      ? "subir_comprobante"
      : estado === "pagado"
        ? "ver_detalle"
        : null

  const proximoPaso =
    estado === "en_revision"
      ? "Estamos verificando tu comprobante."
      : estado === "rechazado"
        ? "Volvé a pagar o subí un nuevo comprobante."
        : estado === "pagado"
          ? "Todo en orden."
          : "Pagá ahora o subí tu comprobante."

  const item: PagoUiItem = {
    id: `actividad:${source.id}`,
    origen,
    actividadSlug: source.actividadSlug,
    actividadNombre: source.actividadNombre,
    titulo: tituloMensualidad(source),
    descripcion: descripcionActividad(source),
    monto: normalizarMonto(source.honorarioMensual),
    moneda: source.moneda || "ARS",
    estado,
    accionPrincipal,
    accionSecundaria,
    fechaRelevante: null,
    vencimiento: source.economia?.periodo || null,
    reservaId: null,
    pagoMensualId: source.economia?.pagoMensualId || null,
    proximoPaso,
    prioridad: prioridadDesdeEstado(estado, origen),
    participanteNombre: source.participanteNombre,
    participanteEmail: source.participanteEmail,
    modalidadPago: source.modalidadPago,
  }

  return item
}

function mapEstadoTerapia(source: PagoUiTerapiaSource): PagoUiItem["estado"] | null {
  const mpStatus = String(source.mpStatus || "").trim().toLowerCase()
  if (source.estado === "pendiente_pago" && mpStatus === "rejected") {
    return "rechazado"
  }
  if (source.estado === "pendiente_pago" && source.comprobanteNombreArchivo) {
    return "en_revision"
  }
  if (source.estado === "pendiente_pago") {
    return "pendiente_pago"
  }
  if (source.estado === "confirmada") {
    return "pagado"
  }
  return null
}

export function crearPagoUiDesdeTerapia(
  source: PagoUiTerapiaSource
): PagoUiItem | null {
  const estado = mapEstadoTerapia(source)
  if (!estado) return null

  const fechaRelevante = formatearFechaPagoUi(source.fecha, source.hora)
  const tituloBase = fechaRelevante
    ? `Sesión de Terapia — ${fechaRelevante}`
    : "Sesión de Terapia"

  const descripcion =
    estado === "en_revision"
      ? "Recibimos tu comprobante. Estamos verificándolo y te avisaremos cuando se habilite."
      : estado === "rechazado"
        ? "El pago de esta sesión necesita regularización."
        : estado === "pagado"
          ? "Pago acreditado correctamente."
          : "Completá el pago para habilitar esta sesión."

  return {
    id: `sesion:${source.id}`,
    origen: "sesion",
    actividadSlug: "terapia",
    actividadNombre: "Terapia",
    titulo: tituloBase,
    descripcion,
    monto:
      normalizarMonto(source.montoTransferencia) ??
      normalizarMonto(source.montoMercadoPago),
    moneda: "ARS",
    estado,
    accionPrincipal:
      estado === "en_revision"
        ? "esperar_revision"
        : estado === "pagado"
          ? "ninguna"
          : "pagar_mp",
    accionSecundaria:
      estado === "pendiente_pago" || estado === "rechazado"
        ? "subir_comprobante"
        : estado === "pagado"
          ? "ver_detalle"
          : null,
    fechaRelevante,
    vencimiento: null,
    reservaId: source.reservaId || null,
    pagoMensualId: null,
    proximoPaso:
      estado === "en_revision"
        ? "Estamos verificando tu comprobante."
        : estado === "rechazado"
          ? "Intentá pagar nuevamente o subí un nuevo comprobante."
          : estado === "pagado"
            ? "Todo en orden."
            : "Pagá ahora o subí tu comprobante.",
    prioridad: prioridadDesdeEstado(estado, "sesion"),
    montoTransferencia: source.montoTransferencia ?? null,
    montoMercadoPago: source.montoMercadoPago ?? null,
    porcentajeRecargoMercadoPago: source.porcentajeRecargoMercadoPago ?? null,
    comprobanteNombreArchivo: source.comprobanteNombreArchivo ?? null,
  }
}

export function ordenarPagoUiItems(items: PagoUiItem[]) {
  const pesoPrioridad = {
    alta: 0,
    media: 1,
    baja: 2,
  } as const

  return [...items].sort((a, b) => {
    if (pesoPrioridad[a.prioridad] !== pesoPrioridad[b.prioridad]) {
      return pesoPrioridad[a.prioridad] - pesoPrioridad[b.prioridad]
    }

    const fechaA = a.fechaRelevante || a.vencimiento || ""
    const fechaB = b.fechaRelevante || b.vencimiento || ""
    return fechaA.localeCompare(fechaB)
  })
}

export function agruparPagoUiItems(items: PagoUiItem[]) {
  return {
    pendientes: ordenarPagoUiItems(
      items.filter(
        (item) => item.estado === "pendiente_pago" || item.estado === "rechazado"
      )
    ),
    enRevision: ordenarPagoUiItems(
      items.filter((item) => item.estado === "en_revision")
    ),
    resueltos: ordenarPagoUiItems(
      items.filter((item) => item.estado === "pagado")
    ),
  }
}
