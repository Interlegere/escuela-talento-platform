// Íconos de línea simple, SVG inline (sin librería) para las tarjetas de
// "Cómo funciona". stroke="currentColor" para heredar el color por className.
type Props = { className?: string }

export function IconoCalendario({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18" strokeLinecap="round" />
      <path d="M8 3v4M16 3v4" strokeLinecap="round" />
      <path d="M7.5 14h2M11 14h2M14.5 14h2M7.5 17.5h2M11 17.5h2" strokeLinecap="round" />
    </svg>
  )
}

export function IconoCelular({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" strokeLinecap="round" />
      <path d="M9 7h6v7H9z" />
    </svg>
  )
}

export function IconoDosPersonas({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c0-3 2.5-5.2 5.5-5.2S14.5 17 14.5 20" strokeLinecap="round" />
      <circle cx="17" cy="7.5" r="2.3" />
      <path d="M14.7 12.2c2.5.2 4.3 2.3 4.3 5" strokeLinecap="round" />
    </svg>
  )
}

export function IconoWhatsapp({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M4.5 20.5l1.3-4.1a8 8 0 1 1 3.1 3.1z" strokeLinejoin="round" />
      <path
        d="M9 9.3c0-.5.4-1 .9-1h.5c.3 0 .5.2.6.5l.5 1.4c.1.3 0 .6-.2.8l-.5.5c.4.9 1.1 1.6 2 2l.5-.5c.2-.2.5-.3.8-.2l1.4.5c.3.1.5.3.5.6v.5c0 .5-.5.9-1 .9-2.9 0-5.5-2.6-5.5-5.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconoGrupo({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <circle cx="12" cy="7" r="2.6" />
      <circle cx="5" cy="9.5" r="2" />
      <circle cx="19" cy="9.5" r="2" />
      <path d="M12 11.5c-3 0-5.3 2.1-5.3 5.3M12 11.5c3 0 5.3 2.1 5.3 5.3" strokeLinecap="round" />
      <path d="M5 12.8c-1.7.3-3 1.7-3 3.7M19 12.8c1.7.3 3 1.7 3 3.7" strokeLinecap="round" />
    </svg>
  )
}
