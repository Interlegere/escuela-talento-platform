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

function TarjetaProyecto({ proyecto }: { proyecto: Proyecto }) {
  const contenido = (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--line)] bg-white shadow-sm sm:h-28 sm:w-28">
      <Image
        src={`/proyectos/${proyecto.archivo}`}
        alt={proyecto.nombre}
        width={112}
        height={112}
        className="h-full w-full object-cover"
      />
    </div>
  )

  return (
    <div className="flex shrink-0 flex-col items-center gap-2 px-3">
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
      <span className="text-xs font-medium text-gray-600">{proyecto.nombre}</span>
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
        track.scrollLeft += 0.6
        if (track.scrollLeft >= track.scrollWidth / 2) {
          track.scrollLeft = 0
        }
      }
      frame = requestAnimationFrame(paso)
    }
    frame = requestAnimationFrame(paso)

    return () => cancelAnimationFrame(frame)
  }, [])

  // Duplicado para que el loop se sienta continuo, no un salto brusco.
  const proyectosDuplicados = [...PROYECTOS, ...PROYECTOS]

  return (
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
      {proyectosDuplicados.map((proyecto, indice) => (
        <TarjetaProyecto key={`${proyecto.nombre}-${indice}`} proyecto={proyecto} />
      ))}
    </div>
  )
}
