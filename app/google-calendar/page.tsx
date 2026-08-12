"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAppSession } from "@/components/auth/AppSessionProvider"

type GoogleCalendarStatus = {
  expectedAccount?: string | null
  connectedAccount?: string | null
  storedAccount?: string | null
  latestStoredAccount?: string | null
  connected?: boolean
  mismatch?: boolean
  hasRefreshToken?: boolean
  expiryDate?: string | null
  warning?: string | null
  error?: string
}

function formatearEstadoConexion(status: GoogleCalendarStatus | null) {
  if (!status) return "Desconocido"
  if (status.connected && !status.mismatch) return "Conectado"
  if (status.mismatch) return "Cuenta incorrecta conectada"
  return "Desconectado"
}

function formatearFecha(fecha?: string | null) {
  if (!fecha) return "Sin dato"

  const numero = Number(fecha)
  const date = Number.isFinite(numero) ? new Date(numero) : new Date(fecha)

  if (Number.isNaN(date.getTime())) {
    return fecha
  }

  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
}

export default function GoogleCalendarPage() {
  const { data: session, status } = useAppSession()
  const router = useRouter()
  const [googleStatus, setGoogleStatus] = useState<GoogleCalendarStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [statusError, setStatusError] = useState("")
  const [mensajeError, setMensajeError] = useState("")
  const [mensajeExito, setMensajeExito] = useState("")

  const esAdmin = session?.user?.role === "admin"

  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    setMensajeError(params.get("google_error") || "")
    setMensajeExito(params.get("google_success") || "")
  }, [])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
      return
    }

    if (status === "authenticated" && !esAdmin) {
      router.replace("/campus")
    }
  }, [esAdmin, router, status])

  useEffect(() => {
    if (status !== "authenticated" || !esAdmin) {
      return
    }

    let cancelled = false

    const cargarEstado = async () => {
      try {
        setLoadingStatus(true)
        setStatusError("")

        const res = await fetch("/api/google/status", {
          cache: "no-store",
        })
        const data = (await res.json()) as GoogleCalendarStatus

        if (!res.ok) {
          if (!cancelled) {
            setStatusError(data.error || "No se pudo cargar el estado de Google.")
          }
          return
        }

        if (!cancelled) {
          setGoogleStatus(data)
        }
      } catch {
        if (!cancelled) {
          setStatusError("No se pudo cargar el estado de Google.")
        }
      } finally {
        if (!cancelled) {
          setLoadingStatus(false)
        }
      }
    }

    void cargarEstado()

    return () => {
      cancelled = true
    }
  }, [esAdmin, status])

  const estadoConexion = useMemo(
    () => formatearEstadoConexion(googleStatus),
    [googleStatus]
  )

  if (status === "loading") {
    return (
      <main className="p-10 space-y-6">
        <h1 className="text-3xl font-bold">Google Calendar</h1>
        <section className="border rounded-xl p-4">
          <p>Cargando permisos...</p>
        </section>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="p-10 space-y-6">
        <section className="border rounded-xl p-4">
          <p>Necesitás iniciar sesión para continuar.</p>
        </section>
      </main>
    )
  }

  if (!esAdmin) {
    return (
      <main className="p-10 space-y-6">
        <section className="border rounded-xl p-4">
          <p>No tenés permisos para conectar Google Calendar.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="p-10 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Google Calendar</h1>
        <p>
          ENTHEOS usa una única cuenta explícita para crear y actualizar eventos.
        </p>
      </div>

      {mensajeExito && (
        <section className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
          {mensajeExito}
        </section>
      )}

      {mensajeError && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {mensajeError}
        </section>
      )}

      {statusError && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {statusError}
        </section>
      )}

      <section className="space-y-4 rounded-xl border p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500">
              Cuenta esperada
            </p>
            <p className="text-lg font-medium">
              {googleStatus?.expectedAccount || "No configurada"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500">
              Estado
            </p>
            <p className="text-lg font-medium">{loadingStatus ? "Cargando..." : estadoConexion}</p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500">
              Cuenta conectada realmente
            </p>
            <p className="text-lg font-medium">
              {googleStatus?.connectedAccount || "No conectada"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500">
              Refresh token
            </p>
            <p className="text-lg font-medium">
              {googleStatus?.hasRefreshToken ? "Disponible" : "No disponible"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500">
              Cuenta guardada en DB
            </p>
            <p className="text-lg font-medium">
              {googleStatus?.storedAccount || "Sin token exacto"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500">
              Vencimiento token
            </p>
            <p className="text-lg font-medium">
              {formatearFecha(googleStatus?.expiryDate)}
            </p>
          </div>
        </div>

        {googleStatus?.latestStoredAccount &&
          googleStatus.latestStoredAccount !== googleStatus.expectedAccount && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
              Hay tokens guardados para otra cuenta: {googleStatus.latestStoredAccount}.
            </div>
          )}

        {googleStatus?.warning && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            {googleStatus.warning}
          </div>
        )}

        <div className="pt-2">
          <a
            href="/api/google/auth"
            className="inline-block rounded bg-black px-4 py-2 text-white"
          >
            Reconectar Google Calendar
          </a>
        </div>
      </section>
    </main>
  )
}
