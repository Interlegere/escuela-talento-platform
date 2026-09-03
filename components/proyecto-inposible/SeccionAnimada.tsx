"use client"

import { useEffect, useRef, useState } from "react"

// Fondo por sección — el ritmo de fondos es lo que convierte el scroll en
// una secuencia de lugares distintos en vez de un documento único.
type Fondo = "noche" | "crema" | "arena" | "blanco"

const FONDOS: Record<Fondo, string> = {
  noche: "bg-[var(--azul-noche)] text-[var(--crema)]",
  crema: "bg-[var(--crema)] text-[var(--azul-noche)]",
  arena: "bg-[var(--arena)] text-[var(--azul-noche)]",
  blanco: "bg-white text-[var(--azul-noche)]",
}

type Ancho = "normal" | "ancho" | "completo"

const ANCHOS: Record<Ancho, string> = {
  normal: "max-w-3xl px-4 sm:px-6",
  ancho: "max-w-5xl px-4 sm:px-6",
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
        <div aria-hidden className="flex justify-center pt-8 sm:pt-10">
          <span className="text-2xl font-bold text-[var(--naranja)] sm:text-3xl">+</span>
        </div>
      )}
      <div
        ref={ref}
        className={`mx-auto py-10 transition-all duration-700 ease-out sm:py-14 ${ANCHOS[ancho]} ${
          visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
        }`}
      >
        {children}
      </div>
    </section>
  )
}
