"use client"

import { useEffect, useMemo, useState } from "react"
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

  // España paga en EUR por defecto, cualquier otro país fuera de Argentina
  // paga en USD — la persona puede corregirlo igual con los botones de abajo.
  useEffect(() => {
    if (esArgentina(pais)) return
    const frame = window.requestAnimationFrame(() => {
      setMonedaInternacional(pais.trim().toLowerCase() === "españa" ? "EUR" : "USD")
    })
    return () => window.cancelAnimationFrame(frame)
  }, [pais])

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
      <div className="rounded-3xl border border-[var(--tinta)]/10 bg-[var(--arena)] p-6 text-center">
        <p className="text-lg font-semibold text-[var(--tinta)]">La inscripción ya cerró.</p>
        <p className="mt-2 text-sm text-[var(--tinta)]/70">
          Esta camada de Proyecto In+Posible completó su cupo. Escribinos si querés que te avisemos de la próxima.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="space-y-4 rounded-3xl border border-[var(--tinta)]/10 bg-white p-6 shadow-[0_20px_50px_rgba(36,31,28,0.08)] sm:p-7">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--tinta)]/80">Nombre</span>
          <input
            className="w-full rounded-2xl border border-[var(--tinta)]/15 bg-white px-4 py-2.5 text-[16px] text-[var(--tinta)] outline-none transition focus:border-[var(--dorado-hover)] focus:ring-4 focus:ring-[var(--dorado)]/25"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--tinta)]/80">Apellido</span>
          <input
            className="w-full rounded-2xl border border-[var(--tinta)]/15 bg-white px-4 py-2.5 text-[16px] text-[var(--tinta)] outline-none transition focus:border-[var(--dorado-hover)] focus:ring-4 focus:ring-[var(--dorado)]/25"
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--tinta)]/80">Email</span>
          <input
            type="email"
            className="w-full rounded-2xl border border-[var(--tinta)]/15 bg-white px-4 py-2.5 text-[16px] text-[var(--tinta)] outline-none transition focus:border-[var(--dorado-hover)] focus:ring-4 focus:ring-[var(--dorado)]/25"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--tinta)]/80">WhatsApp</span>
          <input
            className="w-full rounded-2xl border border-[var(--tinta)]/15 bg-white px-4 py-2.5 text-[16px] text-[var(--tinta)] outline-none transition focus:border-[var(--dorado-hover)] focus:ring-4 focus:ring-[var(--dorado)]/25"
            placeholder="+54 9 ..."
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            required
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-[var(--tinta)]/80">País</span>
        <select className="w-full rounded-2xl border border-[var(--tinta)]/15 bg-white px-4 py-2.5 text-[16px] text-[var(--tinta)] outline-none transition focus:border-[var(--dorado-hover)] focus:ring-4 focus:ring-[var(--dorado)]/25" value={pais} onChange={(e) => setPais(e.target.value)}>
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
                  ? "bg-[var(--dorado)] text-[var(--tinta)]"
                  : "border border-[var(--tinta)]/20 text-[var(--tinta)]/70"
              }`}
            >
              Prefiero pagar en {m}
            </button>
          ))}
        </div>
      )}

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-[var(--tinta)]/80">¿Tenés un proyecto en mente?</legend>
        <div className="flex flex-wrap gap-2">
          {OPCIONES_TIENE_PROYECTO.map((op) => (
            <button
              key={op.valor}
              type="button"
              onClick={() => setTieneProyecto(op.valor)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tieneProyecto === op.valor
                  ? "bg-[var(--dorado)] text-[var(--tinta)]"
                  : "border border-[var(--tinta)]/20 text-[var(--tinta)]/70"
              }`}
            >
              {op.etiqueta}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-[var(--tinta)]/80">
          Contame en una línea de qué se trata <span className="text-[var(--tinta)]/40">(opcional)</span>
        </span>
        <textarea
          className="min-h-16 w-full rounded-2xl border border-[var(--tinta)]/15 bg-white px-4 py-2.5 text-[16px] text-[var(--tinta)] outline-none transition focus:border-[var(--dorado-hover)] focus:ring-4 focus:ring-[var(--dorado)]/25"
          value={proyectoDescripcion}
          onChange={(e) => setProyectoDescripcion(e.target.value)}
        />
      </label>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-[var(--tinta)]/80">¿Cómo querés pagarlo?</legend>
        <div className="flex flex-wrap gap-2">
          {OPCIONES_PLAN_PAGO.map((op) => (
            <button
              key={op.valor}
              type="button"
              onClick={() => setPlanPago(op.valor)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                planPago === op.valor
                  ? "bg-[var(--dorado)] text-[var(--tinta)]"
                  : "border border-[var(--tinta)]/20 text-[var(--tinta)]/70"
              }`}
            >
              {op.etiqueta}
            </button>
          ))}
        </div>
      </fieldset>

      {montos && (
        <div className="rounded-2xl border border-[var(--dorado)]/40 bg-[var(--arena)]/50 p-4">
          {montos.esInternacional ? (
            <p className="text-sm text-[var(--tinta)]">
              Por transferencia internacional:{" "}
              <span className="font-semibold">
                {formatearMontoInternacional(montos.monto, montos.moneda)}
              </span>
            </p>
          ) : (
            <div className="flex flex-wrap gap-4 text-sm text-[var(--tinta)]">
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

      {/* Regla de contraste (ver app/proyecto-inposible/page.tsx, junto a
          BotonCTA): fondo dorado → texto tinta, siempre, hover incluido. */}
      <button
        type="submit"
        disabled={estado === "enviando"}
        className="w-full rounded-full bg-[var(--dorado)] px-6 py-4 text-[19px] font-bold text-[var(--tinta)] shadow-[0_0_16px_rgba(249,195,62,0.35),0_0_32px_rgba(249,195,62,0.16)] transition hover:bg-[var(--dorado-hover)] hover:shadow-[0_0_22px_rgba(249,195,62,0.49),0_0_45px_rgba(249,195,62,0.22)] disabled:opacity-60 disabled:shadow-none"
      >
        {estado === "enviando" ? "Enviando..." : "¡Quiero mi lugar!"}
      </button>
      <p className="text-center text-xs text-[var(--tinta)]/70">
        Usamos tus datos solo para contactarte por Proyecto In+Posible. No los compartimos con nadie.
      </p>
    </form>
  )
}
