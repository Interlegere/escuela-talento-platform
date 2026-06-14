import type { ActivitySlug } from "@/lib/authz"

type AgendaStrategy =
  | "grupo_fijo"
  | "individual_fijo"
  | "reserva_individual"

type PaymentStatusMotivo =
  | "pagado"
  | "sin_inscripcion"
  | "sin_pago"
  | "pendiente"
  | "rechazado"
  | "sin_actividad"
  | "sesion"
  | "gracia"

type PaymentStatusModalidad = "mensual" | "sesion" | "proceso"

export type EncounterSource = {
  fuente: "agenda_unificada" | "espacios_resumen"
  actividadSlug: ActivitySlug
  estrategia?: AgendaStrategy | null
  origen?: "disponibilidad" | "reserva" | "fija"
  modo?: "disponibilidad" | "actividad_fija" | "bloqueo" | string | null
  disponibilidadEstado?: string | null
  reservaEstado?: string | null
  reservaRealizadaAt?: string | null
  participanteEmail?: string | null
  participanteReservaEmail?: string | null
  meetLink?: string | null
  requierePagoConfigurado?: boolean | null
  medioPago?: string | null
  comprobanteNombreArchivo?: string | null
}

export type EncounterPaymentContext = {
  estadoPagoActividad?: {
    habilitado: boolean
    modalidad: PaymentStatusModalidad
    motivo: PaymentStatusMotivo
  } | null
  accesoActividad?: {
    acceso: boolean
    motivo: string | null
  } | null
}

export type EncounterAccessContext = {
  esAdmin: boolean
  actorEmail?: string | null
}

export type EncounterResolvedState = {
  estado:
    | "disponible"
    | "pendiente_pago"
    | "confirmada"
    | "realizada"
    | "bloqueado"
    | "cancelada"
  visibleParaParticipante: boolean
  puedeIngresar: boolean
  motivoBloqueo: string | null
  requierePago: boolean
  estadoPagoAdmin: string | null
  detallePagoAdmin: string | null
  proximoPasoUsuario: string
}

function normalizarEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase()
}

function motivoPagoParaEncuentro(
  actividadSlug: ActivitySlug,
  motivoPago: string
) {
  if (motivoPago === "sin_actividad") {
    return actividadSlug === "mentorias"
      ? "Todavía falta asignar tu modalidad y tu pago de Mentoría para habilitar esta reunión."
      : "Todavía falta asignar el encuadre económico de esta actividad para habilitar este ingreso."
  }

  if (motivoPago === "sesion") {
    return "Este ingreso se habilita con el pago y la confirmación de cada sesión."
  }

  const nombre = actividadSlug === "terapia" ? "sesión" : "reunión"
  return `El ingreso a esta ${nombre} se habilita cuando el pago del período actual está aprobado.`
}

function describirEstadoPagoAdmin(
  actividadSlug: ActivitySlug,
  estadoPago?: EncounterPaymentContext["estadoPagoActividad"] | null
) {
  switch (estadoPago?.motivo) {
    case "pagado":
      return {
        estado: "pagado",
        detalle:
          actividadSlug === "mentorias"
            ? "Pago mensual al día."
            : "Pago habilitado para este proceso.",
      }
    case "gracia":
      return {
        estado: "gracia",
        detalle: "Acceso dentro del período de gracia.",
      }
    case "sin_pago":
      return {
        estado: "sin_pago",
        detalle: "Todavía no existe un pago cargado para el período actual.",
      }
    case "pendiente":
      return {
        estado: "pendiente",
        detalle: "Hay un pago cargado, pero todavía sigue pendiente de revisión.",
      }
    case "rechazado":
      return {
        estado: "rechazado",
        detalle: "El pago fue rechazado y necesita regularización.",
      }
    case "sin_actividad":
      return {
        estado: "sin_honorario",
        detalle:
          "Falta configurar el encuadre económico de esta actividad para este participante.",
      }
    case "sin_inscripcion":
      return {
        estado: "sin_inscripcion",
        detalle: "La persona todavía no tiene una inscripción activa en esta actividad.",
      }
    case "sesion":
      return {
        estado: "por_sesion",
        detalle: "Este caso se resuelve encuentro por encuentro, no por un pago mensual.",
      }
    default:
      return {
        estado: null,
        detalle: null,
      }
  }
}

function resolverEstadoBase(
  source: EncounterSource
): EncounterResolvedState["estado"] {
  const disponibilidadEstado = String(source.disponibilidadEstado || "").trim()
  const reservaEstado = String(source.reservaEstado || "").trim()

  if (source.reservaRealizadaAt) {
    return "realizada"
  }

  if (reservaEstado === "pendiente_pago") {
    return "pendiente_pago"
  }

  if (reservaEstado === "confirmada" || disponibilidadEstado === "confirmada") {
    return "confirmada"
  }

  if (disponibilidadEstado === "cancelada") {
    return "cancelada"
  }

  if (
    disponibilidadEstado === "disponible" ||
    disponibilidadEstado === "pendiente_pago" ||
    disponibilidadEstado === "confirmada" ||
    disponibilidadEstado === "bloqueado"
  ) {
    return disponibilidadEstado
  }

  return "disponible"
}

function resolverRequierePago(source: EncounterSource) {
  if (source.fuente === "agenda_unificada") {
    const participanteEmailNormalizado = normalizarEmail(
      source.participanteEmail || source.participanteReservaEmail
    )

    return (
      source.requierePagoConfigurado === true ||
      (source.actividadSlug === "mentorias" &&
        Boolean(participanteEmailNormalizado)) ||
      (source.actividadSlug === "terapia" && Boolean(source.reservaEstado))
    )
  }

  return source.requierePagoConfigurado !== false
}

export function resolverAccesoEncuentro(params: {
  source: EncounterSource
  payment: EncounterPaymentContext
  access: EncounterAccessContext
  estado?: EncounterResolvedState["estado"]
}) {
  const { source, payment, access } = params
  const estado = params.estado || resolverEstadoBase(source)
  const meetLink = Boolean(source.meetLink)
  const actorEmail = normalizarEmail(access.actorEmail)
  const participanteEmail = normalizarEmail(source.participanteEmail)
  const participanteReservaEmail = normalizarEmail(source.participanteReservaEmail)
  const requierePago = resolverRequierePago(source)

  if (access.esAdmin) {
    return {
      visibleParaParticipante: true,
      puedeIngresar: meetLink,
      requierePago,
    }
  }

  if (source.fuente === "espacios_resumen") {
    if (source.origen === "reserva") {
      const confirmada =
        source.reservaEstado === "confirmada" ||
        source.disponibilidadEstado === "confirmada"

      return {
        visibleParaParticipante: true,
        puedeIngresar: Boolean(
          meetLink &&
            (confirmada &&
              (!requierePago ||
                payment.estadoPagoActividad?.habilitado ||
                (source.actividadSlug === "terapia" &&
                  payment.estadoPagoActividad?.modalidad === "sesion")))
        ),
        requierePago,
      }
    }

    return {
      visibleParaParticipante: true,
      puedeIngresar: Boolean(meetLink && payment.estadoPagoActividad?.habilitado),
      requierePago,
    }
  }

  if (source.estrategia === "grupo_fijo") {
    const visibleParaParticipante =
      payment.accesoActividad?.motivo !== "sin_inscripcion" &&
      payment.accesoActividad?.motivo !== "sin_email"

    return {
      visibleParaParticipante,
      puedeIngresar: Boolean(payment.accesoActividad?.acceso && meetLink),
      requierePago,
    }
  }

  if (source.actividadSlug === "mentorias") {
    const visibleParaParticipante = participanteEmail === actorEmail

    return {
      visibleParaParticipante,
      puedeIngresar: Boolean(
        visibleParaParticipante &&
          meetLink &&
          payment.estadoPagoActividad?.habilitado
      ),
      requierePago,
    }
  }

  if (source.actividadSlug === "terapia") {
    if (source.reservaEstado) {
      const visibleParaParticipante = participanteReservaEmail === actorEmail

      return {
        visibleParaParticipante,
        puedeIngresar: Boolean(
          visibleParaParticipante &&
            meetLink &&
            (estado === "confirmada" || estado === "realizada")
        ),
        requierePago,
      }
    }

    if (source.modo === "disponibilidad") {
      return {
        visibleParaParticipante: false,
        puedeIngresar: false,
        requierePago,
      }
    }

    const visibleParaParticipante = participanteEmail === actorEmail

    return {
      visibleParaParticipante,
      puedeIngresar: Boolean(
        visibleParaParticipante &&
          meetLink &&
          payment.estadoPagoActividad?.habilitado
      ),
      requierePago,
    }
  }

  return {
    visibleParaParticipante: true,
    puedeIngresar: meetLink,
    requierePago,
  }
}

export function resolverMotivoBloqueoEncuentro(params: {
  source: EncounterSource
  payment: EncounterPaymentContext
  access: EncounterAccessContext
  estado?: EncounterResolvedState["estado"]
  visibleParaParticipante?: boolean
  puedeIngresar?: boolean
  requierePago?: boolean
}) {
  const { source, payment, access } = params
  const estado = params.estado || resolverEstadoBase(source)
  const meetLink = Boolean(source.meetLink)
  const requierePago =
    params.requierePago === undefined
      ? resolverRequierePago(source)
      : params.requierePago
  const acceso = resolverAccesoEncuentro({ source, payment, access, estado })
  const visibleParaParticipante =
    params.visibleParaParticipante === undefined
      ? acceso.visibleParaParticipante
      : params.visibleParaParticipante
  const puedeIngresar =
    params.puedeIngresar === undefined ? acceso.puedeIngresar : params.puedeIngresar

  if (access.esAdmin) {
    if (!meetLink) {
      return "Meet aún no generado."
    }

    if (estado === "pendiente_pago") {
      if (source.medioPago === "transferencia") {
        return source.comprobanteNombreArchivo
          ? "Pendiente de revisar comprobante de transferencia."
          : "Pendiente de que la persona suba el comprobante de transferencia."
      }

      if (source.medioPago === "mercado_pago") {
        return "Pendiente de acreditación o confirmación de Mercado Pago."
      }

      return "Pendiente de pago o validación administrativa."
    }

    if (estado === "confirmada" && source.requierePagoConfigurado) {
      return "Pago validado. Encuentro habilitado."
    }

    if (estado === "realizada") {
      return "Encuentro realizado."
    }

    return null
  }

  if (!visibleParaParticipante) {
    return null
  }

  if (source.fuente === "espacios_resumen") {
    if (source.origen === "reserva") {
      const confirmada =
        source.reservaEstado === "confirmada" ||
        source.disponibilidadEstado === "confirmada"

      if (!meetLink) {
        return "Meet aún no generado."
      }

      if (requierePago && !payment.estadoPagoActividad?.habilitado) {
        if (
          source.actividadSlug === "terapia" &&
          payment.estadoPagoActividad?.modalidad === "sesion" &&
          confirmada
        ) {
          return null
        }

        return motivoPagoParaEncuentro(
          source.actividadSlug,
          payment.estadoPagoActividad?.motivo || ""
        )
      }

      if (!confirmada) {
        return "El ingreso se habilita al confirmarse la reserva/pago."
      }

      return null
    }

    if (!meetLink) {
      return "Meet aún no generado."
    }

    if (!payment.estadoPagoActividad?.habilitado) {
      return motivoPagoParaEncuentro(
        source.actividadSlug,
        payment.estadoPagoActividad?.motivo || ""
      )
    }

    return null
  }

  if (source.estrategia === "grupo_fijo") {
    if (payment.accesoActividad?.acceso) {
      return !meetLink ? "Meet aún no generado." : null
    }

    if (
      payment.accesoActividad?.motivo === "sin_pago" ||
      payment.accesoActividad?.motivo === "pendiente" ||
      payment.accesoActividad?.motivo === "rechazado"
    ) {
      return "El acceso a este encuentro se habilita cuando el pago del período esté aprobado."
    }

    return "Tu acceso a esta actividad no está habilitado en este momento."
  }

  if (source.actividadSlug === "mentorias") {
    if (!puedeIngresar) {
      return !meetLink
        ? "Meet aún no generado."
        : "El acceso a la reunión se habilita cuando el pago mensual está al día."
    }

    return null
  }

  if (source.actividadSlug === "terapia") {
    if (source.reservaEstado) {
      if (!puedeIngresar) {
        return estado === "pendiente_pago"
          ? "La sesión queda habilitada cuando se confirma el pago."
          : !meetLink
            ? "Meet aún no generado."
            : "Esta sesión todavía no está habilitada."
      }

      return null
    }

    if (!puedeIngresar) {
      return !meetLink
        ? "Meet aún no generado."
        : "El acceso a la sesión se habilita cuando el pago está aprobado."
    }
  }

  return null
}

export function resolverEstadoAdministrativoEncuentro(params: {
  source: EncounterSource
  payment: EncounterPaymentContext
  access: EncounterAccessContext
}) {
  const { source, payment, access } = params

  if (!access.esAdmin) {
    return {
      estadoPagoAdmin: null,
      detallePagoAdmin: null,
    }
  }

  if (
    (source.actividadSlug === "mentorias" || source.actividadSlug === "terapia") &&
    normalizarEmail(source.participanteEmail || source.participanteReservaEmail)
  ) {
    const descripcion = describirEstadoPagoAdmin(
      source.actividadSlug,
      payment.estadoPagoActividad
    )

    return {
      estadoPagoAdmin: descripcion.estado,
      detallePagoAdmin: descripcion.detalle,
    }
  }

  if (source.estrategia === "grupo_fijo") {
    return {
      estadoPagoAdmin: "mensual_grupal",
      detallePagoAdmin:
        "Actividad grupal con cobro mensual por participante. El seguimiento puntual se resuelve desde Admin Pagos.",
    }
  }

  return {
    estadoPagoAdmin: null,
    detallePagoAdmin: null,
  }
}

export function resolverProximoPasoUsuario(params: {
  source: EncounterSource
  payment: EncounterPaymentContext
  access: EncounterAccessContext
  estado?: EncounterResolvedState["estado"]
  puedeIngresar?: boolean
  visibleParaParticipante?: boolean
}) {
  const { source, payment, access } = params
  const estado = params.estado || resolverEstadoBase(source)
  const acceso = resolverAccesoEncuentro({ source, payment, access, estado })
  const puedeIngresar =
    params.puedeIngresar === undefined ? acceso.puedeIngresar : params.puedeIngresar
  const visibleParaParticipante =
    params.visibleParaParticipante === undefined
      ? acceso.visibleParaParticipante
      : params.visibleParaParticipante

  if (access.esAdmin || !visibleParaParticipante) {
    return "Sin acciones pendientes"
  }

  if (puedeIngresar) {
    return "Ingresar al encuentro"
  }

  if (source.actividadSlug === "terapia" && estado === "pendiente_pago") {
    return "Pagar sesión"
  }

  if (
    source.actividadSlug === "mentorias" &&
    payment.estadoPagoActividad?.motivo &&
    payment.estadoPagoActividad.motivo !== "pagado" &&
    payment.estadoPagoActividad.motivo !== "gracia"
  ) {
    return "Regularizar pago mensual"
  }

  if (!source.meetLink) {
    return "Esperar confirmación"
  }

  return "Sin acciones pendientes"
}

export function resolverEstadoEncuentro(params: {
  source: EncounterSource
  payment: EncounterPaymentContext
  access: EncounterAccessContext
}) {
  const { source, payment, access } = params
  const estado = resolverEstadoBase(source)
  const acceso = resolverAccesoEncuentro({
    source,
    payment,
    access,
    estado,
  })
  const admin = resolverEstadoAdministrativoEncuentro({
    source,
    payment,
    access,
  })
  const motivoBloqueo = resolverMotivoBloqueoEncuentro({
    source,
    payment,
    access,
    estado,
    visibleParaParticipante: acceso.visibleParaParticipante,
    puedeIngresar: acceso.puedeIngresar,
    requierePago: acceso.requierePago,
  })
  const proximoPasoUsuario = resolverProximoPasoUsuario({
    source,
    payment,
    access,
    estado,
    puedeIngresar: acceso.puedeIngresar,
    visibleParaParticipante: acceso.visibleParaParticipante,
  })

  return {
    estado,
    visibleParaParticipante: acceso.visibleParaParticipante,
    puedeIngresar: acceso.puedeIngresar,
    motivoBloqueo,
    requierePago: acceso.requierePago,
    estadoPagoAdmin: admin.estadoPagoAdmin,
    detallePagoAdmin: admin.detallePagoAdmin,
    proximoPasoUsuario,
  } satisfies EncounterResolvedState
}
