"use client"

import { Children, cloneElement, isValidElement, useEffect, useRef, useState } from "react"

type FilaProps = { className?: string; style?: React.CSSProperties }

// Envoltorio compartido por "Los tres ejes" y "Cómo funciona": entrada
// escalonada (fade + subida de 20px, 80ms de diferencia entre fila y fila)
// una sola vez, más la línea vertical naranja que se dibuja de arriba hacia
// abajo (scaleY 0→1, transform-origin: top, 600ms) cuando conLinea=true.
// Respeta prefers-reduced-motion mostrando todo de una.
export default function GrupoFilasAnimadas({
  children,
  conLinea = false,
}: {
  children: React.ReactNode
  conLinea?: boolean
}) {
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

  const filas = Children.toArray(children)

  return (
    <div ref={ref} className="relative">
      {conLinea && (
        <div
          aria-hidden
          className="absolute left-0 top-0 h-full w-[2px] origin-top bg-[var(--naranja)] transition-transform duration-[600ms] ease-out"
          style={{ transform: visible ? "scaleY(1)" : "scaleY(0)" }}
        />
      )}
      <div className={conLinea ? "space-y-6 pl-6 sm:pl-10" : "space-y-6"}>
        {filas.map((fila, i) => {
          if (!isValidElement<FilaProps>(fila)) return fila
          return cloneElement(fila, {
            style: {
              ...fila.props.style,
              transitionDelay: `${i * 80}ms`,
            },
            className: `${fila.props.className ?? ""} transition-all duration-700 ease-out ${
              visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
            }`.trim(),
          })
        })}
      </div>
    </div>
  )
}
