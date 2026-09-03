"use client"

import Image from "next/image"
import { useEffect, useRef } from "react"

type Proyecto = {
  nombre: string
  archivo: string
  instagram: string | null
}

// Fondos muy distintos entre sí (negro pleno, verdes, beige con textura,
// crema, blancos) — por eso cada logo va en una tarjeta circular pareja en
// vez de puesto en fila sin tratamiento, y sin escala de grises: varios
// dependen del color para leerse.
const PROYECTOS: Proyecto[] = [
  { nombre: "Altia", archivo: "altia.jpg", instagram: "https://www.instagram.com/altia.limpiezadeobra/" },
  { nombre: "India Eventos", archivo: "india.jpg", instagram: "https://www.instagram.com/indiaeventoscordoba/" },
  { nombre: "CreArTé", archivo: "crearte.jpg", instagram: "https://www.instagram.com/crearte.decoo/" },
  { nombre: "Felicia Films", archivo: "felicia-films.jpg", instagram: "https://www.instagram.com/imfeliciafilms/" },
  { nombre: "Arcadia Park", archivo: "arcadia-park.jpg", instagram: "https://www.instagram.com/arcadiapark.cba/" },
  { nombre: "Leva", archivo: "leva.jpg", instagram: "https://www.instagram.com/leva.sde/" },
  // Falta el link de Instagram — se muestra sin enlace hasta tenerlo.
  { nombre: "Ser Refugio", archivo: "ser-refugio.jpg", instagram: null },
]

// Tarjetas chicas (110-130px desktop, ~90px mobile) y la tira triplicada:
// con 7 logos, una copia sola ya mide más que el contenedor (max-w 900px),
// así que nunca se alcanza a ver el mismo logo dos veces a la vez.
function TarjetaProyecto({ proyecto }: { proyecto: Proyecto }) {
  const contenido = (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--tierra)]/10 bg-white shadow-sm sm:h-[92px] sm:w-[92px]">
      <Image
        src={`/proyectos/${proyecto.archivo}`}
        alt={proyecto.nombre}
        width={92}
        height={92}
        className="h-full w-full object-cover"
      />
    </div>
  )

  return (
    <div className="flex w-[90px] shrink-0 flex-col items-center gap-2 px-1 sm:w-[130px]">
      {proyecto.instagram ? (
        <a
          href={proyecto.instagram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${proyecto.nombre} en Instagram`}
        >
          {contenido}
        </a>
      ) : (
        contenido
      )}
      <span className="text-center text-xs font-medium text-[var(--tierra)]/70">{proyecto.nombre}</span>
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
    <div className="mx-auto max-w-[900px] px-4">
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
