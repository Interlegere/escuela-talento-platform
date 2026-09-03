"use client"

import { useEffect, useState } from "react"

// Solo lectura de lo que lib/agente-entusiasmo.ts ya generó y mandó por
// mail en su corrida diaria (entusiasmo_agente_mensajes) — este componente
// no genera nada nuevo, solo lo trae a la app.

type MensajeAgente = {
  id: number
  fecha: string
  texto_generado: string | null
  valoracion: string | null
}

type Props = {
  // Si se pasa (admin viendo la solapa de otro participante), trae los
  // mensajes de esa persona en modo lectura, sin el control de "¿Te
  // sirvió?" — ese control es solo para la propia persona que los recibió.
  participanteEmail?: string | null
}

function formatearFechaMensaje(fecha: string) {
  const d = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(d.getTime())) return fecha

  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default function MensajesAgente({ participanteEmail }: Props) {
  const [mensajes, setMensajes] = useState<MensajeAgente[]>([])
  const [cargando, setCargando] = useState(true)
  const [anterioresAbiertos, setAnterioresAbiertos] = useState(false)
  const [guardandoId, setGuardandoId] = useState<number | null>(null)
  const [mensajeError, setMensajeError] = useState("")

  useEffect(() => {
    let cancelado = false

    const cargar = async () => {
      try {
        setCargando(true)
        const query = participanteEmail
          ? `?email=${encodeURIComponent(participanteEmail)}`
          : ""
        const res = await fetch(`/api/entusiasmo/agente/mensajes${query}`)
        const raw = await res.text()
        const data = raw ? JSON.parse(raw) : {}

        if (!res.ok || cancelado) return

        setMensajes((data.mensajes as MensajeAgente[]) || [])
      } catch {
        if (!cancelado) setMensajes([])
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    void cargar()

    return () => {
      cancelado = true
    }
  }, [participanteEmail])

  const calificar = async (id: number, valor: "util" | "no_util") => {
    const actual = mensajes.find((m) => m.id === id)
    const nuevaValoracion = actual?.valoracion === valor ? null : valor

    try {
      setGuardandoId(id)
      setMensajeError("")

      const res = await fetch("/api/entusiasmo/agente/mensajes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, valoracion: nuevaValoracion }),
      })

      if (!res.ok) {
        setMensajeError("No se pudo guardar tu respuesta.")
        return
      }

      setMensajes((prev) =>
        prev.map((m) => (m.id === id ? { ...m, valoracion: nuevaValoracion } : m))
      )
    } catch {
      setMensajeError("Error guardando tu respuesta.")
    } finally {
      setGuardandoId(null)
    }
  }

  if (cargando || mensajes.length === 0) return null

  const [masReciente, ...anteriores] = mensajes

  const renderizarMensaje = (mensaje: MensajeAgente) => (
    <div key={mensaje.id} className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-500">
        {formatearFechaMensaje(mensaje.fecha)}
      </p>
      <p className="text-sm leading-6 text-gray-700">{mensaje.texto_generado}</p>

      {!participanteEmail && (
        <div className="flex items-center gap-2 pt-1 text-xs text-gray-500">
          <span>¿Te sirvió?</span>
          <button
            type="button"
            disabled={guardandoId === mensaje.id}
            onClick={() => void calificar(mensaje.id, "util")}
            aria-label="Sí, me sirvió"
            className={`rounded-full border px-2 py-1 transition ${
              mensaje.valoracion === "util"
                ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                : "border-gray-200 text-gray-400 hover:text-gray-600"
            }`}
          >
            👍
          </button>
          <button
            type="button"
            disabled={guardandoId === mensaje.id}
            onClick={() => void calificar(mensaje.id, "no_util")}
            aria-label="No me sirvió"
            className={`rounded-full border px-2 py-1 transition ${
              mensaje.valoracion === "no_util"
                ? "border-rose-400 bg-rose-50 text-rose-700"
                : "border-gray-200 text-gray-400 hover:text-gray-600"
            }`}
          >
            👎
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-3 rounded-[1.75rem] border-2 border-indigo-200 bg-indigo-50/50 p-4">
      <div className="space-y-1">
        <p className="workspace-eyebrow text-indigo-500">📨 Mensajes del agente</p>
        <h3 className="text-lg font-bold tracking-tight text-indigo-900">
          Lo que te fue mandando por mail
        </h3>
      </div>

      <div className="rounded-xl border border-indigo-200 bg-white/80 p-3">
        {renderizarMensaje(masReciente)}
      </div>

      {mensajeError && <p className="text-xs text-red-600">{mensajeError}</p>}

      {anteriores.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setAnterioresAbiertos((v) => !v)}
            className="text-xs text-indigo-700 underline"
          >
            {anterioresAbiertos ? "Ocultar" : "Ver"} anteriores ({anteriores.length})
          </button>

          {anterioresAbiertos && (
            <div className="space-y-3">
              {anteriores.map((mensaje) => (
                <div
                  key={mensaje.id}
                  className="rounded-xl border border-indigo-100 bg-white/60 p-3"
                >
                  {renderizarMensaje(mensaje)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
