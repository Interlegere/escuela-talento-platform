"use client"

import { useCallback, useEffect, useState } from "react"
import HDRAdminPanel from "@/components/hdr/HDRAdminPanel"
import HDRParticipantePanel from "@/components/hdr/HDRParticipantePanel"
import type { HDRActividadPayload, HDRActividadSlug } from "@/lib/hdr"

type Props = {
  actividadSlug: HDRActividadSlug
  actorEmail: string
}

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

export default function HDRActividad({ actividadSlug, actorEmail }: Props) {
  const [data, setData] = useState<HDRActividadPayload | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")

  const cargarHDR = useCallback(async () => {
    try {
      setCargando(true)
      setError("")

      const res = await fetch(
        `/api/hdr/coordenadas?actividadSlug=${encodeURIComponent(actividadSlug)}`
      )
      const json = await leerJson<HDRActividadPayload & { error?: string }>(res)

      if (!res.ok) {
        setError(json.error || "No se pudo cargar la Hoja de Ruta.")
        return
      }

      setData(json)
    } catch {
      setError("Hubo un problema al cargar la Hoja de Ruta.")
    } finally {
      setCargando(false)
    }
  }, [actividadSlug])

  useEffect(() => {
    void cargarHDR()
  }, [cargarHDR])

  if (cargando) {
    return (
      <div className="workspace-panel-soft">
        <p className="workspace-inline-note">Cargando Hoja de Ruta...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="workspace-panel-soft text-red-700">
        <p>{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="workspace-panel-soft">
        <p className="workspace-inline-note">
          Todavía no se pudo cargar la Hoja de Ruta.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="workspace-panel-soft space-y-2">
        <h3 className="text-lg font-semibold">Hoja de Ruta</h3>
      </div>

      {data.esAdmin ? (
        <HDRAdminPanel
          actividadSlug={actividadSlug}
          data={data}
          onActualizado={cargarHDR}
        />
      ) : (
        <HDRParticipantePanel
          actividadSlug={actividadSlug}
          actorEmail={actorEmail}
          data={data}
          onGuardado={cargarHDR}
        />
      )}
    </div>
  )
}
