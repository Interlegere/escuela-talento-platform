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
    </main>
  )
}

