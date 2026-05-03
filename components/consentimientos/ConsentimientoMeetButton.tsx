"use client"

import { useRef, useState } from "react"
import ConsentimientoModal from "@/components/consentimientos/ConsentimientoModal"
import { useAppSession } from "@/components/auth/AppSessionProvider"
import {
  esActividadConsentimiento,
  type ConsentimientoActividadSlug,
} from "@/lib/consentimientos"

type Props = {
  actividad: string
  href: string
  disponibilidadId?: number | string | null
  fechaEncuentro?: string | null
  horaEncuentro?: string | null
  children: React.ReactNode
  className?: string
}

async function leerJson<T>(res: Response): Promise<T> {
  const raw = await res.text()

  if (!raw) {
    return {} as T
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return {
      error: `Respuesta no válida del servidor: ${raw}`,
    } as T
  }
}

function abrirDestino(href: string) {
  const popup = window.open(href, "_blank", "noopener,noreferrer")

  if (!popup) {
    throw new Error(
      "El navegador bloqueó la apertura de la videollamada en una nueva pestaña. Permití popups e intentá nuevamente."
    )
  }
}

export default function ConsentimientoMeetButton({
  actividad,
  href,
  disponibilidadId,
  fechaEncuentro,
  horaEncuentro,
  children,
  className,
}: Props) {
  const { data: session } = useAppSession()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensajeError, setMensajeError] = useState("")
  const abriendoRef = useRef(false)

  const actividadValida = esActividadConsentimiento(actividad)
  const esAdmin = session?.user?.role === "admin"

  const abrirDestinoUnaVez = (destino: string) => {
    if (abriendoRef.current) {
      return
    }

    abriendoRef.current = true
    try {
      abrirDestino(destino)
    } catch (error) {
      setMensajeError(
        error instanceof Error
          ? error.message
          : "No se pudo abrir la videollamada en una nueva pestaña."
      )
    } finally {
      window.setTimeout(() => {
        abriendoRef.current = false
      }, 1200)
    }
  }

  const verificarYAbrir = async (actividadSlug: ConsentimientoActividadSlug) => {
    const params = new URLSearchParams({
      actividad: actividadSlug,
    })

    if (disponibilidadId !== undefined && disponibilidadId !== null) {
      params.set("disponibilidadId", String(disponibilidadId))
    }

    if (fechaEncuentro) {
      params.set("fechaEncuentro", fechaEncuentro)
    }

    if (horaEncuentro) {
      params.set("horaEncuentro", horaEncuentro)
    }

    const res = await fetch(`/api/consentimientos?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    })

    const data = await leerJson<{
      aceptado?: boolean
      error?: string
    }>(res)

    if (!res.ok) {
      throw new Error(data.error || "No se pudo verificar el consentimiento.")
    }

    if (data.aceptado === true) {
      abrirDestinoUnaVez(href)
      return
    }

    setModalAbierto(true)
  }

  const handleClick = async () => {
    if (!href || abriendoRef.current) return

    if (esAdmin || !actividadValida || !session?.user?.email) {
      abrirDestinoUnaVez(href)
      return
    }

    try {
      setMensajeError("")
      await verificarYAbrir(actividad)
    } catch (error) {
      setMensajeError(
        error instanceof Error
          ? error.message
          : "No se pudo verificar el consentimiento."
      )
      setModalAbierto(true)
    }
  }

  const aceptar = async () => {
    if (abriendoRef.current) {
      return
    }

    if (!actividadValida) {
      abrirDestinoUnaVez(href)
      return
    }

    try {
      setGuardando(true)
      setMensajeError("")

      const res = await fetch("/api/consentimientos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividad,
          disponibilidadId,
          fechaEncuentro,
          horaEncuentro,
        }),
      })

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo guardar el consentimiento.")
        return
      }

      abrirDestinoUnaVez(href)
      setModalAbierto(false)
    } catch {
      setMensajeError("Error guardando el consentimiento.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => void handleClick()} className={className}>
        {children}
      </button>

      {modalAbierto && actividadValida && (
        <>
          <div aria-hidden className="pointer-events-none fixed inset-0 z-40" />

          <ConsentimientoModal
            actividad={actividad}
            fechaEncuentro={fechaEncuentro}
            horaEncuentro={horaEncuentro}
            guardando={guardando}
            onAceptar={() => void aceptar()}
            onCancelar={() => setModalAbierto(false)}
            aceptarLabel="Aceptar e ingresar"
            cancelarLabel="Cancelar"
          />

          {mensajeError && (
            <div className="fixed bottom-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border bg-white px-4 py-3 text-sm text-red-600 shadow-xl">
              {mensajeError}
            </div>
          )}
        </>
      )}
    </>
  )
}
