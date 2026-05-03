import type { ActivitySlug } from "@/lib/authz"

export type BillingMode = "mensual" | "sesion" | "proceso"

export function normalizarModalidadPago(
  modalidad?: string | null,
  actividadSlug?: ActivitySlug | string | null
): BillingMode {
  if (actividadSlug && actividadSlug !== "terapia") {
    return "mensual"
  }

  if (modalidad === "mensual" || modalidad === "sesion" || modalidad === "proceso") {
    return modalidad
  }

  if (actividadSlug === "terapia") {
    return "proceso"
  }

  return "mensual"
}

export function etiquetaModalidadPago(
  modalidad: BillingMode,
  actividadSlug?: ActivitySlug | string | null
) {
  if (modalidad === "sesion") {
    return "Pago por sesión"
  }

  if (modalidad === "proceso") {
    return actividadSlug === "terapia" ? "Pago por proceso" : "Pago único"
  }

  if (actividadSlug === "mentorias") {
    return "Suscripción mensual"
  }

  return "Pago mensual"
}
