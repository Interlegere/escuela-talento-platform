"use client"

import { useEffect, useRef, useState } from "react"

// "Hasta 15 personas" se sacó a propósito: es un número de gestión interna,
// no algo para promocionar — la escasez la sigue diciendo "Cupos dedicados"
// en el hero, sin poner una cifra sobre la mesa.
const ITEMS = [
  { valor: 3, prefijo: "", texto: "talleres en vivo" },
  { valor: 6, prefijo: "", texto: "horas" },
  { valor: 12, prefijo: "", texto: "semanas de soporte" },
  { valor: 1, prefijo: "", texto: "sesión 1 a 1" },
]

function NumeroContador({ valor, activar }: { valor: number; activar: boolean }) {
  // Arranca en el valor real, nunca en 0 — el HTML servido (y lo que se ve
  // si el observer nunca dispara) siempre es el dato correcto. Recién
  // cuando la animación está confirmada (activar=true) se reinicia a 0
  // para contar hacia arriba.
  const [actual, setActual] = useState(valor)

  useEffect(() => {
    if (!activar) return
    const reduccionMovimiento =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduccionMovimiento) {
      return
    }
    const duracion = 600
    const inicio = performance.now()
    let frame: number
    // El primer frame ya calcula t≈0 (recién arrancó "inicio"), así que
    // el conteo visualmente arranca de 0 sin necesitar un setState
    // síncrono en el cuerpo del efecto.
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracion)
      setActual(Math.round(t * valor))
      if (t < 1) frame = requestAnimationFrame(paso)
    }
    frame = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(frame)
  }, [activar, valor])

  return <>{actual}</>
}

// El resumen escaneable de ocho minutos de texto en dos segundos. Cuenta
// desde 0 una sola vez, cuando la banda entra en pantalla — no se repite al
// volver a scrollear.
export default function BandaNumeros() {
  const ref = useRef<HTMLDivElement>(null)
  const [activar, setActivar] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActivar(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.4 }
    )
    observer.observe(el)
    // Igual que en SeccionAnimada: si el observer no dispara, esto no deja
    // el número mal (ya arranca en el valor real), pero sí permite que la
    // animación de conteo llegue a jugar igual, acotada en el tiempo.
    const timeout = window.setTimeout(() => setActivar(true), 3000)
    return () => {
      observer.disconnect()
      window.clearTimeout(timeout)
    }
  }, [])

  return (
    // Cuatro celdas iguales: repeat(4, 1fr) en desktop, repeat(2, 1fr) en
    // mobile — envuelve parejo 2+2, ninguna queda huérfana.
    <div ref={ref} className="grid grid-cols-2 gap-x-6 gap-y-8 text-center sm:grid-cols-4 sm:gap-x-4">
      {ITEMS.map((item) => (
        <div key={item.texto} className="flex flex-col items-center">
          <span className="[font-family:var(--font-titulo)] text-[40px] font-extrabold leading-none text-[var(--naranja)] sm:text-[48px]">
            {item.prefijo}
            <NumeroContador valor={item.valor} activar={activar} />
          </span>
          <span className="mt-2 text-sm leading-snug text-[var(--tinta)] sm:text-base">{item.texto}</span>
        </div>
      ))}
    </div>
  )
}
