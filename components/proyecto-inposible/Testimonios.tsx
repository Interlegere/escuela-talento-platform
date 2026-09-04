import Image from "next/image"
import type { Testimonio } from "@/lib/proyecto-inposible-assets"

// Si no hay testimonios todavía, la sección no se renderiza — nada de
// placeholders ni "próximamente" (el llamador ya chequea el largo antes de
// montar la SeccionAnimada entera, pero se repite acá por las dudas).
export default function Testimonios({ testimonios }: { testimonios: Testimonio[] }) {
  if (testimonios.length === 0) return null

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {testimonios.map((t) => (
        <div key={t.nombre} className="rounded-3xl bg-[var(--nube)] p-6 shadow-[0_18px_40px_rgba(36,31,28,0.06)] sm:p-7">
          {t.video ? (
            <video controls poster={t.foto} className="mb-4 w-full rounded-2xl" src={t.video} />
          ) : (
            <p className="text-[17px] leading-[1.6] opacity-85">&ldquo;{t.texto}&rdquo;</p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full">
              <Image src={t.foto} alt={t.nombre} width={144} height={144} className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="font-bold">{t.nombre}</p>
              <a
                href={t.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--tinta)] underline decoration-1 decoration-[var(--dorado)] underline-offset-2 hover:opacity-70"
              >
                {t.proyecto}
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
