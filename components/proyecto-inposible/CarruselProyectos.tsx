"use client"

import Image from "next/image"
import { useEffect, useRef } from "react"
import { PROYECTOS, type Proyecto } from "@/lib/proyecto-inposible-proyectos"

// Tarjetas chicas (130px de paso en desktop, 90px en mobile): siete logos
// miden 910px en desktop, más que la ventana visible de 860px — así que una
// copia sola ya no entra completa en pantalla y nunca se alcanza a ver el
// mismo logo dos veces a la vez.
function TarjetaProyecto({ proyecto }: { proyecto: Proyecto }) {
  // Logo y nombre van juntos adentro del mismo <a> — antes el link solo
  // envolvía el logo y el nombre quedaba como texto suelto al lado,
  // pareciendo clickeable sin serlo.
  const contenido = (
    <>
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--tinta)]/10 bg-white shadow-sm sm:h-[92px] sm:w-[92px]">
        <Image
          src={`/proyectos/${proyecto.archivo}`}
          alt={proyecto.nombre}
          width={92}
          height={92}
          className="h-full w-full object-cover"
        />
      </div>
      <span className="text-center text-xs font-medium text-[var(--tinta)]/70">{proyecto.nombre}</span>
    </>
  )

  return (
    <div className="flex w-[90px] shrink-0 flex-col items-center gap-2 px-1 sm:w-[130px]">
      {proyecto.instagram ? (
        <a
          href={proyecto.instagram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${proyecto.nombre} en Instagram`}
          className="flex flex-col items-center gap-2"
        >
          {contenido}
        </a>
      ) : (
        contenido
      )}
    </div>
  )
}

export default function CarruselProyectos() {
  const trackRef = useRef<HTMLDivElement>(null)
  const pausadoRef = useRef(false)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    let frame: number
    const paso = () => {
      if (!pausadoRef.current) {
        track.scrollLeft += 0.5
        if (track.scrollLeft >= track.scrollWidth / 3) {
          track.scrollLeft = 0
        }
      }
      frame = requestAnimationFrame(paso)
    }
    frame = requestAnimationFrame(paso)

    return () => cancelAnimationFrame(frame)
  }, [])

  // Triplicado (no solo duplicado): con el contenedor angosto de ahora, una
  // sola copia de los 7 logos ya es más ancha que el contenedor visible, así
  // que la tercera copia da margen de sobra para que el loop nunca muestre
  // el mismo logo dos veces en pantalla a la vez.
  const proyectosTriplicados = [...PROYECTOS, ...PROYECTOS, ...PROYECTOS]

  return (
    // Ventana visible fija en 860px (= TOKEN_ANCHO_ANCHO_PX en tokens.ts),
    // centrada, en todos los anchos de pantalla — sin padding interno que
    // la angoste todavía más, para que la medida sea exactamente esa.
    <div className="mx-auto w-[860px] max-w-full">
      <div
        ref={trackRef}
        onMouseEnter={() => {
          pausadoRef.current = true
        }}
        onMouseLeave={() => {
          pausadoRef.current = false
        }}
        className="flex overflow-x-hidden py-2"
      >
        {proyectosTriplicados.map((proyecto, indice) => (
          <TarjetaProyecto key={`${proyecto.nombre}-${indice}`} proyecto={proyecto} />
        ))}
      </div>
    </div>
  )
}
