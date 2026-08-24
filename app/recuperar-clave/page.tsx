"use client"

import Link from "next/link"
import { useState } from "react"

export default function RecuperarClavePage() {
  const [email, setEmail] = useState("")
  const [enviado, setEnviado] = useState(false)
  const [mensaje, setMensaje] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    try {
      setSubmitting(true)
      setError("")

      const res = await fetch("/api/auth/recuperar-clave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || "No se pudo procesar el pedido.")
        return
      }

      setMensaje(data.mensaje || "Si el email existe, te mandamos un link.")
      setEnviado(true)
    } catch {
      setError("No se pudo procesar el pedido.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex items-center justify-center h-screen">
      <div className="border p-8 rounded-xl w-80 space-y-4">
        <h1 className="text-2xl font-bold text-center">Recuperar clave</h1>

        {enviado ? (
          <>
            <p className="text-sm text-gray-700 text-center">{mensaje}</p>
            <Link
              href="/login"
              className="block text-center text-sm text-gray-600 underline"
            >
              Volver al login
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Ingresá tu email y te mandamos un link para elegir una clave nueva.
            </p>

            <input
              type="email"
              placeholder="Email"
              className="border p-2 w-full rounded"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              required
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              className="bg-black text-white w-full p-2 rounded disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? "Enviando..." : "Enviar link"}
            </button>

            <Link
              href="/login"
              className="block text-center text-sm text-gray-600 underline"
            >
              Volver al login
            </Link>
          </form>
        )}
      </div>
    </main>
  )
}
