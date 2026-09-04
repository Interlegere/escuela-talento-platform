// Íconos de línea simple, SVG inline propios (sin librería) — trazo con
// una irregularidad apenas perceptible (curvas asimétricas en vez de
// círculos/rectángulos perfectos) para que se lean como dibujados a mano,
// no como un set de librería. stroke="currentColor" para heredar el color
// por className (el llamador los pone en --tinta sobre un círculo
// --dorado). Los tres de "Los tres ejes" se usan más grandes (48px) que
// los cinco de "Cómo funciona" (20px) — cada uno fija su propio
// strokeWidth acorde a su tamaño real en pantalla, no uno solo para todos.
type Props = { className?: string }

const BASE = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const
const BASE_EJE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const

export function IconoCalendario({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" {...BASE} className={className}>
      <path d="M4 8.5c-.1-2.3 1-3.4 3.2-3.5h9.6c2.2.1 3.3 1.2 3.2 3.5v9c.1 2.3-1 3.4-3.2 3.5H7.2c-2.2-.1-3.3-1.2-3.2-3.5v-9z" />
      <path d="M4.2 10c5.2-.3 10.4-.3 15.6 0" />
      <path d="M8.3 3.5v4M15.7 3.5v4" />
      <path d="M7.8 14.2h1.6M11.2 14.2h1.6M14.6 14.2h1.6M7.8 17.4h1.6M11.2 17.4h1.6" />
    </svg>
  )
}

export function IconoCelular({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" {...BASE} className={className}>
      <path d="M7 4.2c-.1-1.2.6-1.9 1.8-2h6.4c1.2.1 1.9.8 1.8 2v15.6c.1 1.2-.6 1.9-1.8 2H8.8c-1.2-.1-1.9-.8-1.8-2V4.2z" />
      <path d="M10.3 18.6h3.4" />
      <path d="M9 8h6.2v6.4H9z" />
    </svg>
  )
}

export function IconoDosPersonas({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" {...BASE} className={className}>
      <path d="M9 5.2c1.7-.1 2.9 1.1 3 2.8.1 1.7-1.1 3.1-2.8 3.2-1.7.1-3.1-1.1-3.2-2.8-.1-1.7 1.1-3.1 2.8-3.2z" />
      <path d="M3.5 19.8c-.2-3 2.2-5.4 5.4-5.5 3.2-.1 5.6 2 5.7 5" />
      <path d="M17 5.4c1.3-.1 2.4.9 2.5 2.2.1 1.3-.9 2.4-2.2 2.5-1.3.1-2.4-.9-2.5-2.2-.1-1.3.9-2.4 2.2-2.5z" />
      <path d="M14.8 12.3c2.4.3 4.2 2.4 4.2 4.9" />
    </svg>
  )
}

export function IconoWhatsapp({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" {...BASE} className={className}>
      <path d="M4.5 20.5l1.3-4.1a8 8 0 1 1 3.1 3.1z" />
      <path d="M9 9.3c0-.5.4-1 .9-1h.5c.3 0 .5.2.6.5l.5 1.4c.1.3 0 .6-.2.8l-.5.5c.4.9 1.1 1.6 2 2l.5-.5c.2-.2.5-.3.8-.2l1.4.5c.3.1.5.3.5.6v.5c0 .5-.5.9-1 .9-2.9 0-5.5-2.6-5.5-5.5z" />
    </svg>
  )
}

export function IconoGrupo({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" {...BASE} className={className}>
      <path d="M12 4.6c1.5-.1 2.7 1 2.8 2.5.1 1.5-1 2.7-2.5 2.8-1.5.1-2.7-1-2.8-2.5-.1-1.5 1-2.7 2.5-2.8z" />
      <path d="M5.2 7.2c1.1-.1 2 .8 2.1 1.9.1 1.1-.8 2-1.9 2.1-1.1.1-2-.8-2.1-1.9-.1-1.1.8-2 1.9-2.1z" />
      <path d="M18.9 7.2c1.1-.1 2 .8 2.1 1.9.1 1.1-.8 2-1.9 2.1-1.1.1-2-.8-2.1-1.9-.1-1.1.8-2 1.9-2.1z" />
      <path d="M12 11.2c-3 .1-5.2 2.3-5.1 5.6" />
      <path d="M12 11.2c3 .1 5.2 2.3 5.1 5.6" />
      <path d="M5.1 12.4c-1.7.4-2.9 1.9-2.8 3.9M19 12.4c1.7.4 2.9 1.9 2.8 3.9" />
    </svg>
  )
}

// Rosa de los vientos, para "Las coordenadas" — círculo apenas irregular,
// una aguja inclinada que lo cruza, cuatro marcas cardinales cortas afuera
// del círculo y un punto en el centro.
export function IconoBrujula({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" {...BASE_EJE} className={className}>
      <path d="M12 3.2c4.9.1 8.7 4 8.6 8.9-.1 4.8-4.1 8.6-9 8.5-4.8-.1-8.6-4.1-8.5-9 .1-4.8 4.1-8.5 8.9-8.4z" />
      <path d="M7.5 16.5L16.3 7.3" />
      <path d="M12 1v1.7M12 21.3V23M1 12h1.7M21.3 12H23" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Camino punteado que se vuelve línea continua y sale del cuadro en punta
// de flecha, para "Empezar sin esperar a estar listo".
export function IconoChispa({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" {...BASE_EJE} className={className}>
      <path d="M3.5 17.5c2.7-.8 5-2.4 6.8-4.6" strokeDasharray="0.6 3.2" />
      <path d="M10.3 12.9c2.8-3.3 5.8-5.2 9.3-6.1" />
      <path d="M16.3 5.9l3.9.9-1.4 3.7" />
    </svg>
  )
}

// Semilla partida al medio con un brote de dos hojas hacia arriba y una
// raíz corta hacia abajo, para "Semilla y primeros brotes".
export function IconoSemilla({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" {...BASE_EJE} className={className}>
      {/* semilla partida al medio */}
      <path d="M12 13c-2.2.3-3.6 1.9-3.4 3.9.2 1.7 1.6 2.9 3.4 3.1" />
      <path d="M12 13c2.2.3 3.6 1.9 3.4 3.9-.2 1.7-1.6 2.9-3.4 3.1" />
      <path d="M12 13v6.3" />
      {/* brote de dos hojas hacia arriba */}
      <path d="M12 13c-.3-2.6-2-4.2-4.4-4.6 1.1 2.4 2.5 3.8 4.4 4.6z" />
      <path d="M12 13c.3-2.6 2-4.2 4.4-4.6-1.1 2.4-2.5 3.8-4.4 4.6z" />
      {/* raíz corta hacia abajo */}
      <path d="M12 19.3c-.2 1.5-1 2.4-2.1 3M12 19.3c.2 1.5 1 2.4 2.1 3" />
    </svg>
  )
}
