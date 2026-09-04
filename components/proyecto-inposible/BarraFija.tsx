"use client"

import { useEffect, useState } from "react"
import { formatearMontoArs, PRECIOS_ARS } from "@/lib/proyecto-inposible"

// Aparece cuando el hero sale de pantalla, se va cuando el formulario entra
// — es el único momento en que estorba. Resuelve que hoy el precio esté al
// 78% del scroll: acá está siempre a un click, sin importar dónde estés.
// Sus dos botones siguen la regla de contraste de BotonCTA (page.tsx):
// fondo dorado → texto tinta.
export default function BarraFija() {
  const [heroPasado, setHeroPasado] = useState(false)
  const [formEnVista, setFormEnVista] = useState(false)

  useEffect(() => {
    const heroFin = document.getElementById("hero-fin")
    const form = document.getElementById("inscripcion")
    if (!heroFin || !form) return

    const obsHero = new IntersectionObserver(([entry]) => setHeroPasado(!entry.isIntersecting), { threshold: 0 })
    const obsForm = new IntersectionObserver(([entry]) => setFormEnVista(entry.isIntersecting), { threshold: 0 })
    obsHero.observe(heroFin)
    obsForm.observe(form)
    return () => {
      obsHero.disconnect()
      obsForm.disconnect()
    }
  }, [])

  const mostrar = heroPasado && !formEnVista
  const precioMensual = formatearMontoArs(PRECIOS_ARS.mensual.transferencia)

  return (
    <>
      {/* Desktop: arriba */}
      <div
        aria-hidden={!mostrar}
        className={`fixed inset-x-0 top-0 z-40 hidden h-14 items-center justify-center border-b border-[var(--tinta)]/10 bg-[var(--crema)]/90 backdrop-blur-sm transition-transform duration-200 sm:flex ${
          mostrar ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="flex w-full max-w-[860px] items-center justify-between px-6">
          <p className="truncate text-sm font-semibold text-[var(--tinta)]">
            Proyecto In+Posible <span className="opacity-40">·</span> desde {precioMensual}/mes{" "}
            <span className="opacity-40">·</span> Cierra el viernes 11
          </p>
          <a
            href="#inscripcion"
            tabIndex={mostrar ? 0 : -1}
            className="ml-4 inline-flex h-9 shrink-0 items-center rounded-full bg-[var(--dorado)] px-5 text-sm font-bold text-[var(--tinta)]! shadow-[0_8px_20px_-4px_rgba(249,195,62,0.55)] transition hover:bg-[var(--dorado-hover)]"
          >
            ¡Quiero mi lugar!
          </a>
        </div>
      </div>

      {/* Mobile: abajo, con el safe-area del iPhone */}
      <div
        aria-hidden={!mostrar}
        className={`fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-[var(--tinta)]/10 bg-[var(--crema)]/95 px-4 pt-2.5 backdrop-blur-sm transition-transform duration-200 sm:hidden ${
          mostrar ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}
      >
        <p className="shrink-0 text-xs font-semibold text-[var(--tinta)]">Cierra el viernes 11</p>
        <a
          href="#inscripcion"
          tabIndex={mostrar ? 0 : -1}
          className="flex-1 rounded-full bg-[var(--dorado)] py-2.5 text-center text-sm font-bold text-[var(--tinta)]! shadow-[0_8px_20px_-4px_rgba(249,195,62,0.55)] transition hover:bg-[var(--dorado-hover)]"
        >
          ¡Quiero mi lugar!
        </a>
      </div>
    </>
  )
}
