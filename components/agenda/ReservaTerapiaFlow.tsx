"use client"

import { useMemo, useRef, useState } from "react"
import type { DisponibilidadAgenda } from "@/components/agenda/types"

type Props = {
  disponibilidades: DisponibilidadAgenda[]
  nombreInicial?: string
  emailInicial?: string
  onReservaExitosa?: () => Promise<void> | void
}

type Paso = "fecha" | "horario" | "datos" | "pago"

type ResumenMontos = {
  montoTransferencia: number
  porcentajeRecargoMercadoPago: number
  recargoMercadoPago: number
  montoMercadoPago: number
}

function formatearFechaLarga(fecha: string) {
  const [anio, mes, dia] = fecha.split("-").map(Number)
  const date = new Date(anio, mes - 1, dia)

  if (Number.isNaN(date.getTime())) {
    return fecha
  }

  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
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

export default function ReservaTerapiaFlow({
  disponibilidades,
  nombreInicial = "",
  emailInicial = "",
  onReservaExitosa,
}: Props) {
  const [pasoActual, setPasoActual] = useState<Paso>("fecha")
  const [fechaSeleccionada, setFechaSeleccionada] = useState("")
  const [horarioSeleccionadoId, setHorarioSeleccionadoId] = useState<number | null>(null)

  const [nombre, setNombre] = useState(nombreInicial)
  const [email, setEmail] = useState(emailInicial)
  const [telefono, setTelefono] = useState("")
  const [mensaje, setMensaje] = useState("")

  const [reservaPendienteId, setReservaPendienteId] = useState<number | null>(null)
  const [resumenMontos, setResumenMontos] = useState<ResumenMontos | null>(null)
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null)

  const [cargando, setCargando] = useState(false)
  const [subiendoComprobante, setSubiendoComprobante] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")

  const inputArchivoRef = useRef<HTMLInputElement | null>(null)

  const fechasDisponibles = useMemo(() => {
    const unicas = Array.from(new Set(disponibilidades.map((d) => d.fecha)))
    return unicas.sort((a, b) => a.localeCompare(b))
  }, [disponibilidades])

  const horariosDeFecha = useMemo(() => {
    if (!fechaSeleccionada) return []

    return disponibilidades
      .filter((d) => d.fecha === fechaSeleccionada)
      .sort((a, b) => a.hora.localeCompare(b.hora))
  }, [disponibilidades, fechaSeleccionada])

  const horarioSeleccionado = useMemo(() => {
    return horariosDeFecha.find((h) => h.id === horarioSeleccionadoId) || null
  }, [horariosDeFecha, horarioSeleccionadoId])

  const reiniciarFlujo = () => {
    setPasoActual("fecha")
    setFechaSeleccionada("")
    setHorarioSeleccionadoId(null)
    setTelefono("")
    setMensaje("")
    setReservaPendienteId(null)
    setResumenMontos(null)
    setArchivoPendiente(null)
  }

  const continuar = async () => {
    setError("")
    setInfo("")

    if (!horarioSeleccionado) {
      setError("Seleccioná un horario para continuar.")
      return
    }

    if (!nombre.trim()) {
      setError("Ingresá tu nombre.")
      return
    }

    if (!email.trim()) {
      setError("Ingresá tu email.")
      return
    }

    try {
      setCargando(true)
      setInfo(
        horarioSeleccionado.requiere_pago
          ? "Preparando el pago de tu sesión..."
          : "Confirmando tu sesión..."
      )

      const res = await fetch("/api/crear-preferencia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          disponibilidadId: horarioSeleccionado.id,
          comprador: nombre.trim(),
          email: email.trim(),
          telefono: telefono.trim(),
          mensaje: mensaje.trim(),
          prepararSolo: horarioSeleccionado.requiere_pago,
        }),
      })

      const data = await leerJson<{
        error?: string
        init_point?: string
        requiere_pago?: boolean
        reserva_id?: number
        resumenMontos?: ResumenMontos
      }>(res)

      if (!res.ok) {
        setError(data.error || "No se pudo iniciar la reserva.")
        setInfo("")
        return
      }

      if (data.init_point) {
        const popup = window.open(
          data.init_point,
          "_blank",
          "noopener,noreferrer"
        )

        if (!popup) {
          window.location.href = data.init_point
        }
        return
      }

      if (data.requiere_pago && data.reserva_id) {
        setReservaPendienteId(data.reserva_id)
        setResumenMontos(data.resumenMontos || null)
        setPasoActual("pago")
        setInfo(
          "La sesión quedó reservada a la espera del pago. Elegí ahora cómo querés abonarla."
        )
        return
      }

      if (!data.requiere_pago) {
        setInfo("Sesión confirmada correctamente.")
        reiniciarFlujo()

        if (onReservaExitosa) {
          await onReservaExitosa()
        }

        return
      }

      setError("No se pudo continuar con el pago.")
      setInfo("")
    } catch {
      setError("Error conectando con el servidor.")
      setInfo("")
    } finally {
      setCargando(false)
    }
  }

  const pagarConMercadoPago = async () => {
    if (!reservaPendienteId) return

    try {
      setCargando(true)
      setError("")
      setInfo("Abriendo Mercado Pago...")

      const res = await fetch("/api/crear-preferencia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reservaId: reservaPendienteId,
        }),
      })

      const data = await leerJson<{
        error?: string
        init_point?: string
      }>(res)

      if (!res.ok || !data.init_point) {
        setError(data.error || "No se pudo abrir Mercado Pago.")
        setInfo("")
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
      setInfo("")
    } finally {
      setCargando(false)
    }
  }

  const enviarComprobante = async () => {
    if (!reservaPendienteId || !archivoPendiente) {
      setError("Elegí primero el comprobante de transferencia.")
      return
    }

    try {
      setSubiendoComprobante(true)
      setError("")
      setInfo("Subiendo comprobante...")

      const formData = new FormData()
      formData.append("reservaId", String(reservaPendienteId))
      formData.append("archivo", archivoPendiente)

      const res = await fetch("/api/reservas/subir-comprobante", {
        method: "POST",
        body: formData,
      })

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setError(data.error || "No se pudo enviar el comprobante.")
        setInfo("")
        return
      }

      setArchivoPendiente(null)
      setInfo(
        "Comprobante enviado correctamente. La sesión quedó pendiente de revisión administrativa."
      )
      reiniciarFlujo()

      if (onReservaExitosa) {
        await onReservaExitosa()
      }
    } catch {
      setError("Error subiendo el comprobante.")
      setInfo("")
    } finally {
      setSubiendoComprobante(false)
    }
  }

  return (
    <section className="workspace-panel space-y-5">
      <div className="space-y-2">
        <p className="workspace-eyebrow">Reserva terapéutica</p>
        <h2 className="workspace-title-sm">Agendar sesión</h2>
        <p className="workspace-inline-note">
          Avanzá paso a paso: elegí la fecha, después el horario, completá tus
          datos y, si corresponde, resolvé el pago antes de habilitar el ingreso.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={`workspace-chip ${pasoActual === "fecha" ? "ring-2 ring-[rgba(203,138,36,0.24)]" : ""}`}>
          1. Fecha
        </span>
        <span className={`workspace-chip ${pasoActual === "horario" ? "ring-2 ring-[rgba(203,138,36,0.24)]" : ""}`}>
          2. Horario
        </span>
        <span className={`workspace-chip ${pasoActual === "datos" ? "ring-2 ring-[rgba(203,138,36,0.24)]" : ""}`}>
          3. Datos
        </span>
        <span className={`workspace-chip ${pasoActual === "pago" ? "ring-2 ring-[rgba(203,138,36,0.24)]" : ""}`}>
          4. Pago
        </span>
      </div>

      {error && (
        <div className="workspace-panel-soft border-red-200 bg-red-50/80 text-red-700">
          {error}
        </div>
      )}

      {info && <div className="workspace-panel-soft text-sm">{info}</div>}

      {pasoActual === "fecha" && (
        <div className="space-y-4">
          <div className="workspace-panel-soft space-y-2">
            <p className="font-medium">Elegí el día de tu sesión</p>
            <p className="workspace-inline-note">
              Vas a ver solamente los días en los que hay horarios disponibles.
            </p>
          </div>

          {fechasDisponibles.length === 0 && (
            <p className="workspace-inline-note">
              No hay fechas disponibles de Terapia en este momento.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {fechasDisponibles.map((fecha) => {
              const activa = fechaSeleccionada === fecha

              return (
                <button
                  key={fecha}
                  type="button"
                  onClick={() => {
                    setFechaSeleccionada(fecha)
                    setHorarioSeleccionadoId(null)
                    setPasoActual("horario")
                  }}
                  className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${
                    activa
                      ? "border-[var(--accent)] bg-[rgba(203,138,36,0.12)]"
                      : "border-[var(--line)] bg-[rgba(255,251,244,0.84)] hover:bg-[rgba(255,247,235,0.92)]"
                  }`}
                >
                  <p className="font-semibold text-gray-900">
                    {formatearFechaLarga(fecha)}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {pasoActual === "horario" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="font-medium">Elegí el horario</p>
              <p className="workspace-inline-note">
                Día seleccionado: {formatearFechaLarga(fechaSeleccionada)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setPasoActual("fecha")
                setHorarioSeleccionadoId(null)
              }}
              className="workspace-button-secondary"
            >
              Cambiar fecha
            </button>
          </div>

          {horariosDeFecha.length === 0 && (
            <p className="workspace-inline-note">
              No hay horarios disponibles para ese día.
            </p>
          )}

          <div className="space-y-3">
            {horariosDeFecha.map((item) => {
              const activo = horarioSeleccionadoId === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setHorarioSeleccionadoId(item.id)
                    setPasoActual("datos")
                  }}
                  className={`w-full rounded-[1.4rem] border px-4 py-4 text-left transition ${
                    activo
                      ? "border-[var(--accent)] bg-[rgba(203,138,36,0.12)]"
                      : "border-[var(--line)] bg-[rgba(255,251,244,0.84)] hover:bg-[rgba(255,247,235,0.92)]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-900">{item.hora}</p>
                      <p className="workspace-inline-note text-[var(--foreground)]">
                        {item.titulo} · {item.duracion} min
                      </p>
                    </div>

                    <span className="workspace-chip">
                      {item.requiere_pago ? `ARS ${item.precio}` : "Incluida"}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {pasoActual === "datos" && horarioSeleccionado && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="font-medium">Completá tus datos</p>
              <p className="workspace-inline-note">
                Estás reservando una sesión para el{" "}
                {formatearFechaLarga(horarioSeleccionado.fecha)}.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setPasoActual("horario")}
              className="workspace-button-secondary"
            >
              Cambiar horario
            </button>
          </div>

          <div className="workspace-panel-soft space-y-2">
            <p className="font-semibold text-gray-900">{horarioSeleccionado.titulo}</p>
            <p className="workspace-inline-note text-[var(--foreground)]">
              {formatearFechaLarga(horarioSeleccionado.fecha)} ·{" "}
              {horarioSeleccionado.hora} · {horarioSeleccionado.duracion} min
            </p>
            <p className="workspace-inline-note">
              {horarioSeleccionado.requiere_pago
                ? `Al continuar vas a reservar el horario y pasar al pago de la sesión por ARS ${horarioSeleccionado.precio}.`
                : "Al continuar, esta sesión quedará confirmada dentro de tu proceso activo."}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="workspace-field"
              placeholder="Nombre y apellido"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />

            <input
              className="workspace-field"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className="workspace-field md:col-span-2"
              placeholder="Teléfono (opcional)"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />

            <textarea
              className="workspace-field min-h-[120px] md:col-span-2"
              placeholder="Si querés, podés dejar una nota breve sobre esta sesión"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void continuar()}
              disabled={cargando}
              className="workspace-button-primary disabled:opacity-60"
            >
              {cargando
                ? "Procesando..."
                : horarioSeleccionado.requiere_pago
                  ? "Continuar al pago"
                  : "Confirmar sesión"}
            </button>

            <button
              type="button"
              onClick={reiniciarFlujo}
              disabled={cargando}
              className="workspace-button-secondary disabled:opacity-60"
            >
              Empezar de nuevo
            </button>
          </div>
        </div>
      )}

      {pasoActual === "pago" && horarioSeleccionado && reservaPendienteId && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="font-medium">Elegí cómo querés pagar</p>
              <p className="workspace-inline-note">
                La sesión queda pendiente hasta que el pago se apruebe.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setPasoActual("datos")}
              className="workspace-button-secondary"
            >
              Volver
            </button>
          </div>

          <div className="workspace-panel-soft space-y-2">
            <p className="font-semibold text-gray-900">{horarioSeleccionado.titulo}</p>
            <p className="workspace-inline-note text-[var(--foreground)]">
              {formatearFechaLarga(horarioSeleccionado.fecha)} ·{" "}
              {horarioSeleccionado.hora} · {horarioSeleccionado.duracion} min
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="workspace-panel-soft space-y-3">
              <div className="space-y-1">
                <p className="workspace-eyebrow">Transferencia</p>
                <h3 className="text-lg font-semibold">Enviar comprobante</h3>
              </div>

              <p>
                <strong>Monto:</strong>{" "}
                ARS {resumenMontos ? resumenMontos.montoTransferencia : horarioSeleccionado.precio}
              </p>

              <input
                ref={inputArchivoRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  setArchivoPendiente(file)
                  if (file) {
                    setInfo(
                      `Comprobante listo para enviar: ${file.name}. Tocá “Enviar comprobante” para terminar la carga.`
                    )
                  }
                  e.currentTarget.value = ""
                }}
              />

              {archivoPendiente ? (
                <p className="workspace-inline-note text-[var(--foreground)]">
                  Archivo seleccionado: <strong>{archivoPendiente.name}</strong>
                </p>
              ) : (
                <p className="workspace-inline-note">
                  Elegí el comprobante y luego envialo para revisión.
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => inputArchivoRef.current?.click()}
                  disabled={subiendoComprobante}
                  className="workspace-button-secondary disabled:opacity-60"
                >
                  Elegir comprobante
                </button>

                <button
                  type="button"
                  onClick={() => void enviarComprobante()}
                  disabled={subiendoComprobante || !archivoPendiente}
                  className="workspace-button-primary disabled:opacity-60"
                >
                  {subiendoComprobante ? "Enviando..." : "Enviar comprobante"}
                </button>
              </div>
            </div>

            <div className="workspace-panel-soft space-y-3">
              <div className="space-y-1">
                <p className="workspace-eyebrow">Mercado Pago</p>
                <h3 className="text-lg font-semibold">Pagar online</h3>
              </div>

              <p>
                <strong>Monto:</strong>{" "}
                ARS {resumenMontos ? resumenMontos.montoMercadoPago : horarioSeleccionado.precio}
              </p>

              {resumenMontos &&
                resumenMontos.porcentajeRecargoMercadoPago > 0 && (
                  <p className="workspace-inline-note">
                    Incluye un recargo del{" "}
                    <strong>{resumenMontos.porcentajeRecargoMercadoPago}%</strong>{" "}
                    por comisión de la plataforma.
                  </p>
                )}

              <button
                type="button"
                onClick={() => void pagarConMercadoPago()}
                disabled={cargando}
                className="workspace-button-primary disabled:opacity-60"
              >
                {cargando ? "Abriendo..." : "Pagar con Mercado Pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
