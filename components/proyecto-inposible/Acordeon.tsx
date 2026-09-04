"use client"

import { useId, useState } from "react"

type Pregunta = { pregunta: string; respuesta: string }

// Una abierta a la vez, todas cerradas al cargar. Mismo criterio de
// accesibilidad que TarjetaColapsable: botón real con aria-expanded, el
// texto de la respuesta siempre en el HTML (oculto con max-height, nunca
// desmontado).
export default function Acordeon({ preguntas }: { preguntas: Pregunta[] }) {
  const [abiertoIndex, setAbiertoIndex] = useState<number | null>(null)
  const baseId = useId()

  return (
    <div className="divide-y divide-[var(--tinta)]/10 overflow-hidden rounded-3xl bg-[var(--nube)] shadow-[0_18px_40px_rgba(36,31,28,0.06)]">
      {preguntas.map((p, i) => {
        const abierto = abiertoIndex === i
        const idRespuesta = `${baseId}-respuesta-${i}`
        return (
          <div key={p.pregunta} className="px-6 sm:px-8">
            <h3>
              <button
                type="button"
                aria-expanded={abierto}
                aria-controls={idRespuesta}
                onClick={() => setAbiertoIndex(abierto ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-5 text-left text-lg font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--naranja)]"
              >
                {p.pregunta}
                <span aria-hidden className="shrink-0 text-2xl font-normal text-[var(--naranja)]">
                  {abierto ? "−" : "+"}
                </span>
              </button>
            </h3>
            <div
              id={idRespuesta}
              className="overflow-hidden transition-[max-height] duration-300 ease-out motion-reduce:transition-none"
              style={{ maxHeight: abierto ? 420 : 0 }}
            >
              <p className="max-w-[680px] pb-6 text-[18px] leading-[1.65] opacity-85 sm:text-[19px]">{p.respuesta}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
