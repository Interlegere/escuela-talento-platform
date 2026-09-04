"use client"

import { useEffect, useRef, useState } from "react"

// Tarjeta blanca (--nube) con el texto colapsado a ~3 líneas por defecto y
// un botón real (aria-expanded/aria-controls) para expandir. El contenido
// completo vive siempre en el HTML — se oculta con max-height + overflow,
// nunca se monta condicionalmente — así Google y las vistas previas lo leen
// igual que si estuviera abierto.
export default function TarjetaColapsable({
  id,
  titulo,
  children,
  extra,
  altoResumen = 98,
  className,
  style,
}: {
  id: string
  titulo: string
  children: React.ReactNode
  extra?: React.ReactNode
  altoResumen?: number
  className?: string
  style?: React.CSSProperties
}) {
  const [abierto, setAbierto] = useState(false)
  const contenidoRef = useRef<HTMLDivElement>(null)
  const [alturaAbierta, setAlturaAbierta] = useState<number>(999)

  useEffect(() => {
    if (contenidoRef.current) {
      setAlturaAbierta(contenidoRef.current.scrollHeight)
    }
  }, [])

  return (
    <div
      className={`flex-1 rounded-3xl bg-[var(--nube)] p-6 shadow-[0_18px_40px_rgba(36,31,28,0.08)] sm:p-7 ${className ?? ""}`}
      style={style}
    >
      <h3 className="[font-family:var(--font-titulo)] text-[clamp(21px,3vw,26px)] font-bold">{titulo}</h3>
      <div
        id={id}
        className="relative mt-2 overflow-hidden transition-[max-height] duration-300 ease-out motion-reduce:transition-none"
        style={{ maxHeight: abierto ? alturaAbierta : altoResumen }}
      >
        <div ref={contenidoRef} className="max-w-[680px] space-y-3 text-[18px] leading-[1.65] opacity-85 sm:text-[19px]">
          {children}
        </div>
        {!abierto && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--nube)] to-transparent"
          />
        )}
      </div>
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((v) => !v)}
        className="mt-2 inline-flex items-center gap-1 rounded text-sm font-bold text-[var(--naranja)] transition hover:text-[var(--coral)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--naranja)]"
      >
        {abierto ? "Cerrar −" : "Seguir leyendo +"}
      </button>
      {extra}
    </div>
  )
}
