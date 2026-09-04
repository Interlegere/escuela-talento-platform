"use client"

import { useEffect, useRef, useState } from "react"
import { TOKEN_PAD_SECCION } from "@/app/proyecto-inposible/tokens"

// Fondo por sección — el contraste de la página lo dan las fotos y el
// naranja, no rectángulos de color: ninguna sección tiene fondo oscuro.
// Alternan crema y arena; la banda naranja de "No esperás al 14" es la
// única superficie de color pleno de toda la página.
type Fondo = "naranja" | "crema" | "arena"

const FONDOS: Record<Fondo, string> = {
  naranja: "bg-[var(--naranja)] text-[var(--crema)]",
  crema: "bg-[var(--crema)] text-[var(--tinta)]",
  arena: "bg-[var(--arena)] text-[var(--tinta)]",
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
  // El separador "+" solo tiene sentido cuando dos secciones consecutivas
  // comparten fondo (el cambio de color ya separa lo suficiente por sí
  // solo) — por eso el default es false. Cuando se pasa true, va DENTRO del
  // padding de la sección, como primer hijo, nunca como bloque propio que
  // suma su propio alto.
  separador?: boolean
  // Override puntual del padding uniforme (TOKEN_PAD_SECCION) — pensado
  // para la única excepción explícita de la página, la banda "No esperás
  // al 14" (56px/72px en vez de 56px/80px).
  padding?: string
}

export default function SeccionAnimada({
  children,
  fondo = "crema",
  ancho = "normal",
  id,
  className = "",
  separador = false,
  padding,
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

  // --pad-seccion: 80px desktop / 56px mobile, arriba Y abajo, en todas las
  // secciones — única excepción explícita: la banda "No esperás al 14"
  // pasa su propio `padding` (56px/72px) por prop.
  const paddingClase = padding ?? TOKEN_PAD_SECCION

  return (
    <section id={id} className={`w-full ${FONDOS[fondo]} ${className}`}>
      <div
        ref={ref}
        className={`mx-auto transition-all duration-700 ease-out ${ANCHOS[ancho]} ${paddingClase} ${
          visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
        }`}
      >
        {separador && (
          <div aria-hidden className="mb-6 flex justify-center sm:mb-8">
            <span className="text-2xl font-bold text-[var(--naranja)] sm:text-3xl">+</span>
          </div>
        )}
        {children}
      </div>
    </section>
  )
}
