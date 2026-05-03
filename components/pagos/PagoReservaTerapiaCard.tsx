"use client"

import { useRef, useState } from "react"

type Props = {
  reservaId: number
  montoTransferencia?: string | number | null
  montoMercadoPago?: string | number | null
  porcentajeRecargoMercadoPago?: number | null
  comprobanteNombreArchivo?: string | null
  onActualizado?: () => Promise<void> | void
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

export default function PagoReservaTerapiaCard({
  reservaId,
  montoTransferencia,
  montoMercadoPago,
  porcentajeRecargoMercadoPago,
  comprobanteNombreArchivo,
  onActualizado,
}: Props) {
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null)
  const [cargando, setCargando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [mensaje, setMensaje] = useState("")
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)

  const abrirMercadoPago = async () => {
    try {
      setCargando(true)
      setMensaje("Abriendo Mercado Pago...")
      setError("")

      const res = await fetch("/api/crear-preferencia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reservaId,
        }),
      })

      const data = await leerJson<{ error?: string; init_point?: string }>(res)

      if (!res.ok || !data.init_point) {
        setError(data.error || "No se pudo abrir Mercado Pago.")
        setMensaje("")
        return
      }

      const popup = window.open(
        data.init_point,
        "_blank",
        "noopener,noreferrer"
      )

      if (!popup) {
        window.location.href = data.init_point
      }
    } catch {
      setError("Error conectando con Mercado Pago.")
      setMensaje("")
    } finally {
      setCargando(false)
    }
  }

  const enviarComprobante = async () => {
    if (!archivoPendiente) {
      setError("Elegí primero un comprobante.")
      return
    }

    try {
      setSubiendo(true)
      setMensaje("Subiendo comprobante...")
      setError("")

      const formData = new FormData()
      formData.append("reservaId", String(reservaId))
      formData.append("archivo", archivoPendiente)

      const res = await fetch("/api/reservas/subir-comprobante", {
        method: "POST",
        body: formData,
      })

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setError(data.error || "No se pudo enviar el comprobante.")
        setMensaje("")
        return
      }

      setArchivoPendiente(null)
      setMensaje(
        "Comprobante enviado correctamente. La reserva quedó pendiente de revisión."
      )

      if (onActualizado) {
        await onActualizado()
      }
    } catch {
      setError("Error subiendo el comprobante.")
      setMensaje("")
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="workspace-panel-soft space-y-3">
      <div className="space-y-1">
        <p className="workspace-eyebrow">Pago pendiente</p>
        <h4 className="font-semibold">Completá el pago para habilitar la sesión</h4>
      </div>

      {mensaje && <p className="text-sm text-emerald-700">{mensaje}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      <p className="workspace-inline-note">
        Transferencia: <strong>ARS {montoTransferencia || "0"}</strong>
      </p>
      <p className="workspace-inline-note">
        Mercado Pago: <strong>ARS {montoMercadoPago || montoTransferencia || "0"}</strong>
      </p>

      {porcentajeRecargoMercadoPago ? (
        <p className="workspace-inline-note">
          Mercado Pago incluye un recargo del{" "}
          <strong>{porcentajeRecargoMercadoPago}%</strong>.
        </p>
      ) : null}

      {comprobanteNombreArchivo && (
        <p className="workspace-inline-note">
          Comprobante cargado: <strong>{comprobanteNombreArchivo}</strong>
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] || null
          setArchivoPendiente(file)
          if (file) {
            setMensaje(`Comprobante listo para enviar: ${file.name}`)
          }
          e.currentTarget.value = ""
        }}
      />

      {archivoPendiente && (
        <p className="workspace-inline-note">
          Archivo elegido: <strong>{archivoPendiente.name}</strong>
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void abrirMercadoPago()}
          disabled={cargando}
          className="workspace-button-primary disabled:opacity-60"
        >
          {cargando ? "Abriendo..." : "Pagar con Mercado Pago"}
        </button>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="workspace-button-secondary disabled:opacity-60"
        >
          Elegir comprobante
        </button>

        <button
          type="button"
          onClick={() => void enviarComprobante()}
          disabled={subiendo || !archivoPendiente}
          className="workspace-button-secondary disabled:opacity-60"
        >
          {subiendo ? "Enviando..." : "Enviar comprobante"}
        </button>
      </div>
    </div>
  )
}
