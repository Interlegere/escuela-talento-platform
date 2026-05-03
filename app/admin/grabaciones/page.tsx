"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppSession } from "@/components/auth/AppSessionProvider"

export default function AdminGrabacionesPage() {
  const { data: session, status } = useAppSession()
  const router = useRouter()
  const esAdmin = session?.user?.role === "admin"

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [router, status])

  if (status === "loading") {
    return (
      <main className="p-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Grabaciones</h1>
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
        <h1 className="text-3xl font-bold">Admin de grabaciones</h1>
        <p className="text-gray-600 mt-2">
          Este panel quedó como acceso legado. La gestión activa de grabaciones ya
          está integrada dentro de cada actividad.
        </p>
      </div>

      <section className="border rounded-2xl p-6 space-y-4">
        <p className="text-sm text-gray-700">
          Para administrar grabaciones ahora usá estas secciones:
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <a
            href="/admin/casatalentos"
            className="block rounded-2xl border bg-white p-5 transition hover:bg-gray-50"
          >
            <h2 className="text-lg font-semibold">Admin CT</h2>
            <p className="mt-2 text-sm text-gray-600">
              Referentes, dispositivo y grabaciones de CasaTalentos.
            </p>
          </a>

          <a
            href="/admin/conectando-sentidos"
            className="block rounded-2xl border bg-white p-5 transition hover:bg-gray-50"
          >
            <h2 className="text-lg font-semibold">Admin CS</h2>
            <p className="mt-2 text-sm text-gray-600">
              Sesión, mensajes y grabaciones de Conectando Sentidos.
            </p>
          </a>
        </div>
      </section>
    </main>
  )
}
