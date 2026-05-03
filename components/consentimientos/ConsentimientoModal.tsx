"use client"

import Link from "next/link"
import type { ConsentimientoActividadSlug } from "@/lib/consentimientos"
import { getConsentimientoTexto } from "@/lib/consentimientos"

type Props = {
  actividad: ConsentimientoActividadSlug
  fechaEncuentro?: string | null
  horaEncuentro?: string | null
  guardando: boolean
  onAceptar: () => void
  onCancelar: () => void
  aceptarLabel?: string
  cancelarLabel?: string
}

export default function ConsentimientoModal({
  actividad,
  fechaEncuentro,
  horaEncuentro,
  guardando,
  onAceptar,
  onCancelar,
  aceptarLabel = "Aceptar",
  cancelarLabel = "Cancelar",
}: Props) {
  const texto = getConsentimientoTexto(actividad, {
    fecha: fechaEncuentro,
    hora: horaEncuentro,
  })

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px]">
      <div className="flex min-h-full items-start justify-center py-2 sm:items-center">
        <div className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl [max-height:calc(100dvh-2rem)]">
          <div className="shrink-0 px-6 pt-6 sm:px-7 sm:pt-7">
            <p className="text-sm font-medium text-gray-500">
              Consentimiento obligatorio
            </p>
            <h2 className="text-2xl font-semibold text-gray-900">
              Consentimiento de participación
            </h2>
            {texto.fechaHora && (
              <p className="mt-2 text-sm text-gray-600">{texto.fechaHora}</p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-4 text-sm leading-6 text-gray-800 sm:px-7 sm:pb-5 sm:pt-5">
            <div className="space-y-4 pr-2 touch-pan-y">
              {texto.parrafos.map((item) => (
                <p key={item}>{item}</p>
              ))}

              {texto.textosAdicionales.map((item) => (
                <p key={item} className="font-medium text-gray-900">
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-6 pb-6 pt-4 sm:px-7 sm:pb-7 sm:pt-5">
            <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
              <p>
                Antes de continuar, podés revisar los{" "}
                <Link
                  href="/terminos-y-condiciones"
                  target="_blank"
                  className="font-medium underline underline-offset-2"
                >
                  Términos y Condiciones
                </Link>
                .
              </p>
            </div>

            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onCancelar}
                disabled={guardando}
                className="rounded-2xl border px-5 py-3 text-gray-700 disabled:opacity-60"
              >
                {cancelarLabel}
              </button>

              <button
                type="button"
                onClick={onAceptar}
                disabled={guardando}
                className="rounded-2xl bg-black px-5 py-3 text-white disabled:opacity-60"
              >
                {guardando ? "Guardando..." : aceptarLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
