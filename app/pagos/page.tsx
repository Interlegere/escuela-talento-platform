"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
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
}

export default function PagosPage() {
  const { data: session, status, error } = useAppSession()
  const [honorarios, setHonorarios] = useState<HonorarioAsignado[]>([])
  const [cargandoHonorarios, setCargandoHonorarios] = useState(false)
  const [mensaje, setMensaje] = useState("")

  const nombre = session?.user?.name || "Participante"
  const email = session?.user?.email || ""
  const esAdmin = session?.user?.role === "admin"

  useEffect(() => {
    if (status !== "authenticated" || esAdmin) return

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

    void cargarHonorarios()
  }, [esAdmin, status])

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

      <div className="space-y-6">
        {honorarios.map((actividad) => (
          actividad.modalidadPago === "sesion" ? (
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
                El pago de Terapia por sesión se gestiona al reservar cada encuentro, no desde esta tarjeta general.
              </p>
            </section>
          ) : (
            <PagoMensualCard
              key={actividad.id}
              actividadSlug={actividad.actividadSlug}
              participanteNombre={actividad.participanteNombre || nombre}
              participanteEmail={actividad.participanteEmail || email}
              modalidadPago={actividad.modalidadPago}
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
