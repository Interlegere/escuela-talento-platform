// Íconos de línea simple, SVG inline propios (sin librería) — trazo 1,5px,
// esquinas redondeadas. stroke="currentColor" para heredar el color por
// className (el llamador los pone en --tinta sobre un círculo --dorado).
type Props = { className?: string }

const BASE = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const

export function IconoCalendario({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" {...BASE} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
      <path d="M7.5 14h2M11 14h2M14.5 14h2M7.5 17.5h2M11 17.5h2" />
    </svg>
  )
}

export function IconoCelular({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" {...BASE} className={className}>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
      <path d="M9 7h6v7H9z" />
    </svg>
  )
}

export function IconoDosPersonas({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" {...BASE} className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c0-3 2.5-5.2 5.5-5.2S14.5 17 14.5 20" />
      <circle cx="17" cy="7.5" r="2.3" />
      <path d="M14.7 12.2c2.5.2 4.3 2.3 4.3 5" />
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
      <circle cx="12" cy="7" r="2.6" />
      <circle cx="5" cy="9.5" r="2" />
      <circle cx="19" cy="9.5" r="2" />
      <path d="M12 11.5c-3 0-5.3 2.1-5.3 5.3M12 11.5c3 0 5.3 2.1 5.3 5.3" />
      <path d="M5 12.8c-1.7.3-3 1.7-3 3.7M19 12.8c1.7.3 3 1.7 3 3.7" />
    </svg>
  )
}

export function IconoSemilla({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" {...BASE} className={className}>
      <path d="M12 21c-4.5-1-7-4.8-7-9.5C5 7 8 3.5 12 3c4 .5 7 4 7 8.5 0 4.7-2.5 8.5-7 9.5z" />
      <path d="M12 21V9" />
      <path d="M12 13c-2-.3-3.5-1.8-4-4" />
    </svg>
  )
}

export function IconoBrujula({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" {...BASE} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.8 9.2l-2 5.6-5.6 2 2-5.6 5.6-2z" strokeLinejoin="round" />
    </svg>
  )
}

export function IconoChispa({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" {...BASE} className={className}>
      <path d="M12 3c.6 3.4 2 5.4 5 6-3 .6-4.4 2.6-5 6-.6-3.4-2-5.4-5-6 3-.6 4.4-2.6 5-6z" strokeLinejoin="round" />
      <path d="M19 15.5c.3 1.6.9 2.5 2.3 2.8-1.4.3-2 1.2-2.3 2.8-.3-1.6-.9-2.5-2.3-2.8 1.4-.3 2-1.2 2.3-2.8z" strokeLinejoin="round" />
    </svg>
  )
}
