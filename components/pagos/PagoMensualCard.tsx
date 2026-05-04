"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { etiquetaModalidadPago, type BillingMode } from "@/lib/billing"

type PagoMensual = {
  id: number
  anio: number
  mes: number
  estado: string
  medio_pago?: string | null
  monto: string
  moneda: string
  mp_status?: string | null
  comprobante_nombre_archivo?: string | null
}

type ResumenMontos = {
  montoTransferencia: number
  porcentajeRecargoMercadoPago: number
  recargoMercadoPago: number
  montoMercadoPago: number
}

type Actividad = {
  id: number
  slug: string
  nombre: string
  descripcion?: string | null
  precio_mensual: string
  moneda: string
}

type Props = {
  actividadSlug: string
  participanteNombre: string
  participanteEmail: string
  modalidadPago?: BillingMode
}

function extraerDetalleMercadoPago(detalle: unknown) {
  if (!detalle || typeof detalle !== "object") {
    return typeof detalle === "string" ? detalle : ""
  }

  const detalleRecord = detalle as Record<string, unknown>
  const message =
    typeof detalleRecord.message === "string" ? detalleRecord.message : ""

  const cause = Array.isArray(detalleRecord.cause)
    ? detalleRecord.cause.find(
        (item) =>
          item &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).description === "string"
      )
    : null

  const causeDescription =
    cause && typeof cause === "object"
      ? String((cause as Record<string, unknown>).description || "")
      : ""

  const status =
    typeof detalleRecord.status === "number" ||
    typeof detalleRecord.status === "string"
      ? String(detalleRecord.status)
      : ""

  const fragments = [message, causeDescription, status ? `Código ${status}` : ""]
    .map((value) => value.trim())
    .filter(Boolean)

  if (fragments.length > 0) {
    return fragments.join(" · ")
  }

  try {
    return JSON.stringify(detalleRecord)
  } catch {
    return ""
  }
}

export default function PagoMensualCard({
  actividadSlug,
  participanteNombre,
  participanteEmail,
  modalidadPago: modalidadPagoProp = "mensual",
}: Props) {
  const [actividad, setActividad] = useState<Actividad | null>(null)
  const [pago, setPago] = useState<PagoMensual | null>(null)
  const [resumenMontos, setResumenMontos] = useState<ResumenMontos | null>(null)
  const [mensaje, setMensaje] = useState("")
  const [cargando, setCargando] = useState(false)
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const esProceso = modalidadPagoProp === "proceso"

  const cargar = useCallback(async () => {
    try {
      setCargando(true)
      setMensaje("")

      const res = await fetch("/api/pagos-mensuales/obtener-o-crear", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividadSlug,
          participanteNombre,
          participanteEmail,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudo cargar el pago mensual")
        return
      }

      setActividad(data.actividad)
      setPago(data.pago)
      setResumenMontos(data.resumenMontos || null)
    } catch {
      setMensaje("Error conectando con el servidor")
    } finally {
      setCargando(false)
    }
  }, [actividadSlug, participanteEmail, participanteNombre])

  useEffect(() => {
    if (participanteNombre && participanteEmail) {
      void cargar()
    }
  }, [cargar, participanteNombre, participanteEmail])

  const pagarConMercadoPago = async () => {
    if (!pago) return

    try {
      setCargando(true)
      setMensaje("Redirigiendo a Mercado Pago...")

      const res = await fetch("/api/pagos-mensuales/crear-preferencia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pagoMensualId: pago.id,
          participanteNombre,
          participanteEmail,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        const detalle = extraerDetalleMercadoPago(data.detalle)
        setMensaje(
          [data.error || "No se pudo iniciar el pago mensual", detalle]
            .filter(Boolean)
            .join(": ")
        )
        return
      }

      if (data.init_point) {
        window.location.href = data.init_point
        return
      }

      setMensaje("No se pudo obtener el link de pago")
    } catch {
      setMensaje("Error conectando con el servidor")
    } finally {
      setCargando(false)
    }
  }

  const subirComprobante = async (file: File) => {
    if (!pago) return

    try {
      setCargando(true)
      setMensaje("Subiendo comprobante...")

      const formData = new FormData()
      formData.append("pagoMensualId", String(pago.id))
      formData.append("participanteEmail", participanteEmail)
      formData.append("archivo", file)

      const res = await fetch("/api/pagos-mensuales/subir-comprobante", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudo subir el comprobante")
        return
      }

      setArchivoPendiente(null)
      setMensaje(
        "Comprobante enviado correctamente. Ya quedó cargado y en revisión para administración."
      )
      await cargar()
    } catch {
      setMensaje("Error subiendo el comprobante")
    } finally {
      setCargando(false)
    }
  }

  const onSeleccionarArchivo = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivoPendiente(file)
    setMensaje("Archivo listo para enviar. Confirmá con “Enviar comprobante”.")
    e.target.value = ""
  }

  return (
    <section className="workspace-panel space-y-4">
      <div>
        <p className="workspace-eyebrow">
          {etiquetaModalidadPago(modalidadPagoProp, actividadSlug)}
        </p>
        <h2 className="workspace-title-sm mt-2">
          {actividad?.nombre || "Actividad mensual"}
        </h2>
        {actividad?.descripcion && (
          <p className="workspace-inline-note mt-2">{actividad.descripcion}</p>
        )}
      </div>

      {mensaje && <div className="workspace-panel-soft text-sm">{mensaje}</div>}

      {cargando && !pago && <p className="workspace-inline-note">Cargando...</p>}

      {pago && (
        <div className="space-y-2">
          {!esProceso && (
            <p>
              <strong>Período:</strong> {pago.mes}/{pago.anio}
            </p>
          )}
          {esProceso && (
            <p className="workspace-inline-note">
              Este cobro corresponde al proceso activo de esta actividad.
            </p>
          )}
          <p>
            <strong>Transferencia:</strong>{" "}
            {pago.moneda} {resumenMontos ? resumenMontos.montoTransferencia : pago.monto}
          </p>
          <p>
            <strong>Mercado Pago:</strong>{" "}
            {pago.moneda} {resumenMontos ? resumenMontos.montoMercadoPago : pago.monto}
          </p>
          {resumenMontos && resumenMontos.porcentajeRecargoMercadoPago > 0 && (
            <p className="workspace-inline-note">
              Mercado Pago incluye un recargo del{" "}
              <strong>{resumenMontos.porcentajeRecargoMercadoPago}%</strong>{" "}
              por comisión de la plataforma.
            </p>
          )}
          <p>
            <strong>Estado:</strong> {pago.estado}
          </p>
          {pago.estado === "en_revision" && (
            <p className="workspace-inline-note">
              Tu comprobante ya fue enviado. Ahora queda pendiente de revisión desde Admin Pagos.
            </p>
          )}
          <p>
            <strong>Medio de pago:</strong> {pago.medio_pago || "sin definir"}
          </p>

          {pago.comprobante_nombre_archivo && (
            <p>
              <strong>Comprobante:</strong> {pago.comprobante_nombre_archivo}
            </p>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            className="hidden"
            onChange={onSeleccionarArchivo}
          />

          <div className="flex gap-3 flex-wrap pt-2">
            {pago.estado !== "pagado" && (
              <button
                onClick={pagarConMercadoPago}
                disabled={cargando}
                className="workspace-button-primary disabled:opacity-60"
              >
                Pagar con Mercado Pago
              </button>
            )}

            {pago.estado !== "pagado" && (
              <button
                onClick={() => inputRef.current?.click()}
                disabled={cargando}
                className="workspace-button-secondary disabled:opacity-60"
              >
                Subir comprobante
              </button>
            )}

            {pago.estado !== "pagado" && archivoPendiente && (
              <button
                onClick={() => void subirComprobante(archivoPendiente)}
                disabled={cargando}
                className="workspace-button-primary disabled:opacity-60"
              >
                Enviar comprobante
              </button>
            )}

            {pago.estado !== "pagado" && archivoPendiente && (
              <button
                onClick={() => {
                  setArchivoPendiente(null)
                  setMensaje("")
                }}
                disabled={cargando}
                className="workspace-button-secondary disabled:opacity-60"
              >
                Cancelar archivo
              </button>
            )}
          </div>

          {archivoPendiente && (
            <p className="workspace-inline-note">
              Archivo seleccionado: <strong>{archivoPendiente.name}</strong>
            </p>
          )}
        </div>
      )}
    </section>
  )
}
