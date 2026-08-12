"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import ConsentimientoMeetButton from "@/components/consentimientos/ConsentimientoMeetButton"
import { useAppSession } from "@/components/auth/AppSessionProvider"
import HoraEnZonaLocal from "@/components/ui/HoraEnZonaLocal"
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
            {documentos.map((documento, index) => (
              <a
                key={`${item.id}-${documento.url}-${index}`}
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

function nombreActividad(actividadSlug: string) {
  if (actividadSlug === "casatalentos") return "CasaTalentos"
  if (actividadSlug === "conectando-sentidos") return "Conectando Sentidos"
  return actividadSlug
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

  const itemsVisibles = mostrarSoloProximo ? items.slice(0, 1) : items
  const esAdmin = session?.user?.role === "admin"

  return (
    <section className="space-y-4">
      {esAdmin && (
        <div className="workspace-panel-soft space-y-3">
          <p className="workspace-eyebrow">Programación centralizada</p>
          <h2 className="text-xl font-semibold">
            Los encuentros de {nombreActividad(actividadSlug)} se administran
            desde la agenda unificada
          </h2>
          <p className="workspace-inline-note">
            Para evitar duplicaciones, la agenda principal de la escuela es el
            lugar desde donde se crean, editan, cancelan y generan los Meet de
            esta actividad.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/agenda" className="workspace-button-secondary">
              Abrir agenda unificada
            </Link>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="workspace-eyebrow">Encuentros</p>
        <h2 className="workspace-title-sm">{tituloSeccion}</h2>
      </div>

      {cargando && <p className="workspace-inline-note">Cargando...</p>}
      {error && <p className="text-red-600">{error}</p>}

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
              {formatearFecha(item.fecha)} ·{" "}
              <HoraEnZonaLocal fecha={item.fecha} hora={item.hora} />
            </p>
            <p className="workspace-inline-note">Duración: {item.duracion} min</p>

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
          </div>
        ))}
      </div>
    </section>
  )
}
