"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAppSession } from "@/components/auth/AppSessionProvider"

type Perfil = {
  id: string | null
  nombre: string
  apellido?: string | null
  email: string
  whatsapp?: string | null
  fecha_cumpleanos?: string | null
  role: string
  activo: boolean
}

type FormState = {
  nombre: string
  apellido: string
  whatsapp: string
  fechaCumpleanos: string
}

export default function PerfilPage() {
  const { status } = useAppSession()
  const router = useRouter()

  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [editable, setEditable] = useState(false)
  const [form, setForm] = useState<FormState>({
    nombre: "",
    apellido: "",
    whatsapp: "",
    fechaCumpleanos: "",
  })
  const [mensaje, setMensaje] = useState("")
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [googleConectado, setGoogleConectado] = useState<boolean | null>(null)
  const [googleMensaje, setGoogleMensaje] = useState("")
  const [desconectandoGoogle, setDesconectandoGoogle] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [router, status])

  const cargarPerfil = useCallback(async () => {
    try {
      setCargando(true)
      setMensaje("")

      const res = await fetch("/api/me/perfil", { cache: "no-store" })
      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudo cargar tu perfil.")
        return
      }

      const perfilData = data.perfil as Perfil
      setPerfil(perfilData)
      setEditable(Boolean(data.editable))
      setForm({
        nombre: perfilData.nombre || "",
        apellido: perfilData.apellido || "",
        whatsapp: perfilData.whatsapp || "",
        fechaCumpleanos: perfilData.fecha_cumpleanos || "",
      })
    } catch {
      setMensaje("Error cargando tu perfil.")
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated") {
      void cargarPerfil()
    }
  }, [cargarPerfil, status])

  const cargarEstadoGoogle = useCallback(async () => {
    try {
      const res = await fetch("/api/google/participante/estado", { cache: "no-store" })
      const data = await res.json()
      setGoogleConectado(res.ok ? Boolean(data.conectado) : false)
    } catch {
      setGoogleConectado(false)
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated") {
      void cargarEstadoGoogle()
    }
  }, [cargarEstadoGoogle, status])

  // El callback de Google vuelve acá con ?google_success=...&google_error=...
  // en la URL — se lee directo de window.location en vez de useSearchParams
  // para no tener que envolver toda la página en Suspense por esto solo.
  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const success = params.get("google_success")
    const error = params.get("google_error")

    if (success) setGoogleMensaje(success)
    if (error) setGoogleMensaje(error)

    if (success || error) {
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  const desconectarGoogle = async () => {
    try {
      setDesconectandoGoogle(true)
      setGoogleMensaje("")

      const res = await fetch("/api/google/participante/desconectar", { method: "POST" })

      if (!res.ok) {
        setGoogleMensaje("No se pudo desconectar Google Calendar.")
        return
      }

      setGoogleConectado(false)
      setGoogleMensaje("Se desconectó tu Google Calendar.")
    } catch {
      setGoogleMensaje("Error desconectando Google Calendar.")
    } finally {
      setDesconectandoGoogle(false)
    }
  }

  const guardarPerfil = async () => {
    try {
      setGuardando(true)
      setMensaje("")

      const res = await fetch("/api/me/perfil", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudo guardar tu perfil.")
        return
      }

      setPerfil(data.perfil)
      setMensaje("Perfil actualizado.")
    } catch {
      setMensaje("Error guardando tu perfil.")
    } finally {
      setGuardando(false)
    }
  }

  if (status === "loading" || cargando) {
    return <main className="workspace-shell">Cargando perfil...</main>
  }

  return (
    <main className="workspace-shell space-y-6">
      <section className="workspace-hero">
        <div className="relative z-10 max-w-3xl space-y-4">
          <p className="workspace-eyebrow">Configuración</p>
          <h1 className="workspace-title">Mi perfil</h1>
          <p className="workspace-subtitle">
            Actualizá tus datos básicos de contacto. La fecha de cumpleaños se
            integra a la agenda general de la escuela para que no pase
            desapercibida.
          </p>
        </div>
      </section>

      {mensaje && <section className="workspace-panel-soft">{mensaje}</section>}

      {!editable && (
        <section className="workspace-panel-soft">
          Este usuario todavía es de prueba. Para editar el perfil completo,
          crealo primero desde Admin Usuarios.
        </section>
      )}

      <section className="workspace-panel space-y-4">
        <div className="space-y-1">
          <p className="workspace-eyebrow">Datos personales</p>
          <h2 className="workspace-title-sm">{perfil?.email}</h2>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Nombre</span>
            <input
              className="workspace-field"
              value={form.nombre}
              disabled={!editable}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, nombre: e.target.value }))
              }
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Apellido</span>
            <input
              className="workspace-field"
              value={form.apellido}
              disabled={!editable}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, apellido: e.target.value }))
              }
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">WhatsApp</span>
            <input
              className="workspace-field"
              value={form.whatsapp}
              disabled={!editable}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, whatsapp: e.target.value }))
              }
              placeholder="+54 9 ..."
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">
              Fecha de cumpleaños
            </span>
            <input
              className="workspace-field"
              type="date"
              value={form.fechaCumpleanos}
              disabled={!editable}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  fechaCumpleanos: e.target.value,
                }))
              }
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void guardarPerfil()}
            disabled={!editable || guardando}
            className="workspace-button-primary disabled:opacity-60"
          >
            {guardando ? "Guardando..." : "Guardar perfil"}
          </button>
        </div>
      </section>

      <section className="workspace-panel space-y-3">
        <div className="space-y-1">
          <p className="workspace-eyebrow">Calendario</p>
          <h2 className="workspace-title-sm">Google Calendar</h2>
          <p className="text-sm text-gray-600">
            Conectá tu Google Calendar para que tus tareas de Entusiasmento con
            fecha y hora aparezcan solas en tu calendario, sin tener que
            aceptar nada por mail.
          </p>
        </div>

        {googleMensaje && (
          <p className="text-sm text-gray-700">{googleMensaje}</p>
        )}

        {googleConectado === null ? (
          <p className="text-sm text-gray-500">Revisando conexión...</p>
        ) : googleConectado ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-emerald-700">✓ Conectado</span>
            <button
              type="button"
              onClick={() => void desconectarGoogle()}
              disabled={desconectandoGoogle}
              className="text-sm text-gray-500 underline disabled:opacity-60"
            >
              {desconectandoGoogle ? "Desconectando..." : "Desconectar"}
            </button>
          </div>
        ) : (
          <a href="/api/google/participante/auth" className="workspace-button-primary inline-block">
            Conectar con Google
          </a>
        )}
      </section>
    </main>
  )
}

