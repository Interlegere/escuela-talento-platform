import Image from "next/image"
import { PROYECTOS } from "@/lib/proyecto-inposible-proyectos"

// Prueba tranquila dentro del hero: chicos, estáticos, sin nombres, sin
// carrusel. El carrusel grande con nombres sigue viviendo en la sección
// "Proyectos que pasaron por acá", más abajo.
//
// En mobile los 7 no entran en una fila incluso a 52px, así que en vez de
// envolver disparejo (6+1, con uno solo en la segunda fila) van en una sola
// fila con scroll horizontal — más prolijo que forzar un 4+3. En desktop sí
// entran todos y quedan centrados, sin scroll.
export default function TiraLogos() {
  return (
    <div className="mt-10 w-full max-w-2xl border-t border-[var(--crema)]/25 pt-6">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-[var(--crema)]/70">
        Proyectos que empezaron acá
      </p>
      <div className="mt-4 flex items-center gap-3 overflow-x-auto px-4 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
        {PROYECTOS.map((p) => (
          <div
            key={p.nombre}
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white sm:h-16 sm:w-16"
          >
            <Image
              src={`/proyectos/${p.archivo}`}
              alt={p.nombre}
              width={64}
              height={64}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
