import type { ActivitySlug } from "@/lib/authz"

export type AgendaStrategy =
  | "grupo_fijo"
  | "individual_fijo"
  | "reserva_individual"

export type ActivityFeatureKey =
  | "plataforma"
  | "videollamada"
  | "dispositivo_semanal"
  | "mensajeria"
  | "recursos"

type ActivityRule = {
  slug: ActivitySlug
  agendaStrategy: AgendaStrategy
  paymentGraceDay?: number | null
  tituloAgenda: string
}

export const ACTIVITY_RULES: Record<ActivitySlug, ActivityRule> = {
  casatalentos: {
    slug: "casatalentos",
    agendaStrategy: "grupo_fijo",
    paymentGraceDay: 10,
    tituloAgenda: "Reunión semanal",
  },
  "conectando-sentidos": {
    slug: "conectando-sentidos",
    agendaStrategy: "grupo_fijo",
    paymentGraceDay: 10,
    tituloAgenda: "Sesión Conectando Sentidos",
  },
  mentorias: {
    slug: "mentorias",
    agendaStrategy: "individual_fijo",
    paymentGraceDay: 10,
    tituloAgenda: "Reuniones TMV",
  },
  terapia: {
    slug: "terapia",
    agendaStrategy: "reserva_individual",
    paymentGraceDay: null,
    tituloAgenda: "Sesiones de Terapia",
  },
  membresia: {
    slug: "membresia",
    agendaStrategy: "grupo_fijo",
    paymentGraceDay: 10,
    tituloAgenda: "Membresía",
  },
}

export function getActivityRule(actividadSlug: ActivitySlug) {
  return ACTIVITY_RULES[actividadSlug]
}

export function estaDentroDeGraciaMensual(
  actividadSlug: ActivitySlug,
  fechaActual = new Date()
) {
  const graceDay = ACTIVITY_RULES[actividadSlug]?.paymentGraceDay

  if (!graceDay) {
    return false
  }

  return fechaActual.getDate() <= graceDay
}
