"use client"

import { useState } from "react"

// Buscador con IA sobre los datos propios de Entusiasmento (Coordenadas,
// Tareas, Producciones, Aportes recibidos) — nunca inventa, siempre cita.
// Ver app/api/entusiasmo/buscar/route.ts.

type TipoCita = "coordenada" | "tarea" | "produccion" | "aporte"

type Cita = {
  tipo: TipoCita
  id: number | null
  campo: string | null
  etiqueta: string
  fragmento: string
}

type Props = {
  // Si se pasa (admin viendo la solapa de otro participante), busca en los
  // datos de esa persona en vez de los propios — mismo patrón que el resto
  // de los componentes de Entusiasmento.
  participanteEmail?: string | null
}

const ICONO_POR_TIPO: Record<TipoCita, string> = {
  coordenada: "🧭",
  tarea: "✓",
  produccion: "🎨",
  aporte: "💬",
}

export default function Buscador({ participanteEmail }: Props) {
  const [pregunta, setPregunta] = useState("")
  const [buscando, setBuscando] = useState(false)
  const [respuesta, setRespuesta] = useState<string | null>(null)
  const [citas, setCitas] = useState<Cita[]>([])
  const [mensajeError, setMensajeError] = useState("")

  const buscar = async () => {
    const preguntaLimpia = pregunta.trim()
    if (!preguntaLimpia || buscando) return

    try {
      setBuscando(true)
      setMensajeError("")

      const res = await fetch("/api/entusiasmo/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pregunta: preguntaLimpia,
          participanteEmail: participanteEmail || undefined,
        }),
      })

      const raw = await res.text()
      const data = raw ? JSON.parse(raw) : {}

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo buscar.")
        setRespuesta(null)
        setCitas([])
        return
      }

      setRespuesta(data.respuesta || "")
      setCitas(Array.isArray(data.citas) ? data.citas : [])
    } catch {
      setMensajeError("Error buscando.")
      setRespuesta(null)
      setCitas([])
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="space-y-3 rounded-[1.75rem] border-2 border-teal-200 bg-teal-50/50 p-4">
      <div className="space-y-1">
        <p className="workspace-eyebrow text-teal-600">🔍 Buscar en lo tuyo</p>
        <h3 className="text-lg font-bold tracking-tight text-teal-900">
          Preguntale a tu espacio
        </h3>
        <p className="workspace-inline-note">
          Busca solo en tus Coordenadas, Tareas, Producciones y aportes que
          recibiste — nunca opina ni decide por vos.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void buscar()
          }}
          placeholder="Ej: ¿Qué tareas tengo pendientes?"
          className="workspace-field flex-1"
        />
        <button
          type="button"
          disabled={buscando || !pregunta.trim()}
          onClick={() => void buscar()}
          className="workspace-button-secondary disabled:opacity-60"
        >
          {buscando ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {mensajeError && <p className="text-sm text-red-600">{mensajeError}</p>}

      {respuesta && (
        <div className="space-y-3 rounded-xl border border-teal-200 bg-white/80 p-3">
          <p className="text-sm leading-6 text-gray-700">{respuesta}</p>

          {citas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {citas.map((cita, indice) => (
                <div
                  key={`${cita.tipo}-${cita.id ?? cita.campo}-${indice}`}
                  className="max-w-xs space-y-1 rounded-lg border border-teal-200 bg-teal-50/60 px-3 py-2 text-xs"
                >
                  <p className="font-semibold text-teal-800">
                    {ICONO_POR_TIPO[cita.tipo]} {cita.etiqueta}
                  </p>
                  <p className="italic text-gray-600">&ldquo;{cita.fragmento}&rdquo;</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
