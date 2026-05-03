"use client"

import { useEffect, useMemo, useState } from "react"
import type { DisponibilidadAgenda } from "@/components/agenda/types"
import ReservaTerapiaFlow from "@/components/agenda/ReservaTerapiaFlow"
import { useAppSession } from "@/components/auth/AppSessionProvider"

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

export default function ReservaTerapiaSection() {
  const { data: session } = useAppSession()
  const [cargando, setCargando] = useState(true)
  const [mensajeError, setMensajeError] = useState("")
  const [disponibilidades, setDisponibilidades] = useState<DisponibilidadAgenda[]>([])

  const nombre = session?.user?.name || "Participante"
  const email = session?.user?.email || ""
  const esAdmin = session?.user?.role === "admin"

  const disponibilidadesTerapia = useMemo(() => {
    return disponibilidades.filter(
      (item) =>
        item.actividad_slug === "terapia" &&
        item.modo === "disponibilidad" &&
        item.estado === "disponible"
    )
  }, [disponibilidades])

  const cargarDisponibilidades = async () => {
    try {
      setCargando(true)
      setMensajeError("")

      const res = await fetch("/api/agenda/listar", {
        method: "GET",
        cache: "no-store",
      })

      const data = await leerJson<{
        disponibilidades?: Array<DisponibilidadAgenda & { actividad_slug?: string | null }>
        error?: string
      }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudieron cargar las disponibilidades.")
        return
      }

      setDisponibilidades((data.disponibilidades || []) as DisponibilidadAgenda[])
    } catch {
      setMensajeError("Error cargando las disponibilidades de Terapia.")
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (!session || esAdmin) {
      setCargando(false)
      return
    }

    void cargarDisponibilidades()
  }, [esAdmin, session])

  if (!session || esAdmin) {
    return null
  }

  return (
    <section className="space-y-4">
      <div className="border rounded-xl p-4 space-y-2">
        <h2 className="text-lg font-semibold">Agendar sesión</h2>
        <p className="text-sm text-gray-600">
          Elegí la fecha, después el horario y completá la reserva desde este
          mismo espacio, paso a paso.
        </p>
      </div>

      {cargando && (
        <section className="border rounded-xl p-4">
          <p>Cargando horarios disponibles...</p>
        </section>
      )}

      {!cargando && mensajeError && (
        <section className="border rounded-xl p-4 text-red-600">
          {mensajeError}
        </section>
      )}

      {!cargando && !mensajeError && disponibilidadesTerapia.length === 0 && (
        <section className="border rounded-xl p-4">
          <p>No hay horarios disponibles de Terapia en este momento.</p>
        </section>
      )}

      {!cargando && !mensajeError && disponibilidadesTerapia.length > 0 && (
        <ReservaTerapiaFlow
          disponibilidades={disponibilidadesTerapia}
          nombreInicial={nombre}
          emailInicial={email}
          onReservaExitosa={cargarDisponibilidades}
        />
      )}
    </section>
  )
}
