"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  calcularMontos,
  esArgentina,
  estaInscripcionAbierta,
  formatearMontoArs,
  formatearMontoInternacional,
  PAISES,
  type MonedaInternacional,
  type PlanPago,
  type TieneProyecto,
} from "@/lib/proyecto-inposible"

const OPCIONES_TIENE_PROYECTO: Array<{ valor: TieneProyecto; etiqueta: string }> = [
  { valor: "si", etiqueta: "Sí, lo tengo claro" },
  { valor: "idea", etiqueta: "Tengo una idea dando vueltas" },
  { valor: "no", etiqueta: "Todavía no" },
]

const OPCIONES_PLAN_PAGO: Array<{ valor: PlanPago; etiqueta: string }> = [
  { valor: "mensual", etiqueta: "Mes a mes" },
  { valor: "unico", etiqueta: "Pago único" },
]

type EstadoEnvio = "idle" | "enviando" | "error"

export default function FormularioPreinscripcion() {
  const router = useRouter()
  const [nombre, setNombre] = useState("")
  const [apellido, setApellido] = useState("")
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [pais, setPais] = useState("Argentina")
  const [monedaInternacional, setMonedaInternacional] = useState<MonedaInternacional>("USD")
  const [tieneProyecto, setTieneProyecto] = useState<TieneProyecto | "">("")
  const [proyectoDescripcion, setProyectoDescripcion] = useState("")
  const [planPago, setPlanPago] = useState<PlanPago | "">("")
  const [estado, setEstado] = useState<EstadoEnvio>("idle")
  const [mensajeError, setMensajeError] = useState("")

  const abierta = estaInscripcionAbierta()

  const montos = useMemo(() => {
    if (!planPago) return null
    return calcularMontos(planPago, pais, monedaInternacional)
  }, [planPago, pais, monedaInternacional])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (estado === "enviando") return

    if (!nombre.trim() || !apellido.trim() || !email.trim() || !whatsapp.trim() || !tieneProyecto || !planPago) {
      setMensajeError("Completá todos los campos obligatorios.")
      setEstado("error")
      return
    }

    try {
      setEstado("enviando")
      setMensajeError("")

      const res = await fetch("/api/preinscripcion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim(),
          pais,
          monedaInternacional,
          tieneProyecto,
          proyectoDescripcion: proyectoDescripcion.trim(),
          planPago,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo enviar el formulario.")
        setEstado("error")
        return
      }

      try {
        sessionStorage.setItem(
          "proyecto-inposible-gracias",
          JSON.stringify({ nombre: nombre.trim(), planPago, pais, monedaInternacional })
        )
      } catch {
        // localStorage/sessionStorage puede fallar (modo privado, etc.) —
        // la pantalla de gracias tiene un estado genérico de respaldo.
      }

      router.push("/proyecto-inposible/gracias")
    } catch {
      setMensajeError("Error de conexión. Probá de nuevo.")
      setEstado("error")
    }
  }

  if (!abierta) {
    return (
      <div className="workspace-panel-soft rounded-3xl p-6 text-center">
        <p className="text-lg font-semibold text-gray-800">La inscripción ya cerró.</p>
        <p className="mt-2 text-sm text-gray-600">
          Esta camada de Proyecto In+Posible completó su cupo. Escribinos si querés que te avisemos de la próxima.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="space-y-4 rounded-3xl border border-[var(--line)] bg-[var(--surface-strong)] p-5 shadow-sm sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700">Nombre</span>
          <input
            className="workspace-field"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700">Apellido</span>
          <input
            className="workspace-field"
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            required
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700">Email</span>
          <input
            type="email"
            className="workspace-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700">WhatsApp</span>
          <input
            className="workspace-field"
            placeholder="+54 9 ..."
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            required
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-gray-700">País</span>
        <select className="workspace-field" value={pais} onChange={(e) => setPais(e.target.value)}>
          {PAISES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      {!esArgentina(pais) && (
        <div className="flex gap-2">
          {(["USD", "EUR"] as MonedaInternacional[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonedaInternacional(m)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                monedaInternacional === m
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--line)] text-gray-600"
              }`}
            >
              Prefiero pagar en {m}
            </button>
          ))}
        </div>
      )}

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-gray-700">¿Tenés un proyecto en mente?</legend>
        <div className="flex flex-wrap gap-2">
          {OPCIONES_TIENE_PROYECTO.map((op) => (
            <button
              key={op.valor}
              type="button"
              onClick={() => setTieneProyecto(op.valor)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tieneProyecto === op.valor
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--line)] text-gray-600"
              }`}
            >
              {op.etiqueta}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-gray-700">
          Contame en una línea de qué se trata <span className="text-gray-400">(opcional)</span>
        </span>
        <textarea
          className="workspace-field min-h-16"
          value={proyectoDescripcion}
          onChange={(e) => setProyectoDescripcion(e.target.value)}
        />
      </label>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-gray-700">¿Cómo querés pagarlo?</legend>
        <div className="flex flex-wrap gap-2">
          {OPCIONES_PLAN_PAGO.map((op) => (
            <button
              key={op.valor}
              type="button"
              onClick={() => setPlanPago(op.valor)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                planPago === op.valor
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--line)] text-gray-600"
              }`}
            >
              {op.etiqueta}
            </button>
          ))}
        </div>
      </fieldset>

      {montos && (
        <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.7)] p-4">
          {montos.esInternacional ? (
            <p className="text-sm text-gray-700">
              Por transferencia internacional:{" "}
              <span className="font-semibold">
                {formatearMontoInternacional(montos.monto, montos.moneda)}
              </span>
            </p>
          ) : (
            <div className="flex flex-wrap gap-4 text-sm text-gray-700">
              <p>
                Por transferencia:{" "}
                <span className="font-semibold">{formatearMontoArs(montos.transferencia)}</span>
              </p>
              <p>
                Por Mercado Pago:{" "}
                <span className="font-semibold">{formatearMontoArs(montos.mercadopago)}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {mensajeError && <p className="text-sm text-red-600">{mensajeError}</p>}

      <button
        type="submit"
        disabled={estado === "enviando"}
        className="workspace-button-primary w-full disabled:opacity-60"
        style={{ color: "#fff" }}
      >
        {estado === "enviando" ? "Enviando..." : "Quiero mi lugar"}
      </button>
    </form>
  )
}
