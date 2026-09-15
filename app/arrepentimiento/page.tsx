import type { Metadata } from "next"
import FormularioArrepentimientoBaja from "@/components/legales/FormularioArrepentimientoBaja"

// Botón de Arrepentimiento (Disposición 954/2025) — pública, sin sesión,
// sin registro previo ni pasos adicionales, con acceso directo desde la
// página de inicio (link en los dos pies de página). El componente del
// formulario es "use client"; esta página en sí queda como Server
// Component, igual que /proyecto-inposible/listo.
export const metadata: Metadata = {
  title: "Botón de Arrepentimiento — ENTHEOS",
}

export default function ArrepentimientoPage() {
  return (
    <main className="p-6 sm:p-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">Botón de Arrepentimiento</h1>
          <p className="text-gray-700">
            Si contrataste una actividad de ENTHEOS por internet, podés arrepentirte dentro de los{" "}
            <strong>10 días corridos</strong> desde que la contrataste o desde que empezó, lo que haya pasado
            último. Se te devuelve todo lo que pagaste, sin costo.
          </p>
          <p className="text-gray-700">Completá esto y listo. No hace falta que expliques nada.</p>
        </div>

        <FormularioArrepentimientoBaja tipo="arrepentimiento" />
      </div>
    </main>
  )
}
