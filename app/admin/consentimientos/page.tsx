"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAppSession } from "@/components/auth/AppSessionProvider"

type ConsentimientoItem = {
  id: string
  user_email: string
  actividad: string
  version: string
  disponibilidad_id?: number | null
  fecha_encuentro?: string | null
  hora_encuentro?: string | null
  created_at: string
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

export default function AdminConsentimientosPage() {
  const { data: session, status } = useAppSession()
  const router = useRouter()
  const [actividad, setActividad] = useState("")
  const [usuario, setUsuario] = useState("")
  const [consentimientos, setConsentimientos] = useState<ConsentimientoItem[]>([])
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState("")

  const esAdmin = session?.user?.role === "admin"

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [router, status])

  const cargar = useCallback(async () => {
    try {
      setCargando(true)
      setMensaje("")

      const params = new URLSearchParams()

      if (actividad) {
        params.set("actividad", actividad)
      }

      if (usuario.trim()) {
        params.set("usuario", usuario.trim())
      }

      const url = params.toString()
        ? `/api/admin/consentimientos/listar?${params.toString()}`
        : "/api/admin/consentimientos/listar"

      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
      })

      const data = await leerJson<{
        consentimientos?: ConsentimientoItem[]
        error?: string
      }>(res)

      if (!res.ok) {
        setMensaje(data.error || "No se pudieron cargar los consentimientos.")
        return
      }

      setConsentimientos(data.consentimientos || [])
    } catch {
      setMensaje("Error cargando consentimientos.")
    } finally {
      setCargando(false)
    }
  }, [actividad, usuario])

  useEffect(() => {
    if (status !== "authenticated" || !esAdmin) return
    void cargar()
  }, [status, esAdmin, cargar])

  const formatearFechaHora = (fecha?: string) => {
    if (!fecha) return ""

    const d = new Date(fecha)
    if (Number.isNaN(d.getTime())) return fecha

    return d.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatearEncuentro = (fecha?: string | null, hora?: string | null) => {
    if (!fecha) return hora || "-"

    const d = new Date(`${fecha}T00:00:00`)
    if (Number.isNaN(d.getTime())) return `${fecha}${hora ? ` · ${hora}` : ""}`

    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) + (hora ? ` · ${hora}` : "")
  }

  if (status === "loading") {
    return (
      <main className="p-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Administración de consentimientos</h1>
          <p className="text-gray-600 mt-2">Preparando acceso de administración...</p>
        </div>

        <section className="border rounded-xl p-4">
          <p>Cargando sesión...</p>
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
          <p>No tenés permisos para acceder a esta sección.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Administración de consentimientos</h1>
        <p className="text-gray-600 mt-2">
          Revisá los consentimientos aceptados por actividad y usuario.
        </p>
      </div>

      <section className="border rounded-2xl p-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <select
            className="border rounded-xl p-3"
            value={actividad}
            onChange={(e) => setActividad(e.target.value)}
          >
            <option value="">Todas las actividades</option>
            <option value="casatalentos">CasaTalentos</option>
            <option value="conectando-sentidos">Conectando Sentidos</option>
            <option value="mentorias">Mentoría</option>
            <option value="terapia">Terapia</option>
          </select>

          <input
            className="border rounded-xl p-3"
            placeholder="Filtrar por email"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />

          <button
            type="button"
            onClick={() => void cargar()}
            disabled={cargando}
            className="rounded-xl bg-black px-4 py-3 text-white disabled:opacity-60"
          >
            {cargando ? "Buscando..." : "Aplicar filtros"}
          </button>
        </div>
      </section>

      {mensaje && <section className="border rounded-xl p-4">{mensaje}</section>}

      <section className="border rounded-2xl p-5 space-y-4">
        {cargando && consentimientos.length === 0 && <p>Cargando consentimientos...</p>}

        {!cargando && consentimientos.length === 0 && (
          <p className="text-gray-600">No hay consentimientos registrados.</p>
        )}

        {consentimientos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-3 py-3 font-semibold">Usuario</th>
                  <th className="px-3 py-3 font-semibold">Actividad</th>
                  <th className="px-3 py-3 font-semibold">Encuentro</th>
                  <th className="px-3 py-3 font-semibold">Versión</th>
                  <th className="px-3 py-3 font-semibold">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {consentimientos.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-3 py-3">{item.user_email}</td>
                    <td className="px-3 py-3">{item.actividad}</td>
                    <td className="px-3 py-3">
                      <div className="space-y-1">
                        <p>{formatearEncuentro(item.fecha_encuentro, item.hora_encuentro)}</p>
                        <p className="text-xs text-gray-500">
                          ID: {item.disponibilidad_id ?? "-"}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-3">{item.version}</td>
                    <td className="px-3 py-3">
                      {formatearFechaHora(item.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
