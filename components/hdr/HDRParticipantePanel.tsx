"use client"

import { useEffect, useMemo, useState } from "react"
import SeccionDesplegable from "@/components/SeccionDesplegable"
import type { HDRActividadPayload } from "@/lib/hdr"

type Props = {
  actividadSlug: string
  actorEmail: string
  data: HDRActividadPayload
  onGuardado?: () => Promise<void> | void
}

type DraftMap = Record<
  string,
  {
    respuesta: string
  }
>

async function leerJson<T>(res: Response): Promise<T> {
  const raw = await res.text()
  if (!raw) return {} as T

  try {
    return JSON.parse(raw) as T
  } catch {
    return {
      error: `Respuesta no válida del servidor: ${raw}`,
    } as T
  }
}

export default function HDRParticipantePanel({
  actividadSlug,
  actorEmail,
  data,
  onGuardado,
}: Props) {
  const [drafts, setDrafts] = useState<DraftMap>({})
  const [guardandoId, setGuardandoId] = useState<string | null>(null)
  const [notasGenerales, setNotasGenerales] = useState("")
  const [guardandoNotasGenerales, setGuardandoNotasGenerales] = useState(false)
  const [mensaje, setMensaje] = useState("")
  const [error, setError] = useState("")

  const coordenadasVisibles = useMemo(() => {
    return data.coordenadas.filter((coordenada) => coordenada.activo)
  }, [data.coordenadas])

  useEffect(() => {
    const nextDrafts: DraftMap = {}

    for (const coordenada of coordenadasVisibles) {
      const propia = coordenada.respuestas.find(
        (respuesta) => respuesta.participanteEmail === actorEmail
      )

      nextDrafts[coordenada.id] = {
        respuesta: propia?.respuesta || "",
      }
    }

    setDrafts(nextDrafts)
  }, [actorEmail, coordenadasVisibles])

  useEffect(() => {
    const notaPropia = data.notasPersonalesGenerales.find(
      (nota) => nota.participanteEmail === actorEmail
    )
    setNotasGenerales(notaPropia?.contenido || "")
  }, [actorEmail, data.notasPersonalesGenerales])

  const guardar = async (coordenadaId: string) => {
    const draft = drafts[coordenadaId]

    try {
      setGuardandoId(coordenadaId)
      setMensaje("")
      setError("")

      const res = await fetch("/api/hdr/respuestas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividadSlug,
          coordenadaId,
          respuesta: draft?.respuesta || "",
        }),
      })

      const json = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setError(json.error || "No se pudo guardar la coordenada.")
        return
      }

      setMensaje("Hoja de Ruta guardada correctamente.")
      await onGuardado?.()
    } catch {
      setError("Hubo un problema al guardar la Hoja de Ruta.")
    } finally {
      setGuardandoId(null)
    }
  }

  const guardarNotasGenerales = async () => {
    try {
      setGuardandoNotasGenerales(true)
      setMensaje("")
      setError("")

      const res = await fetch("/api/hdr/respuestas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tipo: "notas_generales",
          actividadSlug,
          contenido: notasGenerales,
        }),
      })

      const json = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setError(json.error || "No se pudieron guardar las notas personales.")
        return
      }

      setMensaje("Hoja de Ruta guardada correctamente.")
      await onGuardado?.()
    } catch {
      setError("Hubo un problema al guardar las notas personales.")
    } finally {
      setGuardandoNotasGenerales(false)
    }
  }

  return (
    <div className="space-y-5">
      {mensaje && <div className="workspace-panel-soft text-green-700">{mensaje}</div>}
      {error && <div className="workspace-panel-soft text-red-700">{error}</div>}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Coordenadas en elaboración</h3>

        {coordenadasVisibles.length === 0 && (
          <div className="workspace-panel-soft">
            <p className="workspace-inline-note">
              Todavía no hay coordenadas activas en tu Hoja de Ruta.
            </p>
          </div>
        )}

        {coordenadasVisibles.map((coordenada) => {
          const draft = drafts[coordenada.id] || {
            respuesta: "",
          }
          const respuestaGuardada = draft.respuesta.trim().length > 0

          return (
            <SeccionDesplegable
              key={coordenada.id}
              abiertaPorDefecto={false}
              titulo={
                <div className="flex items-center gap-2 flex-wrap">
                  <span>{coordenada.titulo}</span>
                  <span className="workspace-chip">
                    {coordenada.alcance === "global" ? "Global" : "Individual"}
                  </span>
                  <span className="workspace-inline-note text-xs">
                    {respuestaGuardada ? "Guardado" : "Pendiente"}
                  </span>
                </div>
              }
            >
              <div className="space-y-4">
                {coordenada.descripcion && (
                  <p className="workspace-inline-note text-[var(--foreground)] whitespace-pre-wrap">
                    {coordenada.descripcion}
                  </p>
                )}

                <div className="space-y-3">
                  <label className="block text-sm font-medium">Respuesta principal</label>
                  <textarea
                    className="workspace-field min-h-[140px]"
                    value={draft.respuesta}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [coordenada.id]: {
                          respuesta: e.target.value,
                        },
                      }))
                    }
                    placeholder="Escribí aquí tu desarrollo principal."
                  />
                </div>

                <button
                  type="button"
                  onClick={() => guardar(coordenada.id)}
                  disabled={guardandoId === coordenada.id}
                  className="workspace-button-primary disabled:opacity-60"
                >
                  {guardandoId === coordenada.id ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </SeccionDesplegable>
          )
        })}
      </div>

      <div className="workspace-panel-soft space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-lg font-semibold">Notas generales</h3>
          <span className="workspace-chip">General</span>
        </div>
        <textarea
          className="workspace-field min-h-[140px]"
          value={notasGenerales}
          onChange={(e) => setNotasGenerales(e.target.value)}
          placeholder="Escribí aquí tus notas personales de esta actividad."
        />
        <button
          type="button"
          onClick={guardarNotasGenerales}
          disabled={guardandoNotasGenerales}
          className="workspace-button-primary disabled:opacity-60"
        >
          {guardandoNotasGenerales ? "Guardando..." : "Guardar notas generales"}
        </button>
      </div>
    </div>
  )
}
