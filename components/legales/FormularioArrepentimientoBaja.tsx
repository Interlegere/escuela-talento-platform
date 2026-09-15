"use client"

import { useState } from "react"

type Tipo = "arrepentimiento" | "baja"

const ETIQUETA: Record<Tipo, string> = {
  arrepentimiento: "arrepentimiento",
  baja: "baja",
}

// Formulario compartido por /arrepentimiento y /baja (Disposición
// 954/2025) — misma mecánica, mismo endpoint, solo cambia "tipo". Pública,
// sin sesión: la disposición exige acceso sin registro previo ni pasos
// adicionales.
export default function FormularioArrepentimientoBaja({ tipo }: { tipo: Tipo }) {
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [actividad, setActividad] = useState("")
  const [motivo, setMotivo] = useState("")
  const [estado, setEstado] = useState<"idle" | "enviando" | "error">("idle")
  const [mensajeError, setMensajeError] = useState("")
  const [codigo, setCodigo] = useState<string | null>(null)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (estado === "enviando") return

    if (!nombre.trim() || !email.trim()) {
      setMensajeError("Completá nombre y apellido, y tu correo.")
      setEstado("error")
      return
    }

    try {
      setEstado("enviando")
      setMensajeError("")

      const res = await fetch("/api/arrepentimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          nombre: nombre.trim(),
          email: email.trim(),
          actividad: actividad.trim(),
          motivo: motivo.trim(),
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo enviar el pedido.")
        setEstado("error")
        return
      }

      setCodigo(data.codigo)
      setEstado("idle")
    } catch {
      setMensajeError("Error de conexión. Probá de nuevo.")
      setEstado("error")
    }
  }

  if (codigo) {
    return (
      <div className="workspace-panel-soft space-y-2 text-center">
        <p className="text-lg">
          Listo. Tu código de {ETIQUETA[tipo]} es <strong className="text-xl">{codigo}</strong>.
        </p>
        <p className="workspace-inline-note">
          Guardalo. Te llega también por mail, y Nicolás te responde dentro de las 24 horas.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="workspace-panel space-y-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Nombre y apellido</span>
        <input
          className="workspace-field"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Correo electrónico</span>
        <input
          type="email"
          className="workspace-field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Actividad</span>
        <input
          className="workspace-field"
          value={actividad}
          onChange={(e) => setActividad(e.target.value)}
          placeholder="Ej: Proyecto In+Posible, Entusiasmento, Mentoría..."
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          Motivo <span className="opacity-60">(opcional)</span>
        </span>
        <textarea
          className="workspace-field min-h-20"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </label>

      {mensajeError && <p className="text-sm text-red-600">{mensajeError}</p>}

      <button type="submit" disabled={estado === "enviando"} className="workspace-button-primary w-full">
        {estado === "enviando" ? "Enviando..." : "Enviar"}
      </button>
    </form>
  )
}
