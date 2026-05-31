"use client"

import { useEffect, useState } from "react"
import ConsentimientoMeetButton from "@/components/consentimientos/ConsentimientoMeetButton"
import { useAppSession } from "@/components/auth/AppSessionProvider"
import type { DocumentoNota } from "@/lib/documentos-notas"

type ItemAgenda = {
  id: string
  disponibilidadId?: number | null
  titulo: string
  actividadNombre: string
  fecha: string
  hora: string
  duracion: string
  estado: string
  puedeIngresar: boolean
  motivoBloqueo?: string | null
  meet_link?: string | null
  meetLink?: string | null
  syncStatus?: string | null
  lastSyncedAt?: string | null
  serieId?: string | null
  notasDocumentos?: DocumentoNota[]
  eliminablePorAdmin?: boolean
}

function formatearFecha(fecha: string) {
  const d = new Date(`${fecha}T00:00:00`)
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function renderDocumentosNotas(item: ItemAgenda) {
  if (!item.meetLink) {
    return null
  }

  const documentos = item.notasDocumentos || []

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.72)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Antes del Meet
      </p>

      {documentos.length > 0 ? (
        <>
          <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
            Toma de notas
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {documentos.map((documento) => (
              <a
                key={`${item.id}-${documento.url}`}
                href={documento.url}
                target="_blank"
                rel="noreferrer"
                className="workspace-button-secondary !px-3 !py-1.5 text-xs"
              >
                {documento.titulo}
              </a>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-1 text-sm text-[var(--muted)]">
          No hay documentos de notas cargados para este encuentro.
        </p>
      )}
    </div>
  )
}

function etiquetaSync(syncStatus?: string | null, meetLink?: string | null) {
  if (syncStatus === "sincronizado" && meetLink) {
    return "Meet generado por Google Calendar"
  }

  if (syncStatus === "manual") {
    return "Meet manual"
  }

  if (syncStatus === "sincronizando") {
    return "Generando Meet..."
  }

  if (syncStatus === "error") {
    return "Google Calendar no pudo generar el Meet"
  }

  if (meetLink) {
    return "Meet disponible"
  }

  return "Meet aún no generado"
}

export default function AgendaActividad({
  actividadSlug,
  tituloSeccion = "Próximos encuentros",
  mostrarSoloProximo = false,
}: {
  actividadSlug: string
  tituloSeccion?: string
  mostrarSoloProximo?: boolean
}) {
  const { data: session } = useAppSession()
  const [items, setItems] = useState<ItemAgenda[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [operandoId, setOperandoId] = useState<number | null>(null)

  const cargar = async () => {
    try {
      setCargando(true)
      setError("")

      const res = await fetch("/api/agenda/por-actividad", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ actividadSlug }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "No se pudo cargar la agenda")
        return
      }

      setItems(data.items || [])
    } catch {
      setError("Error de conexión")
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargar()
  }, [actividadSlug])

  const ejecutarAccion = async (
    item: ItemAgenda,
    accion: "sync" | "editar" | "meet_manual" | "cancelar",
    alcance: "solo_este" | "serie_futura" = "solo_este"
  ) => {
    if (!item.disponibilidadId) return

    if (alcance === "serie_futura" && !item.serieId) {
      setError(
        "Esta programación no tiene identificador de serie. Sólo se puede modificar este encuentro."
      )
      return
    }

    try {
      setOperandoId(item.disponibilidadId)
      setError("")
      setMensaje("")

      let res: Response

      if (accion === "sync") {
        res = await fetch("/api/google/sync-disponibilidad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ disponibilidadId: item.disponibilidadId }),
        })
      } else if (accion === "meet_manual") {
        const meetLink = window.prompt("Pegá el Meet real para este encuentro:", item.meetLink || "")
        if (meetLink === null) return

        res = await fetch("/api/agenda/admin/actualizar-disponibilidad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            disponibilidadId: item.disponibilidadId,
            modoActualizacion: "meet_manual",
            meet_link: meetLink,
          }),
        })
      } else if (accion === "cancelar") {
        const confirmar = window.confirm(
          alcance === "serie_futura"
            ? "Este encuentro y los próximos de la misma serie se cancelarán y dejarán de verse en las agendas activas. ¿Querés continuar?"
            : "El encuentro se cancelará y dejará de verse en las agendas activas. ¿Querés continuar?"
        )
        if (!confirmar) return

        res = await fetch("/api/agenda/admin/actualizar-disponibilidad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            disponibilidadId: item.disponibilidadId,
            modoActualizacion: "cancelar",
            alcance,
          }),
        })
      } else {
        const titulo = window.prompt("Título del encuentro:", item.titulo)
        if (titulo === null) return
        const fecha = window.prompt(
          alcance === "serie_futura"
            ? "Nueva fecha para este encuentro base (AAAA-MM-DD). Las próximas fechas se moverán con el mismo corrimiento:"
            : "Fecha (AAAA-MM-DD):",
          item.fecha
        )
        if (fecha === null) return
        const hora = window.prompt("Hora (HH:mm):", item.hora)
        if (hora === null) return
        const duracion = window.prompt("Duración en minutos:", item.duracion)
        if (duracion === null) return

        res = await fetch("/api/agenda/admin/actualizar-disponibilidad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            disponibilidadId: item.disponibilidadId,
            modoActualizacion: "editar",
            titulo,
            fecha,
            hora,
            duracion,
            alcance,
          }),
        })
      }

      const data = await res.json()

      if (!res.ok) {
        const mensaje = data.error || "No se pudo completar la acción."
        setError(
          data.necesitaConexionGoogle
            ? `${mensaje} Podés hacerlo desde /google-calendar.`
            : mensaje
        )
        return
      }

      setMensaje(
        accion === "sync"
          ? "Meet sincronizado correctamente."
          : accion === "meet_manual"
            ? "Meet manual guardado correctamente."
            : accion === "cancelar"
              ? data.afectados && data.afectados > 1
                ? `${data.afectados} encuentros cancelados correctamente.`
                : "Encuentro cancelado correctamente."
              : data.afectados && data.afectados > 1
                ? `${data.afectados} encuentros actualizados correctamente.`
                : "Encuentro actualizado correctamente."
      )
      await cargar()
    } catch {
      setError("No se pudo completar la acción.")
    } finally {
      setOperandoId(null)
    }
  }

  const itemsVisibles = mostrarSoloProximo ? items.slice(0, 1) : items
  const esAdmin = session?.user?.role === "admin"

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <p className="workspace-eyebrow">Encuentros</p>
        <h2 className="workspace-title-sm">{tituloSeccion}</h2>
      </div>

      {cargando && <p className="workspace-inline-note">Cargando...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {mensaje && <p className="text-green-700 text-sm font-medium">{mensaje}</p>}

      {!cargando && !error && itemsVisibles.length === 0 && (
        <p className="workspace-inline-note">No hay encuentros cargados todavía.</p>
      )}

      <div className="grid gap-4">
        {itemsVisibles.map((item) => (
          <div key={item.id} className="workspace-card-link !rounded-[1.4rem] !p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="workspace-chip">{item.actividadNombre}</span>
              <span className="workspace-chip">{item.estado}</span>
            </div>
            <p className="text-lg font-semibold tracking-[-0.03em]">{item.titulo}</p>
            <p className="workspace-inline-note">
              {formatearFecha(item.fecha)} · {item.hora}
            </p>
            <p className="workspace-inline-note">Duración: {item.duracion} min</p>
            {esAdmin && (
              <p className="workspace-inline-note">
                Meet: {etiquetaSync(item.syncStatus, item.meetLink)}
              </p>
            )}

            {esAdmin && renderDocumentosNotas(item)}

            {item.meetLink && item.puedeIngresar && (
              <ConsentimientoMeetButton
                actividad={actividadSlug}
                href={item.meetLink}
                disponibilidadId={item.disponibilidadId}
                fechaEncuentro={item.fecha}
                horaEncuentro={item.hora}
                className="workspace-button-secondary"
              >
                Ir al encuentro
              </ConsentimientoMeetButton>
            )}

            {!item.puedeIngresar && item.motivoBloqueo && (
              <p className="workspace-inline-note text-amber-700">
                {item.motivoBloqueo}
              </p>
            )}

            {esAdmin && item.eliminablePorAdmin && item.disponibilidadId && (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void ejecutarAccion(item, "sync")}
                  disabled={operandoId === item.disponibilidadId}
                  className="workspace-button-secondary disabled:opacity-60"
                >
                  {operandoId === item.disponibilidadId
                    ? "Procesando..."
                    : "Generar/Reintentar Meet"}
                </button>
                <button
                  type="button"
                  onClick={() => void ejecutarAccion(item, "editar", "solo_este")}
                  disabled={operandoId === item.disponibilidadId}
                  className="workspace-button-secondary disabled:opacity-60"
                >
                  Editar este encuentro
                </button>
                <button
                  type="button"
                  onClick={() => void ejecutarAccion(item, "editar", "serie_futura")}
                  disabled={operandoId === item.disponibilidadId || !item.serieId}
                  title={
                    item.serieId
                      ? "Editar este encuentro y los próximos de la misma serie"
                      : "Esta programación no tiene identificador de serie. Sólo se puede modificar este encuentro."
                  }
                  className="workspace-button-secondary disabled:opacity-60"
                >
                  Editar esta y próximas
                </button>
                <button
                  type="button"
                  onClick={() => void ejecutarAccion(item, "meet_manual")}
                  disabled={operandoId === item.disponibilidadId}
                  className="workspace-button-secondary disabled:opacity-60"
                >
                  Configurar Meet manual
                </button>
                <button
                  type="button"
                  onClick={() => void ejecutarAccion(item, "cancelar", "solo_este")}
                  disabled={operandoId === item.disponibilidadId}
                  className="workspace-button-secondary disabled:opacity-60"
                >
                  Cancelar este encuentro
                </button>
                <button
                  type="button"
                  onClick={() => void ejecutarAccion(item, "cancelar", "serie_futura")}
                  disabled={operandoId === item.disponibilidadId || !item.serieId}
                  title={
                    item.serieId
                      ? "Cancelar este encuentro y los próximos de la misma serie"
                      : "Esta programación no tiene identificador de serie. Sólo se puede modificar este encuentro."
                  }
                  className="workspace-button-secondary disabled:opacity-60"
                >
                  Cancelar esta y próximas
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
