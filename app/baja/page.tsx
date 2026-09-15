import type { Metadata } from "next"
import Link from "next/link"
import FormularioArrepentimientoBaja from "@/components/legales/FormularioArrepentimientoBaja"

// Botón de Baja de servicio (Disposición 954/2025) — misma mecánica que
// /arrepentimiento, pública y sin sesión. Server Component; el formulario
// en sí es "use client" (components/legales/FormularioArrepentimientoBaja).
export const metadata: Metadata = {
  title: "Baja de servicio — ENTHEOS",
}

export default function BajaPage() {
  return (
    <main className="p-6 sm:p-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">Baja de servicio</h1>
          <p className="text-gray-700">Acá podés pedir la baja de una actividad de ENTHEOS.</p>
          <p className="text-gray-700">
            Si contrataste hace menos de 10 días, lo que te corresponde es el{" "}
            <Link href="/arrepentimiento" className="underline">
              Botón de Arrepentimiento
            </Link>
            , que además te devuelve lo que pagaste.
          </p>
          <p className="text-gray-700">
            Si querés que borremos también tu cuenta y lo que produjiste, decilo en el motivo y lo hacemos en el
            mismo trámite.
          </p>
        </div>

        <FormularioArrepentimientoBaja tipo="baja" />
      </div>
    </main>
  )
}
