// Versión del texto del cartel de consentimiento que se muestra antes de
// cada encuentro — no confundir con TERMINOS_VERSION (la de los Términos y
// Condiciones en sí). Desde la sección 17 de los Términos, esta versión ya
// no es lo que hace que la gente vuelva a aceptar (eso lo garantiza el
// propio encuentro, ver app/api/consentimientos/route.ts): queda solo como
// etiqueta del texto de acá abajo, y conviene subirla cuando ese texto
// cambie — como ahora, al unificar el trato a voseo.
export const CONSENTIMIENTO_VERSION = "v2.0"

// Versión de los Términos y Condiciones (app/terminos-y-condiciones/page.tsx)
// que se registra en cada fila de "consentimientos" (columna
// terminos_version). Única fuente de verdad: la página de Términos importa
// esta misma constante para que el texto y el registro nunca puedan quedar
// diciendo cosas distintas.
export const TERMINOS_VERSION = "3.0"

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
    nombre: "Entusiasmento",
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

  const parrafos =
    actividad === "charla-introductoria"
      ? [
          `Al ingresar a esta grabación de la Escuela (${actividadNombre}), confirmás que leíste y aceptás los Términos y Condiciones vigentes de la plataforma, disponibles para su consulta.`,
          "El acceso a este contenido es personal y estará disponible únicamente durante el período informado dentro de Campus.",
          "Al continuar, confirmás tu aceptación.",
        ].filter((item): item is string => Boolean(item))
      : [
          `Al ingresar a esta videollamada de la Escuela (${actividadNombre}), confirmás que leíste y aceptás los Términos y Condiciones vigentes de la plataforma, disponibles para su consulta.`,
          "Tu participación es voluntaria y se rige por dichas condiciones, incluyendo el posible registro de imagen, voz y contenidos generados durante la actividad.",
          "Al continuar, confirmás tu aceptación.",
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
