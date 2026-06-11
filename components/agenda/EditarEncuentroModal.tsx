"use client"

import { useEffect, useMemo, useState } from "react"
import {
  normalizarDocumentosNotas,
  parsearDocumentosNotasDesdeTexto,
  serializarDocumentosNotas,
  type DocumentoNota,
} from "@/lib/documentos-notas"
import { normalizarMeetLink } from "@/lib/meet-links"

export type EditarEncuentroModalItem = {
  disponibilidadId?: number | null
  titulo: string
  fecha: string
  hora: string
  duracion: string
  meetLink?: string | null
  notasDocumentos?: DocumentoNota[]
  serieId?: string | null
}

type Props = {
  item: EditarEncuentroModalItem | null
  open: boolean
  onClose: () => void
  onSaved?: (message: string) => Promise<void> | void
}

type AlcanceEdicion = "solo_este" | "serie_futura"

function mismaListaDocumentos(a: unknown, b: unknown) {
  return (
    JSON.stringify(normalizarDocumentosNotas(a)) ===
    JSON.stringify(normalizarDocumentosNotas(b))
  )
}

export default function EditarEncuentroModal({
  item,
  open,
  onClose,
  onSaved,
}: Props) {
  const [titulo, setTitulo] = useState("")
  const [fecha, setFecha] = useState("")
  const [hora, setHora] = useState("")
  const [duracion, setDuracion] = useState("")
  const [meetManual, setMeetManual] = useState("")
  const [notasTexto, setNotasTexto] = useState("")
  const [alcance, setAlcance] = useState<AlcanceEdicion>("solo_este")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!item || !open) {
      return
    }

    setTitulo(item.titulo || "")
    setFecha(item.fecha || "")
    setHora(item.hora || "")
    setDuracion(item.duracion || "")
    setMeetManual(item.meetLink || "")
    setNotasTexto(serializarDocumentosNotas(item.notasDocumentos))
    setAlcance("solo_este")
    setError("")
    setGuardando(false)
  }, [item, open])

  const tieneSerie = Boolean(item?.serieId)
  const meetActualNormalizado = useMemo(
    () => normalizarMeetLink(item?.meetLink || null),
    [item?.meetLink]
  )

  if (!open || !item?.disponibilidadId) {
    return null
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const tituloTrim = titulo.trim()
    const fechaTrim = fecha.trim()
    const horaTrim = hora.trim()
    const duracionTrim = duracion.trim()
    const meetManualTrim = meetManual.trim()
    const notasParseadas = parsearDocumentosNotasDesdeTexto(notasTexto)
    const notasIniciales = item.notasDocumentos || []

    if (!tituloTrim || !fechaTrim || !horaTrim || !duracionTrim) {
      setError("Completá título, fecha, hora y duración.")
      return
    }

    const meetManualNormalizado = meetManualTrim
      ? normalizarMeetLink(meetManualTrim)
      : null

    if (meetManualTrim && !meetManualNormalizado) {
      setError("Pegá un Meet real. No se acepta https://meet.google.com/new.")
      return
    }

    const cambioEncuentro =
      tituloTrim !== item.titulo ||
      fechaTrim !== item.fecha ||
      horaTrim !== item.hora ||
      duracionTrim !== item.duracion
    const cambioMeetManual =
      Boolean(meetManualNormalizado) &&
      meetManualNormalizado !== meetActualNormalizado
    const cambioNotas = !mismaListaDocumentos(notasParseadas, notasIniciales)

    if (!cambioEncuentro && !cambioMeetManual && !cambioNotas) {
      setError("No hiciste cambios para guardar.")
      return
    }

    try {
      setGuardando(true)
      setError("")

      const body: Record<string, unknown> = {
        disponibilidadId: item.disponibilidadId,
        modoActualizacion: "editar",
        alcance: tieneSerie ? alcance : "solo_este",
        titulo: tituloTrim,
        fecha: fechaTrim,
        hora: horaTrim,
        duracion: duracionTrim,
        notas_documentos: notasParseadas,
      }

      if (cambioMeetManual && meetManualTrim) {
        body.meet_link = meetManualTrim
      }

      const res = await fetch("/api/agenda/admin/actualizar-disponibilidad", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      const data = (await res.json()) as {
        error?: string
        necesitaConexionGoogle?: boolean
      }

      if (!res.ok) {
        const mensaje = data.error || "No se pudieron guardar los cambios."
        setError(
          data.necesitaConexionGoogle
            ? `${mensaje} Podés hacerlo desde /google-calendar.`
            : mensaje
        )
        return
      }

      let mensaje = "Cambios guardados correctamente."

      if (cambioEncuentro && cambioMeetManual) {
        mensaje =
          "Cambios guardados. El Meet manual quedó actualizado. Sincronizá con Google para reflejar los cambios de horario o título."
      } else if (cambioEncuentro) {
        mensaje =
          "Cambios guardados. Sincronizá con Google para actualizar Calendar/Meet."
      } else if (cambioMeetManual) {
        mensaje = "Meet manual guardado correctamente."
      } else if (cambioNotas) {
        mensaje = "Notas/documentos guardados correctamente."
      }

      await onSaved?.(mensaje)
      onClose()
    } catch {
      setError("No se pudieron guardar los cambios.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(24,32,42,0.45)] p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[1.8rem] border border-[var(--line)] bg-[rgb(255,252,247)] p-6 shadow-[0_22px_70px_rgba(24,32,42,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="workspace-eyebrow">Agenda</p>
            <h2 className="workspace-title-sm">Editar encuentro</h2>
            <p className="workspace-inline-note">
              Actualizá los datos de la plataforma. El sync con Google se hace
              aparte.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="workspace-button-secondary disabled:opacity-60"
          >
            Cerrar
          </button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Título
              </span>
              <input
                className="workspace-field"
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
                placeholder="Título del encuentro"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Fecha
              </span>
              <input
                className="workspace-field"
                type="date"
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Hora
              </span>
              <input
                className="workspace-field"
                type="time"
                value={hora}
                onChange={(event) => setHora(event.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Duración
              </span>
              <input
                className="workspace-field"
                inputMode="numeric"
                value={duracion}
                onChange={(event) => setDuracion(event.target.value)}
                placeholder="Minutos"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Meet manual
              </span>
              <input
                className="workspace-field"
                value={meetManual}
                onChange={(event) => setMeetManual(event.target.value)}
                placeholder="https://meet.google.com/..."
              />
              <p className="workspace-inline-note">
                Si lo dejás vacío, no se borra el Meet actual.
              </p>
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">
              Notas/documentos de sesión
            </span>
            <textarea
              className="workspace-field min-h-32"
              value={notasTexto}
              onChange={(event) => setNotasTexto(event.target.value)}
              placeholder="Un documento por línea. Formato: Título | https://..."
            />
            <p className="workspace-inline-note">
              Un documento por línea. Podés usar `Título | URL`.
            </p>
          </label>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-[var(--foreground)]">
              Alcance
            </legend>
            <label className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.72)] p-4">
              <input
                type="radio"
                name="alcance"
                checked={alcance === "solo_este"}
                onChange={() => setAlcance("solo_este")}
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">
                  Sólo este encuentro
                </span>
                <span className="mt-1 block text-sm text-[var(--muted)]">
                  Aplica los cambios únicamente a este evento.
                </span>
              </span>
            </label>

            {tieneSerie ? (
              <label className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.72)] p-4">
                <input
                  type="radio"
                  name="alcance"
                  checked={alcance === "serie_futura"}
                  onChange={() => setAlcance("serie_futura")}
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">
                    Esta y próximas
                  </span>
                  <span className="mt-1 block text-sm text-[var(--muted)]">
                    Aplica los cambios a los encuentros futuros activos de la
                    misma serie.
                  </span>
                </span>
              </label>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[rgba(255,250,242,0.52)] p-4 text-sm text-[var(--muted)]">
                Este encuentro no pertenece a una serie editable.
              </div>
            )}
          </fieldset>

          {error && (
            <div className="workspace-panel-soft text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="workspace-button-secondary disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="workspace-button-primary disabled:opacity-60"
            >
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
