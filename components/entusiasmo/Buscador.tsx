"use client"

import { useState, type ComponentType } from "react"
import {
  IconoBrujula,
  IconoComentario,
  IconoDestello,
  IconoMaceta,
} from "@/components/app/iconos"

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

// "tarea" usa el mismo destello que ya representa a "Destello de la
// semana" en el resto de Entusiasmento, y "producción" usa el mismo
// ícono que "Mi espacio" (de donde salen las producciones) — la familia
// de components/app/iconos.tsx no tiene un dibujo propio para cada una
// de las 4 categorías, así que se reutilizan los que ya existen.
const ICONO_POR_TIPO: Record<TipoCita, ComponentType<{ className?: string }>> = {
  coordenada: IconoBrujula,
  tarea: IconoDestello,
  produccion: IconoMaceta,
  aporte: IconoComentario,
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
              {citas.map((cita, indice) => {
                const Icono = ICONO_POR_TIPO[cita.tipo]
                return (
                  <div
                    key={`${cita.tipo}-${cita.id ?? cita.campo}-${indice}`}
                    className="max-w-xs space-y-1 rounded-lg border border-teal-200 bg-teal-50/60 px-3 py-2 text-xs"
                  >
                    <p className="inline-flex items-center gap-1 font-semibold text-teal-800">
                      <Icono className="h-3 w-3 shrink-0" /> {cita.etiqueta}
                    </p>
                    <p className="italic text-gray-600">&ldquo;{cita.fragmento}&rdquo;</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
