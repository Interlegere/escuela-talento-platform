"use client"

import { signIn, signOut } from "next-auth/react"
import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAppSession } from "@/components/auth/AppSessionProvider"

function LoginPageFallback() {
  return (
    <main className="flex items-center justify-center h-screen">
      <div className="border p-8 rounded-xl w-80 space-y-4">
        <h1 className="text-2xl font-bold text-center">Acceso al Campus</h1>
        <p className="text-sm text-gray-600 text-center">Preparando acceso...</p>
      </div>
    </main>
  )
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useAppSession()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorLocal, setErrorLocal] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const errorParam = searchParams.get("error")
  const errorQuery =
    errorParam === "CredentialsSignin"
      ? "Email o contraseña incorrectos."
      : errorParam
        ? "No se pudo iniciar sesión."
        : ""
  const error = errorLocal || errorQuery

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (status === "authenticated") {
      setErrorLocal("Primero cerrá la sesión actual para ingresar con otra cuenta.")
      return
    }

    try {
      setSubmitting(true)
      setErrorLocal("")

      await signIn("credentials", {
        email: email.trim(),
        password,
        callbackUrl: "/campus",
        redirect: true,
      })
    } catch {
      setErrorLocal("No se pudo iniciar sesión.")
      setSubmitting(false)
    }
  }

  const handleCerrarSesion = async () => {
    try {
      setSubmitting(true)
      setErrorLocal("")

      await signOut({
        redirect: false,
      })

      window.location.assign("/login")
    } catch {
      setErrorLocal("No se pudo cerrar la sesión actual.")
      setSubmitting(false)
    }
  }

  return (
    <main className="flex items-center justify-center h-screen">
      <form
        onSubmit={handleLogin}
        suppressHydrationWarning
        className="border p-8 rounded-xl w-80 space-y-4"
      >
        <h1 className="text-2xl font-bold text-center">
          Acceso al Campus
        </h1>

        {status === "authenticated" && session?.user && (
          <div className="border rounded p-3 text-sm space-y-2">
            <p>
              Sesión actual: <strong>{session.user.name || "Usuario"}</strong>
            </p>
            <p>{session.user.email}</p>
            <p>Rol: {session.user.role || "participante"}</p>
            <div className="flex gap-2 flex-wrap pt-1">
              <button
                type="button"
                onClick={() => router.replace("/campus")}
                className="border px-3 py-2 rounded text-sm"
                disabled={submitting}
              >
                Ir a Campus
              </button>

              <button
                type="button"
                onClick={handleCerrarSesion}
                className="border px-3 py-2 rounded text-sm"
                disabled={submitting}
              >
                Cerrar sesión
              </button>
            </div>
            <p className="text-xs text-gray-600">
              Si querés entrar con otra cuenta, podés escribir nuevas credenciales abajo.
            </p>
          </div>
        )}

        <input
          type="email"
          name="email"
          placeholder="Email"
          suppressHydrationWarning
          className="border p-2 w-full rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "authenticated" || submitting}
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          suppressHydrationWarning
          className="border p-2 w-full rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={status === "authenticated" || submitting}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          className="bg-black text-white w-full p-2 rounded disabled:opacity-60"
          disabled={submitting || status === "authenticated"}
        >
          {status === "authenticated"
            ? "Cerrá sesión para cambiar"
            : submitting
              ? "Ingresando..."
              : "Ingresar"}
        </button>
      </form>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  )
}
