"use client"

import { useEffect, useMemo, useState } from "react"
import SeccionDesplegable from "@/components/SeccionDesplegable"
import type { HDRActividadPayload } from "@/lib/hdr"

type Props = {
  actividadSlug: string
  data: HDRActividadPayload
  onActualizado?: () => Promise<void> | void
}

type CrearState = {
  titulo: string
  descripcion: string
  orden: string
  activo: boolean
  alcance: "global" | "individual"
  participanteEmail: string
}

type DraftsEdicion = Record<
  string,
  {
    titulo: string
    descripcion: string
    descripcionHtml: string
    orden: string
    activo: boolean
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

function formatearFechaHora(fecha?: string | null) {
  if (!fecha) return ""
  const date = new Date(fecha)
  if (Number.isNaN(date.getTime())) return fecha
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function HDRAdminPanel({
  actividadSlug,
  data,
  onActualizado,
}: Props) {
  const [crear, setCrear] = useState<CrearState>({
    titulo: "",
    descripcion: "",
    orden: "0",
    activo: true,
    alcance: "global",
    participanteEmail: "",
  })
  const [drafts, setDrafts] = useState<DraftsEdicion>({})
  const [draftsRespuestas, setDraftsRespuestas] = useState<Record<string, string>>({})
  const [guardandoCrear, setGuardandoCrear] = useState(false)
  const [guardandoCoordenadaId, setGuardandoCoordenadaId] = useState<string | null>(null)
  const [eliminandoCoordenadaId, setEliminandoCoordenadaId] = useState<string | null>(null)
  const [guardandoRespuestaKey, setGuardandoRespuestaKey] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const nextDrafts: DraftsEdicion = {}

    for (const coordenada of data.coordenadas) {
      nextDrafts[coordenada.id] = {
        titulo: coordenada.titulo,
        descripcion: coordenada.descripcion,
        descripcionHtml: coordenada.descripcionHtml,
        orden: String(coordenada.orden ?? 0),
        activo: coordenada.activo,
      }
    }

    setDrafts(nextDrafts)
  }, [data.coordenadas])

  const participantesOrdenados = useMemo(() => {
    return [...data.participantes].sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [data.participantes])

  const crearCoordenada = async () => {
    try {
      setGuardandoCrear(true)
      setMensaje("")
      setError("")

      const res = await fetch("/api/hdr/coordenadas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividadSlug,
          titulo: crear.titulo,
          descripcion: crear.descripcion,
          descripcionHtml: crear.descripcion,
          orden: Number(crear.orden || 0),
          activo: crear.activo,
          alcance: crear.alcance,
          participanteEmail:
            crear.alcance === "individual" ? crear.participanteEmail : null,
        }),
      })

      const json = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setError(json.error || "No se pudo crear la coordenada.")
        return
      }

      setCrear({
        titulo: "",
        descripcion: "",
        orden: "0",
        activo: true,
        alcance: "global",
        participanteEmail: "",
      })
      setMensaje("Coordenada creada correctamente.")
      await onActualizado?.()
    } catch {
      setError("Hubo un problema al crear la coordenada.")
    } finally {
      setGuardandoCrear(false)
    }
  }

  const guardarCoordenada = async (coordenadaId: string) => {
    const draft = drafts[coordenadaId]
    if (!draft) return

    try {
      setGuardandoCoordenadaId(coordenadaId)
      setMensaje("")
      setError("")

      const res = await fetch("/api/hdr/coordenadas", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: coordenadaId,
          actividadSlug,
          titulo: draft.titulo,
          descripcion: draft.descripcion,
          descripcionHtml: draft.descripcionHtml || draft.descripcion,
          orden: Number(draft.orden || 0),
          activo: draft.activo,
        }),
      })

      const json = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setError(json.error || "No se pudo guardar la coordenada.")
        return
      }

      setMensaje("Coordenada actualizada correctamente.")
      await onActualizado?.()
    } catch {
      setError("Hubo un problema al actualizar la coordenada.")
    } finally {
      setGuardandoCoordenadaId(null)
    }
  }

  const guardarRespuestaParticipante = async (
    coordenadaId: string,
    participanteEmail: string
  ) => {
    const key = `${coordenadaId}:${participanteEmail}`
    const contenido = String(draftsRespuestas[key] || "").trim()

    try {
      setGuardandoRespuestaKey(key)
      setMensaje("")
      setError("")

      const res = await fetch("/api/hdr/respuestas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tipo: "respuesta",
          actividadSlug,
          coordenadaId,
          participanteEmail,
          respuesta: contenido,
        }),
      })

      const json = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setError(json.error || "No se pudo actualizar la respuesta.")
        return
      }

      setMensaje("Respuesta actualizada correctamente.")
      await onActualizado?.()
    } catch {
      setError("Hubo un problema al actualizar la respuesta.")
    } finally {
      setGuardandoRespuestaKey(null)
    }
  }

  const eliminarCoordenada = async (coordenadaId: string) => {
    const coordenada = data.coordenadas.find((item) => item.id === coordenadaId)
    const draft = drafts[coordenadaId]
    if (!coordenada || !draft) return

    const cantidadRespuestas = coordenada.respuestas.length
    const confirmar = window.confirm(
      cantidadRespuestas > 0
        ? `Esta coordenada tiene ${cantidadRespuestas} respuesta(s). No se borrarán datos: se desactivará y dejará de verse para participantes. ¿Querés continuar?`
        : "La coordenada se desactivará y dejará de verse para participantes. ¿Querés continuar?"
    )

    if (!confirmar) return

    try {
      setEliminandoCoordenadaId(coordenadaId)
      setMensaje("")
      setError("")

      const res = await fetch("/api/hdr/coordenadas", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: coordenadaId,
          actividadSlug,
          titulo: draft.titulo,
          descripcion: draft.descripcion,
          descripcionHtml: draft.descripcionHtml || draft.descripcion,
          orden: Number(draft.orden || 0),
          activo: false,
        }),
      })

      const json = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setError(json.error || "No se pudo eliminar la coordenada.")
        return
      }

      setMensaje("Coordenada eliminada correctamente.")
      await onActualizado?.()
    } catch {
      setError("Hubo un problema al eliminar la coordenada.")
    } finally {
      setEliminandoCoordenadaId(null)
    }
  }

  return (
    <div className="space-y-6">
      {mensaje && <div className="workspace-panel-soft text-green-700">{mensaje}</div>}
      {error && <div className="workspace-panel-soft text-red-700">{error}</div>}

      <div className="workspace-panel-soft space-y-5">
        <h3 className="text-lg font-semibold">Gestión de coordenadas</h3>

        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="workspace-field"
              placeholder="Título de la coordenada"
              value={crear.titulo}
              onChange={(e) =>
                setCrear((prev) => ({ ...prev, titulo: e.target.value }))
              }
            />
            <input
              className="workspace-field"
              placeholder="Orden"
              value={crear.orden}
              onChange={(e) =>
                setCrear((prev) => ({ ...prev, orden: e.target.value }))
              }
            />
            <select
              className="workspace-field"
              value={crear.alcance}
              onChange={(e) =>
                setCrear((prev) => ({
                  ...prev,
                  alcance: e.target.value as "global" | "individual",
                }))
              }
            >
              <option value="global">Global de actividad</option>
              <option value="individual">Individual de participante</option>
            </select>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={crear.activo}
                onChange={(e) =>
                  setCrear((prev) => ({ ...prev, activo: e.target.checked }))
                }
              />
              Coordenada activa
            </label>
          </div>

          {crear.alcance === "individual" && (
            <select
              className="workspace-field"
              value={crear.participanteEmail}
              onChange={(e) =>
                setCrear((prev) => ({ ...prev, participanteEmail: e.target.value }))
              }
            >
              <option value="">Seleccionar participante</option>
              {participantesOrdenados.map((participante) => (
                <option key={participante.email} value={participante.email}>
                  {participante.nombre} · {participante.email}
                </option>
              ))}
            </select>
          )}

          <textarea
            className="workspace-field min-h-[90px]"
            placeholder="Consigna / descripción"
            value={crear.descripcion}
            onChange={(e) =>
              setCrear((prev) => ({ ...prev, descripcion: e.target.value }))
            }
          />

          <button
            type="button"
            onClick={crearCoordenada}
            disabled={guardandoCrear}
            className="workspace-button-primary disabled:opacity-60"
          >
            {guardandoCrear ? "Creando..." : "Crear coordenada"}
          </button>
        </div>

        {data.coordenadas.length > 0 && (
          <div className="workspace-divider pt-5 space-y-3">
            <h4 className="font-semibold">Editar coordenadas</h4>

            {data.coordenadas.map((coordenada) => {
              const draft = drafts[coordenada.id] || {
                titulo: coordenada.titulo,
                descripcion: coordenada.descripcion,
                descripcionHtml: coordenada.descripcionHtml,
                orden: String(coordenada.orden || 0),
                activo: coordenada.activo,
              }

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
                        {draft.activo ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        className="workspace-field"
                        value={draft.titulo}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [coordenada.id]: {
                              ...draft,
                              titulo: e.target.value,
                            },
                          }))
                        }
                      />
                      <input
                        className="workspace-field"
                        value={draft.orden}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [coordenada.id]: {
                              ...draft,
                              orden: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>

                    <textarea
                      className="workspace-field min-h-[90px]"
                      value={draft.descripcion}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [coordenada.id]: {
                            ...draft,
                            descripcion: e.target.value,
                          },
                        }))
                      }
                    />

                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={draft.activo}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [coordenada.id]: {
                              ...draft,
                              activo: e.target.checked,
                            },
                          }))
                        }
                      />
                      Activa
                    </label>

                    <button
                      type="button"
                      onClick={() => guardarCoordenada(coordenada.id)}
                      disabled={guardandoCoordenadaId === coordenada.id}
                      className="workspace-button-secondary disabled:opacity-60"
                    >
                      {guardandoCoordenadaId === coordenada.id
                        ? "Guardando..."
                        : "Guardar cambios"}
                    </button>
                    {draft.activo && (
                      <button
                        type="button"
                        onClick={() => void eliminarCoordenada(coordenada.id)}
                        disabled={eliminandoCoordenadaId === coordenada.id}
                        className="workspace-button-secondary disabled:opacity-60"
                      >
                        {eliminandoCoordenadaId === coordenada.id
                          ? "Eliminando..."
                          : "Eliminar coordenada"}
                      </button>
                    )}
                  </div>
                </SeccionDesplegable>
              )
            })}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Coordenadas en elaboración</h3>

        {data.coordenadas.filter((coordenada) => coordenada.activo).length === 0 && (
          <div className="workspace-panel-soft">
            <p className="workspace-inline-note">
              Todavía no hay coordenadas cargadas para esta actividad.
            </p>
          </div>
        )}

        {data.coordenadas.filter((coordenada) => coordenada.activo).map((coordenada) => {
          const participantes =
            coordenada.alcance === "individual" && coordenada.participanteEmail
              ? participantesOrdenados.filter(
                  (participante) =>
                    participante.email === coordenada.participanteEmail
                )
              : participantesOrdenados

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
                    {coordenada.activo ? "Activa" : "Inactiva"}
                  </span>
                </div>
              }
            >
              <div className="space-y-4">
                {participantes.length === 0 && (
                  <p className="workspace-inline-note">
                    No hay participantes vinculados a esta coordenada.
                  </p>
                )}

                {participantes.map((participante) => {
                  const respuesta = coordenada.respuestas.find(
                    (item) => item.participanteEmail === participante.email
                  )
                  const key = `${coordenada.id}:${participante.email}`
                  const valorRespuesta =
                    draftsRespuestas[key] !== undefined
                      ? draftsRespuestas[key]
                      : respuesta?.respuesta || ""

                  return (
                    <div
                      key={participante.email}
                      className="workspace-card-link !rounded-[1.25rem] !p-4 space-y-3"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{participante.nombre}</p>
                        <p className="workspace-inline-note text-xs">
                          {respuesta
                            ? `Actualizado: ${formatearFechaHora(
                                respuesta.updatedAt || respuesta.createdAt
                              )}`
                            : "Sin respuesta todavía."}
                        </p>
                      </div>

                      <textarea
                        className="workspace-field min-h-[120px]"
                        value={valorRespuesta}
                        onChange={(e) =>
                          setDraftsRespuestas((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        placeholder="Respuesta del participante"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          guardarRespuestaParticipante(
                            coordenada.id,
                            participante.email
                          )
                        }
                        disabled={guardandoRespuestaKey === key}
                        className="workspace-button-secondary disabled:opacity-60"
                      >
                        {guardandoRespuestaKey === key
                          ? "Guardando..."
                          : "Guardar intervención"}
                      </button>
                    </div>
                  )
                })}
              </div>
            </SeccionDesplegable>
          )
        })}
      </div>
    </div>
  )
}
