"use client"

import { useEffect, useMemo, useState } from "react"

type Grabacion = {
  id: number
  titulo: string
  descripcion?: string | null
  drive_url: string
  drive_file_id?: string | null
  fecha?: string | null
}

function extraerDriveFileId(url?: string | null) {
  if (!url) return null

  const matchFile = url.match(/\/file\/d\/([^/]+)/)
  if (matchFile?.[1]) return matchFile[1]

  const matchOpen = url.match(/[?&]id=([^&]+)/)
  if (matchOpen?.[1]) return matchOpen[1]

  return null
}

function esCarpetaDrive(url?: string | null) {
  if (!url) return false
  return url.includes("/drive/folders/")
}

function formatearFecha(fecha?: string | null) {
  if (!fecha) return ""
  const date = new Date(fecha)
  if (Number.isNaN(date.getTime())) return fecha

  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export default function BibliotecaGrabaciones({
  actividadSlug,
  previewEnabled = false,
  mostrarAccesoDrive = false,
}: {
  actividadSlug: string
  previewEnabled?: boolean
  mostrarAccesoDrive?: boolean
}) {
  const [grabaciones, setGrabaciones] = useState<Grabacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [grabacionAbiertaId, setGrabacionAbiertaId] = useState<number | null>(null)

  useEffect(() => {
    const cargar = async () => {
      try {
        setCargando(true)
        setError("")

        const res = await fetch("/api/grabaciones/por-actividad", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            actividadSlug,
            previewEnabled,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || "Error cargando grabaciones")
          return
        }

        setGrabaciones(data.grabaciones || [])
      } catch {
        setError("Error de conexión")
      } finally {
        setCargando(false)
      }
    }

    void cargar()
  }, [actividadSlug, previewEnabled])

  const grabacionesOrdenadas = useMemo(() => {
    return [...grabaciones].sort((a, b) => {
      const fechaA = a.fecha ? new Date(a.fecha).getTime() : 0
      const fechaB = b.fecha ? new Date(b.fecha).getTime() : 0
      return fechaB - fechaA
    })
  }, [grabaciones])

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <p className="workspace-eyebrow">Biblioteca</p>
        <h2 className="workspace-title-sm">Biblioteca de grabaciones</h2>
      </div>

      {cargando && <p className="workspace-inline-note">Cargando...</p>}

      {error && <p className="text-red-600">{error}</p>}

      {grabacionesOrdenadas.length === 0 && !cargando && !error && (
        <p className="workspace-inline-note">No hay grabaciones disponibles.</p>
      )}

      <div className="grid gap-4">
        {grabacionesOrdenadas.map((g) => {
          const fileId = g.drive_file_id || extraerDriveFileId(g.drive_url)
          const previewUrl = fileId
            ? `https://drive.google.com/file/d/${fileId}/preview`
            : null

          return (
            <div key={g.id} className="workspace-card-link !rounded-[1.5rem] !p-5 space-y-3">
              <p className="text-lg font-semibold tracking-[-0.03em]">{g.titulo}</p>

              {g.fecha && (
                <p className="workspace-inline-note">{formatearFecha(g.fecha)}</p>
              )}

              {g.descripcion && (
                <p className="workspace-inline-note">{g.descripcion}</p>
              )}

              {!fileId &&
                (mostrarAccesoDrive ? (
                  esCarpetaDrive(g.drive_url) ? (
                    <p className="text-sm text-amber-700">
                      Esta grabación todavía está cargada con un link de carpeta de Drive. 
                      Para verla dentro de la plataforma, necesitás reemplazarla por el link del archivo de video.
                    </p>
                  ) : (
                    <p className="text-sm text-red-600">
                      Esta grabación no tiene un archivo de Drive válido para visualizar en plataforma.
                    </p>
                  )
                ) : (
                  <p className="workspace-inline-note">
                    Esta grabación todavía no está disponible para recorrer.
                  </p>
                ))}

              <div className="flex gap-3 flex-wrap">
                {fileId && (
                  <button
                    type="button"
                    onClick={() =>
                      setGrabacionAbiertaId((prev) => (prev === g.id ? null : g.id))
                    }
                    className="workspace-button-secondary"
                  >
                    {grabacionAbiertaId === g.id
                      ? "Cerrar"
                      : mostrarAccesoDrive
                        ? "Ver en plataforma"
                        : "Recorrer"}
                  </button>
                )}

                {mostrarAccesoDrive && (
                  <a
                    href={g.drive_url}
                    target="_blank"
                    rel="noreferrer"
                    className="workspace-button-secondary"
                  >
                    Abrir en Drive
                  </a>
                )}
              </div>

              {fileId && grabacionAbiertaId === g.id && previewUrl && (
                <div className="border rounded overflow-hidden">
                  <iframe
                    src={previewUrl}
                    width="100%"
                    height="520"
                    allow="autoplay; fullscreen"
                    allowFullScreen
                    className="w-full"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
