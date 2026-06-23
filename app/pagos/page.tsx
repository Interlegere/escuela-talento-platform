"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import PagoReservaTerapiaCard from "@/components/pagos/PagoReservaTerapiaCard"
import PagoMensualCard from "@/components/pagos/PagoMensualCard"
import { useAppSession } from "@/components/auth/AppSessionProvider"
import { etiquetaModalidadPago, type BillingMode } from "@/lib/billing"

type HonorarioAsignado = {
  id: number
  actividadSlug: string
  actividadNombre: string
  actividadDescripcion?: string
  participanteNombre: string
  participanteEmail: string
  honorarioMensual: string | number
  modalidadPago: BillingMode
  moneda: string
  economia?: {
    modalidad: string
    estado: string
    requierePago: boolean
    accesoEconomicoHabilitado: boolean
    detalle: string
  } | null
}

type RetornoMercadoPago = {
  status: "success" | "failure" | "pending"
  pagoMensualId?: number | null
  reservaId?: number | null
  paymentId?: string | null
  collectionId?: string | null
} | null

type TerapiaPendiente = {
  id: string | number
  reservaId?: number | null
  titulo: string
  fecha: string
  hora: string
  duracion: string
  estado: string
  montoTransferencia?: string | null
  montoMercadoPago?: string | null
  porcentajeRecargoMercadoPago?: number | null
  comprobanteNombreArchivo?: string | null
}

function formatearFecha(fecha?: string | null) {
  if (!fecha) return ""

  const d = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(d.getTime())) return fecha

  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export default function PagosPage() {
  const { data: session, status, error } = useAppSession()
  const [honorarios, setHonorarios] = useState<HonorarioAsignado[]>([])
  const [sesionesTerapiaPendientes, setSesionesTerapiaPendientes] = useState<
    TerapiaPendiente[]
  >([])
  const [cargandoHonorarios, setCargandoHonorarios] = useState(false)
  const [cargandoSesionesTerapia, setCargandoSesionesTerapia] = useState(false)
  const [mensaje, setMensaje] = useState("")
  const [retornoMercadoPago, setRetornoMercadoPago] =
    useState<RetornoMercadoPago>(null)

  const nombre = session?.user?.name || "Participante"
  const email = session?.user?.email || ""
  const esAdmin = session?.user?.role === "admin"
  const retornoPagoMensual = retornoMercadoPago?.pagoMensualId
    ? {
        status: retornoMercadoPago.status,
        pagoMensualId: retornoMercadoPago.pagoMensualId,
      }
    : null
  const retornoReservaTerapia = retornoMercadoPago?.reservaId
    ? {
        status: retornoMercadoPago.status,
        reservaId: retornoMercadoPago.reservaId,
        paymentId: retornoMercadoPago.paymentId,
        collectionId: retornoMercadoPago.collectionId,
      }
    : null

  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const statusParam = params.get("mp_status")
    const pagoMensualId = Number(params.get("pago_mensual_id"))
    const reservaId = Number(params.get("reserva_id"))
    const paymentId = params.get("payment_id")
    const collectionId = params.get("collection_id")

    if (
      (statusParam === "success" ||
        statusParam === "failure" ||
        statusParam === "pending") &&
      ((!Number.isNaN(pagoMensualId) && pagoMensualId > 0) ||
        (!Number.isNaN(reservaId) && reservaId > 0))
    ) {
      setRetornoMercadoPago({
        status: statusParam,
        pagoMensualId:
          !Number.isNaN(pagoMensualId) && pagoMensualId > 0
            ? pagoMensualId
            : null,
        reservaId:
          !Number.isNaN(reservaId) && reservaId > 0 ? reservaId : null,
        paymentId: paymentId || null,
        collectionId: collectionId || null,
      })

      const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`
      window.history.replaceState({}, "", cleanUrl)
    }
  }, [])

  const cargarHonorarios = async () => {
    try {
      setCargandoHonorarios(true)
      setMensaje("")

      const res = await fetch("/api/pagos-mensuales/honorarios")
      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudieron cargar tus actividades asignadas.")
        return
      }

      setHonorarios(data.honorarios || [])
    } catch {
      setMensaje("Error cargando tus actividades asignadas.")
    } finally {
      setCargandoHonorarios(false)
    }
  }

  const cargarSesionesTerapia = async (force = false) => {
    const tieneTerapiaPorSesion = honorarios.some(
      (item) =>
        item.actividadSlug === "terapia" &&
        (item.economia?.modalidad === "sesion" || item.modalidadPago === "sesion")
    )

    if (!force && !tieneTerapiaPorSesion) {
      setSesionesTerapiaPendientes([])
      setCargandoSesionesTerapia(false)
      return
    }

    try {
      setCargandoSesionesTerapia(true)

      const res = await fetch("/api/espacios/resumen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividadSlug: "terapia",
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSesionesTerapiaPendientes([])
        return
      }

      const pendientes = Array.isArray(data.encuentros)
        ? data.encuentros.filter(
            (item: TerapiaPendiente) =>
              item.estado === "pendiente_pago" && Boolean(item.reservaId)
          )
        : []

      setSesionesTerapiaPendientes(pendientes)
    } catch {
      setSesionesTerapiaPendientes([])
    } finally {
      setCargandoSesionesTerapia(false)
    }
  }

  useEffect(() => {
    if (status !== "authenticated" || esAdmin) return
    void cargarHonorarios()
  }, [esAdmin, status])

  useEffect(() => {
    if (status !== "authenticated" || esAdmin) return
    void cargarSesionesTerapia()
  }, [esAdmin, honorarios, status])

  useEffect(() => {
    if (
      status !== "authenticated" ||
      esAdmin ||
      !retornoReservaTerapia
    ) {
      return
    }

    const reconciliarReserva = async () => {
      if (retornoReservaTerapia.status === "failure") {
        setMensaje("El pago no se completó. Podés intentar nuevamente.")
        await cargarSesionesTerapia(true)
        return
      }

      if (retornoReservaTerapia.status === "pending") {
        setMensaje(
          "Pago pendiente. Estamos esperando confirmación de Mercado Pago."
        )
        await cargarSesionesTerapia(true)
        return
      }

      try {
        setMensaje("Verificando el pago de tu sesión en Mercado Pago...")

        const res = await fetch("/api/reservas/reconciliar-mp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reservaId: retornoReservaTerapia.reservaId,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          setMensaje(
            data.error ||
              "No pudimos verificar automáticamente el pago de tu sesión. Intentá refrescar en unos minutos."
          )
          return
        }

        if (data.estado === "confirmada") {
          setMensaje("Pago aprobado. Tu sesión fue habilitada.")
        } else if (data.mpStatus === "approved") {
          setMensaje(
            "Pago aprobado. Estamos terminando de habilitar tu sesión."
          )
        } else if (data.mpStatus === "pending") {
          setMensaje(
            "Pago pendiente. Estamos esperando confirmación de Mercado Pago."
          )
        } else {
          setMensaje("El pago no se completó. Podés intentar nuevamente.")
        }
      } catch {
        setMensaje(
          "Error verificando el pago de tu sesión. Intentá refrescar en unos minutos."
        )
      } finally {
        await cargarHonorarios()
        await cargarSesionesTerapia(true)
      }
    }

    void reconciliarReserva()
  }, [esAdmin, retornoReservaTerapia, status])

  if (status === "loading") {
    return (
      <main className="p-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pagos</h1>
          <p className="text-gray-600 mt-2">Cargando tu información de pagos...</p>
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="p-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pagos</h1>
          <p className="text-gray-600 mt-2">Necesitás iniciar sesión para continuar.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </main>
    )
  }

  if (esAdmin) {
    return (
      <main className="p-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pagos</h1>
          <p className="text-gray-600 mt-2">
            Como administrador, la gestión de pagos se realiza desde Admin Pagos.
          </p>
        </div>

        <section className="border rounded-xl p-6 space-y-3">
          <a
            href="/admin/pagos"
            className="inline-block border px-4 py-2 rounded-xl"
          >
            Ir a Admin Pagos
          </a>
        </section>
      </main>
    )
  }

  return (
    <main className="p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pagos</h1>
        <p className="text-gray-600 mt-2">Gestioná pagos y habilitaciones.</p>
      </div>

      {mensaje && (
        <section className="border rounded-xl p-4">
          <p>{mensaje}</p>
        </section>
      )}

      {cargandoHonorarios && (
        <section className="border rounded-xl p-4">
          <p>Cargando actividades asignadas...</p>
        </section>
      )}

      {!cargandoHonorarios && honorarios.length === 0 && !mensaje && (
        <section className="border rounded-xl p-4">
          <p>Todavía no tenés actividades asignadas para pagar.</p>
        </section>
      )}

      {(cargandoSesionesTerapia || sesionesTerapiaPendientes.length > 0) && (
        <section className="workspace-panel space-y-4">
          <div>
            <p className="workspace-eyebrow">Terapia</p>
            <h2 className="workspace-title-sm mt-2">Sesiones pendientes de pago</h2>
            <p className="workspace-inline-note mt-2">
              Estas sesiones ya fueron asignadas desde Agenda. Podés pagar cada una
              sin reservar una fecha nueva.
            </p>
          </div>

          {cargandoSesionesTerapia && (
            <p className="workspace-inline-note">
              Cargando sesiones pendientes...
            </p>
          )}

          {!cargandoSesionesTerapia &&
            sesionesTerapiaPendientes.map((sesion) => (
              <div key={sesion.id} className="workspace-panel-soft space-y-3">
                <div className="space-y-1">
                  <p className="font-semibold">{sesion.titulo || "Sesión de Terapia"}</p>
                  <p className="workspace-inline-note">
                    {formatearFecha(sesion.fecha)} · {sesion.hora} · {sesion.duracion} min
                  </p>
                </div>

                {sesion.reservaId ? (
                  <PagoReservaTerapiaCard
                    reservaId={sesion.reservaId}
                    montoTransferencia={sesion.montoTransferencia}
                    montoMercadoPago={sesion.montoMercadoPago}
                    porcentajeRecargoMercadoPago={
                      sesion.porcentajeRecargoMercadoPago
                    }
                    comprobanteNombreArchivo={sesion.comprobanteNombreArchivo}
                    onActualizado={() => cargarSesionesTerapia(true)}
                  />
                ) : null}
              </div>
            ))}
        </section>
      )}

      <div className="space-y-6">
        {honorarios.map((actividad) => (
          (actividad.economia?.modalidad === "sesion" ||
            actividad.modalidadPago === "sesion") ? (
            <section key={actividad.id} className="workspace-panel space-y-4">
              <div>
                <p className="workspace-eyebrow">
                  {etiquetaModalidadPago(actividad.modalidadPago, actividad.actividadSlug)}
                </p>
                <h2 className="workspace-title-sm mt-2">{actividad.actividadNombre}</h2>
                <p className="workspace-inline-note mt-2">
                  Esta actividad se abona encuentro por encuentro.
                </p>
              </div>

              <p>
                <strong>Valor por sesión:</strong> {actividad.moneda} {actividad.honorarioMensual}
              </p>
              <p className="workspace-inline-note">
                {sesionesTerapiaPendientes.length > 0
                  ? "Las sesiones pendientes ya aparecen arriba para que puedas pagarlas sin reservar otra fecha."
                  : "Cuando te asignen una sesión o reserves un encuentro nuevo, el pago por sesión va a aparecer acá automáticamente."}
              </p>
            </section>
          ) : (
            <PagoMensualCard
              key={actividad.id}
              actividadSlug={actividad.actividadSlug}
              participanteNombre={actividad.participanteNombre || nombre}
              participanteEmail={actividad.participanteEmail || email}
              modalidadPago={actividad.modalidadPago}
              retornoMercadoPago={retornoPagoMensual}
            />
          )
        ))}
      </div>

      <section className="border rounded-2xl p-6 space-y-3">
        <h2 className="text-lg font-semibold">Accesos rápidos</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/campus" className="rounded-xl border px-4 py-2">
            Ir a Campus
          </Link>
          <Link href="/terapia" className="rounded-xl border px-4 py-2">
            Ir a Terapia
          </Link>
          <Link href="/mentorias" className="rounded-xl border px-4 py-2">
            Ir a Mentorías
          </Link>
        </div>
      </section>
    </main>
  )
}
