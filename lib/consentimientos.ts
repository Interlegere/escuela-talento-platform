export const CONSENTIMIENTO_VERSION = "v1.0"

export type ConsentimientoActividadSlug =
  | "casatalentos"
  | "conectando-sentidos"
  | "mentorias"
  | "terapia"
  | "charla-introductoria"

type ConsentimientoActividadMeta = {
  slug: ConsentimientoActividadSlug
  nombre: string
}

const ACTIVIDADES: Record<
  ConsentimientoActividadSlug,
  ConsentimientoActividadMeta
> = {
  casatalentos: {
    slug: "casatalentos",
    nombre: "CasaTalentos",
  },
  "conectando-sentidos": {
    slug: "conectando-sentidos",
    nombre: "Conectando Sentidos",
  },
  mentorias: {
    slug: "mentorias",
    nombre: "Mentoría",
  },
  terapia: {
    slug: "terapia",
    nombre: "Terapia",
  },
  "charla-introductoria": {
    slug: "charla-introductoria",
    nombre: "Charla introductoria",
  },
}

export function esActividadConsentimiento(
  value: string
): value is ConsentimientoActividadSlug {
  return value in ACTIVIDADES
}

export function getConsentimientoActividadMeta(
  actividad: ConsentimientoActividadSlug
) {
  return ACTIVIDADES[actividad]
}

export function getConsentimientoTexto(
  actividad: ConsentimientoActividadSlug,
  encuentro?: {
    fecha?: string | null
    hora?: string | null
  }
) {
  const actividadNombre = getConsentimientoActividadMeta(actividad).nombre
  const fechaHora =
    encuentro?.fecha || encuentro?.hora
      ? formatearEncuentro(encuentro?.fecha, encuentro?.hora)
      : ""

  const parrafos = [
    `Al ingresar a esta videollamada de la Escuela (${actividadNombre}), confirmás que leíste y aceptás los Términos y Condiciones vigentes de la plataforma, disponibles para su consulta.`,
    "Tu participación es voluntaria y se rige por dichas condiciones, incluyendo el posible registro de imagen, voz y contenidos generados durante la actividad.",
    "Al continuar, Ud. confirma su aceptación plena.",
  ].filter((item): item is string => Boolean(item))

  const textosAdicionales: string[] = []

  if (actividad === "terapia") {
    textosAdicionales.push(
      "Este espacio corresponde a una intervención terapéutica profesional."
    )
  }

  if (actividad === "conectando-sentidos") {
    textosAdicionales.push(
      "Este espacio implica un trabajo de carácter analítico."
    )
  }

  return {
    actividadNombre,
    fechaHora,
    parrafos,
    textosAdicionales,
  }
}

function formatearEncuentro(fecha?: string | null, hora?: string | null) {
  if (!fecha) return hora || ""

  const d = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(d.getTime())) {
    return `${fecha}${hora ? ` · ${hora}` : ""}`
  }

  const fechaTexto = d.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  return `${fechaTexto.charAt(0).toUpperCase()}${fechaTexto.slice(1)}${
    hora ? ` · ${hora}` : ""
  }`
}
