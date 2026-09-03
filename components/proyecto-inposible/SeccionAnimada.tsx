"use client"

import { useEffect, useRef, useState } from "react"
import { TOKEN_PAD_SECCION } from "@/app/proyecto-inposible/tokens"

// Fondo por sección — el ritmo de fondos es lo que convierte el scroll en
// una secuencia de lugares distintos en vez de un documento único. Solo dos
// secciones oscuras en toda la página (tierra): IA y el cierre.
type Fondo = "tierra" | "naranja" | "crema" | "arena" | "blanco"

const FONDOS: Record<Fondo, string> = {
  tierra: "bg-[var(--tierra)] text-[var(--crema)]",
  naranja: "bg-[var(--naranja)] text-[var(--crema)]",
  crema: "bg-[var(--crema)] text-[var(--tierra)]",
  arena: "bg-[var(--arena)] text-[var(--tierra)]",
  blanco: "bg-white text-[var(--tierra)]",
}

// --ancho (680px, todo párrafo corrido) y --ancho-ancho (860px, tablas de
// precio, filas de los ejes, carrusel) — únicos dos valores de ancho de
// toda la página.
type Ancho = "normal" | "ancho" | "completo"

// Tailwind necesita las clases como strings literales (no puede generar
// CSS para un valor interpolado en runtime) — por eso acá van escritas a
// mano, pero deben coincidir siempre con TOKEN_ANCHO_PX/TOKEN_ANCHO_ANCHO_PX
// en tokens.ts, que es de donde toma el valor cualquier cálculo en JS.
const ANCHOS: Record<Ancho, string> = {
  normal: "max-w-[680px] px-4 sm:px-6", // = TOKEN_ANCHO_PX
  ancho: "max-w-[860px] px-4 sm:px-6", // = TOKEN_ANCHO_ANCHO_PX
  completo: "",
}

type Props = {
  children: React.ReactNode
  fondo?: Fondo
  ancho?: Ancho
  id?: string
  className?: string
  // El separador "+" va arriba, dentro del propio fondo de la sección, para
  // que nunca se note una costura de color entre dos secciones distintas.
  separador?: boolean
}

export default function SeccionAnimada({
  children,
  fondo = "crema",
  ancho = "normal",
  id,
  className = "",
  separador = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduccionMovimiento =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (reduccionMovimiento) {
      const frame = window.requestAnimationFrame(() => setVisible(true))
      return () => window.cancelAnimationFrame(frame)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.12 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section id={id} className={`w-full ${FONDOS[fondo]} ${className}`}>
      {separador && (
        <div aria-hidden className="flex justify-center py-8 sm:py-10">
          <span className="text-2xl font-bold text-[var(--naranja)] sm:text-3xl">+</span>
        </div>
      )}
      {/* --pad-seccion: 112px desktop / 72px mobile, arriba Y abajo, en las
          catorce secciones, sin excepciones. */}
      <div
        ref={ref}
        className={`mx-auto ${TOKEN_PAD_SECCION} transition-all duration-700 ease-out ${ANCHOS[ancho]} ${
          visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
        }`}
      >
        {children}
      </div>
    </section>
  )
}
