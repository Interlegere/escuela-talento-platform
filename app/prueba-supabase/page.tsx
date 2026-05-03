"use client"

import { useEffect, useState } from "react"
import { isInternalDebugToolsEnabled } from "@/lib/dev-flags"

type RespuestaDiagnostico = {
  ok?: boolean
  error?: string
  detalle?: string
  urlUsada?: string
  filas?: unknown[]
}

export default function PruebaSupabasePage() {
  const debugHabilitado = isInternalDebugToolsEnabled()
  const [resultado, setResultado] = useState("Probando conexión...")
  const [respuestaCompleta, setRespuestaCompleta] =
    useState<RespuestaDiagnostico | null>(null)

  useEffect(() => {
    if (!debugHabilitado) {
      return
    }

    const probar = async () => {
      try {
        const res = await fetch("/api/prueba-supabase")
        const data = (await res.json()) as RespuestaDiagnostico

        setRespuestaCompleta(data)

        if (data.ok) {
          setResultado("Conexión OK desde el servidor")
        } else {
          setResultado(`ERROR: ${data.error}`)
        }
      } catch (error: unknown) {
        setResultado(
          `ERROR JS: ${error instanceof Error ? error.message : "desconocido"}`
        )
      }
    }

    probar()
  }, [debugHabilitado])

  if (!debugHabilitado) {
    return (
      <main className="p-10 space-y-6">
        <h1 className="text-3xl font-bold">Prueba Supabase</h1>
        <div className="border p-4 rounded">
          <p>La herramienta interna de diagnóstico está deshabilitada.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="p-10 space-y-6">
      <h1 className="text-3xl font-bold">Prueba Supabase</h1>

      <div className="border p-4 rounded">
        <p>{resultado}</p>
      </div>

      <div className="border p-4 rounded">
        <h2 className="font-semibold mb-2">Respuesta completa</h2>
        <pre className="whitespace-pre-wrap text-sm">
          {JSON.stringify(respuestaCompleta, null, 2)}
        </pre>
      </div>
    </main>
  )
}
