"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import PagoPendienteItem from "@/components/pagos/PagoPendienteItem"
import { useAppSession } from "@/components/auth/AppSessionProvider"
import { type BillingMode } from "@/lib/billing"
import {
  agruparPagoUiItems,
  crearPagoUiDesdeActividad,
  crearPagoUiDesdeTerapia,
  type PagoUiItem,
} from "@/lib/payment-ui"

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
    periodo?: string | null
    pagoMensualId?: number | null
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
  mpStatus?: string | null
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
  const [sesionesTerapia, setSesionesTerapia] = useState<TerapiaPendiente[]>([])
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
      setSesionesTerapia([])
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
        setSesionesTerapia([])
        return
      }

      const encuentros = Array.isArray(data.encuentros)
        ? data.encuentros.filter(
            (item: TerapiaPendiente) => Boolean(item.reservaId)
          )
        : []

      setSesionesTerapia(encuentros)
    } catch {
      setSesionesTerapia([])
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
            Como administrador, la gestión de pagos se realiza desde Admin Usuarios.
          </p>
        </div>

        <section className="border rounded-xl p-6 space-y-3">
          <a
            href="/admin/usuarios"
            className="inline-block border px-4 py-2 rounded-xl"
          >
            Ir a Admin Usuarios
          </a>
        </section>
      </main>
    )
  }

  const itemsActividad = honorarios
    .map((item) => crearPagoUiDesdeActividad(item))
    .filter((item): item is PagoUiItem => Boolean(item))

  const itemsTerapia = sesionesTerapia
    .map((item) => crearPagoUiDesdeTerapia(item))
    .filter((item): item is PagoUiItem => Boolean(item))

  const pagosUi = agruparPagoUiItems([...itemsActividad, ...itemsTerapia])
  const sinMovimientos =
    pagosUi.pendientes.length === 0 &&
    pagosUi.enRevision.length === 0 &&
    pagosUi.resueltos.length === 0
  const hayPendientes =
    pagosUi.pendientes.length > 0 || pagosUi.enRevision.length > 0

  return (
    <main className="p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pagos</h1>
        <p className="text-gray-600 mt-2">
          Revisá qué tenés pendiente, qué estamos verificando y qué ya quedó resuelto.
        </p>
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

      {cargandoSesionesTerapia && (
        <section className="workspace-panel space-y-4">
          <p className="workspace-inline-note">Cargando sesiones vinculadas...</p>
        </section>
      )}

      {!cargandoHonorarios && !sinMovimientos && pagosUi.pendientes.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="workspace-eyebrow">Acción principal</p>
            <h2 className="workspace-title-sm mt-2">
              Pagos pendientes
            </h2>
            <p className="workspace-inline-note mt-2">
              {pagosUi.pendientes.length === 1
                ? "Tenés 1 pago pendiente."
                : `Tenés ${pagosUi.pendientes.length} pagos pendientes.`}
            </p>
          </div>

          {pagosUi.pendientes.map((item) => (
            <PagoPendienteItem
              key={item.id}
              item={item}
              retornoMercadoPago={retornoPagoMensual}
              onActualizado={() => cargarSesionesTerapia(true)}
            />
          ))}
        </section>
      )}

      {!cargandoHonorarios && pagosUi.enRevision.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="workspace-eyebrow">Seguimiento</p>
            <h2 className="workspace-title-sm mt-2">
              Estamos verificando tu pago
            </h2>
            <p className="workspace-inline-note mt-2">
              Recibimos tu comprobante. Te avisaremos cuando se habilite.
            </p>
          </div>

          {pagosUi.enRevision.map((item) => (
            <PagoPendienteItem key={item.id} item={item} />
          ))}
        </section>
      )}

      {!cargandoHonorarios && sinMovimientos && (
        <section className="workspace-panel space-y-4">
          <div>
            <p className="workspace-eyebrow">Todo al día</p>
            <h2 className="workspace-title-sm mt-2">
              No tenés pagos pendientes
            </h2>
            <p className="workspace-inline-note mt-2">
              Cuando se genere un nuevo pago o una sesión para abonar, lo vas a ver acá.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/campus" className="workspace-button-secondary">
              Ir a Campus
            </Link>
          </div>
        </section>
      )}

      {!cargandoHonorarios && pagosUi.resueltos.length > 0 && (
        <details className="workspace-panel">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="workspace-eyebrow">Secundario</p>
                <h2 className="workspace-title-sm mt-2">Historial</h2>
              </div>
              <span className="workspace-chip">
                {pagosUi.resueltos.length} resuelto/s
              </span>
            </div>
          </summary>

          <div className="mt-5 space-y-4">
            {pagosUi.resueltos.map((item) => (
              <PagoPendienteItem key={item.id} item={item} />
            ))}
          </div>
        </details>
      )}

      {hayPendientes && (
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
      )}
    </main>
  )
}
