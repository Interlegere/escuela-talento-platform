import Image from "next/image"
import type { Testimonio } from "@/lib/proyecto-inposible-assets"

// Si no hay testimonios todavía, la sección no se renderiza — nada de
// placeholders ni "próximamente" (el llamador ya chequea el largo antes de
// montar la SeccionAnimada entera, pero se repite acá por las dudas).
//
// La foto es la cara de la persona (56×56, alt = su nombre) y el logo del
// proyecto es un elemento chico aparte, al lado del nombre del proyecto —
// nunca ocupa el lugar de la foto. Un testimonio puede no tener ninguna de
// las dos (Florencia) y está bien: no todo tiene que ser simétrico.
export default function Testimonios({ testimonios }: { testimonios: Testimonio[] }) {
  if (testimonios.length === 0) return null

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {testimonios.map((t) => (
        <div
          key={t.nombre}
          className="rounded-3xl border-t-[3px] border-[var(--dorado)] bg-[var(--nube)] p-6 shadow-[0_18px_40px_rgba(36,31,28,0.06)] sm:p-7"
        >
          {t.video ? (
            <video controls poster={t.foto} className="mb-4 w-full rounded-2xl" src={t.video} />
          ) : (
            <p className="text-[17px] leading-[1.6] opacity-85">&ldquo;{t.texto}&rdquo;</p>
          )}
          <div className="mt-4 flex items-center gap-3">
            {t.foto && (
              <div className="h-[56px] w-[56px] shrink-0 overflow-hidden rounded-full bg-white">
                <Image src={t.foto} alt={t.nombre} width={112} height={112} className="h-full w-full object-cover" />
              </div>
            )}
            <div>
              <p className="font-bold">{t.nombre}</p>
              {t.proyecto && (
                <div className="mt-0.5 flex items-center gap-1.5">
                  {t.logoProyecto && (
                    <div className="h-4 w-4 shrink-0 overflow-hidden rounded-full">
                      <Image src={t.logoProyecto} alt={t.proyecto} width={32} height={32} className="h-full w-full object-cover" />
                    </div>
                  )}
                  {t.instagram ? (
                    <a
                      href={t.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--tinta)] underline decoration-1 decoration-[var(--dorado)] underline-offset-2 hover:opacity-70"
                    >
                      {t.proyecto}
                    </a>
                  ) : (
                    <p className="text-sm opacity-70">{t.proyecto}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
