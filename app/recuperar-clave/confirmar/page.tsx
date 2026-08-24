"use client"

import Link from "next/link"
import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function ConfirmarClaveFallback() {
  return (
    <main className="flex items-center justify-center h-screen">
      <div className="border p-8 rounded-xl w-80 space-y-4">
        <h1 className="text-2xl font-bold text-center">Elegir clave nueva</h1>
        <p className="text-sm text-gray-600 text-center">Cargando...</p>
      </div>
    </main>
  )
}

function ConfirmarClaveContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""

  const [password, setPassword] = useState("")
  const [confirmacion, setConfirmacion] = useState("")
  const [ok, setOk] = useState(false)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!token) {
      setError("Este link no es válido. Pedí uno nuevo desde la pantalla de recuperar clave.")
      return
    }

    if (password !== confirmacion) {
      setError("Las dos claves no coinciden.")
      return
    }

    try {
      setSubmitting(true)
      setError("")

      const res = await fetch("/api/auth/recuperar-clave/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || "No se pudo actualizar la clave.")
        return
      }

      setOk(true)
    } catch {
      setError("No se pudo actualizar la clave.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex items-center justify-center h-screen">
      <div className="border p-8 rounded-xl w-80 space-y-4">
        <h1 className="text-2xl font-bold text-center">Elegir clave nueva</h1>

        {ok ? (
          <>
            <p className="text-sm text-gray-700 text-center">
              Tu clave se actualizó. Ya podés ingresar con la nueva.
            </p>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="bg-black text-white w-full p-2 rounded"
            >
              Ir al login
            </button>
          </>
        ) : !token ? (
          <>
            <p className="text-sm text-red-600 text-center">
              Este link no es válido. Pedí uno nuevo desde la pantalla de recuperar clave.
            </p>
            <Link
              href="/recuperar-clave"
              className="block text-center text-sm text-gray-600 underline"
            >
              Pedir un link nuevo
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="Clave nueva"
              className="border p-2 w-full rounded"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
            />

            <input
              type="password"
              placeholder="Repetí la clave nueva"
              className="border p-2 w-full rounded"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              disabled={submitting}
              required
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              className="bg-black text-white w-full p-2 rounded disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? "Guardando..." : "Guardar clave nueva"}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}

export default function ConfirmarClavePage() {
  return (
    <Suspense fallback={<ConfirmarClaveFallback />}>
      <ConfirmarClaveContent />
    </Suspense>
  )
}
