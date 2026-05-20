export const ESTADOS_DISPONIBILIDAD_ACTIVA = [
  "disponible",
  "confirmada",
  "pendiente_pago",
] as const

export type EstadoDisponibilidadActiva =
  (typeof ESTADOS_DISPONIBILIDAD_ACTIVA)[number]

export function normalizarEstadoDisponibilidad(estado: unknown) {
  return String(estado || "").trim().toLowerCase()
}

export function esEstadoDisponibilidadActivo(
  estado: unknown
): estado is EstadoDisponibilidadActiva {
  return ESTADOS_DISPONIBILIDAD_ACTIVA.includes(
    normalizarEstadoDisponibilidad(estado) as EstadoDisponibilidadActiva
  )
}
