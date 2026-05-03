"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppSession } from "@/components/auth/AppSessionProvider"

export default function GoogleCalendarPage() {
  const { data: session, status } = useAppSession()
  const router = useRouter()

  const esAdmin = session?.user?.role === "admin"

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
      return
    }

    if (status === "authenticated" && !esAdmin) {
      router.replace("/campus")
    }
  }, [esAdmin, router, status])

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
      <h1 className="text-3xl font-bold">Google Calendar</h1>

      <p>
        Conectá tu cuenta de Google para que la plataforma pueda crear y
        actualizar eventos automáticamente.
      </p>

      <a
        href="/api/google/auth"
        className="inline-block bg-black text-white px-4 py-2 rounded"
      >
        Conectar Google Calendar
      </a>
    </main>
  )
}
