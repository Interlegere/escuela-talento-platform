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
  tituloAgenda: string
}

export const ACTIVITY_RULES: Record<ActivitySlug, ActivityRule> = {
  casatalentos: {
    slug: "casatalentos",
    agendaStrategy: "grupo_fijo",
    tituloAgenda: "Reunión semanal",
  },
  "conectando-sentidos": {
    slug: "conectando-sentidos",
    agendaStrategy: "grupo_fijo",
    tituloAgenda: "Sesión Conectando Sentidos",
  },
  mentorias: {
    slug: "mentorias",
    agendaStrategy: "individual_fijo",
    tituloAgenda: "Reuniones TMV",
  },
  terapia: {
    slug: "terapia",
    agendaStrategy: "reserva_individual",
    tituloAgenda: "Sesiones de Terapia",
  },
  membresia: {
    slug: "membresia",
    agendaStrategy: "grupo_fijo",
    tituloAgenda: "Membresía",
  },
}

export function getActivityRule(actividadSlug: ActivitySlug) {
  return ACTIVITY_RULES[actividadSlug]
}

export function estaDentroDeGraciaMensual(
  graceDay: number | null | undefined,
  fechaActual = new Date()
) {
  if (!graceDay) {
    return false
  }

  return fechaActual.getDate() <= graceDay
}
