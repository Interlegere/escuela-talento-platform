"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { Session } from "next-auth"

type AppSessionStatus = "loading" | "authenticated" | "unauthenticated"

type AppSessionContextValue = {
  data: Session | null
  status: AppSessionStatus
  error: string | null
  refresh: () => Promise<Session | null>
}

const AppSessionContext = createContext<AppSessionContextValue | null>(null)

async function obtenerSesion(signal?: AbortSignal) {
  const res = await fetch("/api/session", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || "No se pudo obtener la sesión")
  }

  return data.session || null
}

export function AppSessionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [data, setData] = useState<Session | null>(null)
  const [status, setStatus] = useState<AppSessionStatus>("loading")
  const [error, setError] = useState<string | null>(null)
  const dataRef = useRef<Session | null>(null)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  const runRefresh = useCallback(async (background = false) => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    const hadSession = Boolean(dataRef.current)

    try {
      setError(null)
      if (!background || !hadSession) {
        setStatus("loading")
      }

      const session = await obtenerSesion(controller.signal)
      setData(session)
      setStatus(session ? "authenticated" : "unauthenticated")
      return session
    } catch (err: unknown) {
      const mensaje =
        err instanceof Error ? err.message : "No se pudo cargar la sesión."
      const nombre = err instanceof Error ? err.name : ""

      if (background && hadSession) {
        if (nombre !== "AbortError") {
          setError(mensaje)
        }
        return dataRef.current
      }

      setData(null)
      setStatus("unauthenticated")
      setError(
        nombre === "AbortError"
          ? "La sesión tardó demasiado en responder."
          : mensaje
      )
      return null
    } finally {
      window.clearTimeout(timeout)
    }
  }, [])

  const refresh = useCallback(async () => {
    return runRefresh(false)
  }, [runRefresh])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void runRefresh(true)
      }
    }

    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [runRefresh])

  const zonaSincronizadaRef = useRef(false)

  useEffect(() => {
    if (status !== "authenticated" || zonaSincronizadaRef.current) {
      return
    }

    zonaSincronizadaRef.current = true

    try {
      const zonaHoraria = Intl.DateTimeFormat().resolvedOptions().timeZone

      if (zonaHoraria) {
        void fetch("/api/me/zona-horaria", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zonaHoraria }),
        }).catch(() => {})
      }
    } catch {
      // Sin soporte de Intl.DateTimeFormat: no bloquea el resto de la app.
    }
  }, [status])

  const value = useMemo(
    () => ({
      data,
      status,
      error,
      refresh,
    }),
    [data, status, error, refresh]
  )

  return (
    <AppSessionContext.Provider value={value}>
      {children}
    </AppSessionContext.Provider>
  )
}

export function useAppSession() {
  const context = useContext(AppSessionContext)

  if (!context) {
    throw new Error("useAppSession debe usarse dentro de AppSessionProvider")
  }

  return context
}
