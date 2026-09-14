// Familia de íconos de línea para Entusiasmento — mismo criterio en
// todos: viewBox 24x24, sin relleno, trazo en currentColor, grosor 1.8,
// extremos y uniones redondeados. Reemplazan los emojis sueltos que
// había antes: un emoji se ve distinto según la fuente/SO de cada
// persona (más grande, con color propio, desalineado con el texto); un
// ícono de trazo propio pesa igual en todos lados y se puede poner
// exactamente del tamaño del texto que acompaña.
//
// El tamaño no se fija acá adentro — cada uso decide su className (por
// default h-4 w-4, discreto) para que nunca quede más grande que el
// texto de al lado.

type IconoProps = {
  className?: string
}

const BASE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

export function IconoComentario({ className = "h-4 w-4" }: IconoProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2V6Z" />
    </svg>
  )
}

export function IconoEditar({ className = "h-4 w-4" }: IconoProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <path d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19 4 20Z" />
      <path d="M13.5 6.5 17 10" />
    </svg>
  )
}

export function IconoDestello({ className = "h-4 w-4" }: IconoProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
    </svg>
  )
}

export function IconoBrujula({ className = "h-4 w-4" }: IconoProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15 9l-2 5-5 2 2-5 5-2Z" />
    </svg>
  )
}

// Mi espacio — el mismo dibujo que ya usaba BarraInferior (ahí sigue
// significando "tu espacio"; acá reemplaza al 🪴 suelto en el resto de
// la página).
export function IconoMaceta({ className = "h-4 w-4" }: IconoProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
    </svg>
  )
}

// CoFruto — ídem, el mismo dibujo que ya usaba BarraInferior, acá
// reemplaza al 🧺 suelto.
export function IconoCanasto({ className = "h-4 w-4" }: IconoProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" />
    </svg>
  )
}
