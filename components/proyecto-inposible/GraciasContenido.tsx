"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  calcularMontos,
  esArgentina,
  formatearMontoArs,
  formatearMontoInternacional,
  TALLERES,
  type MonedaInternacional,
  type PlanPago,
} from "@/lib/proyecto-inposible"
import { MERCADOPAGO, TRANSFERENCIA_ARS, TRANSFERENCIA_INTERNACIONAL } from "@/lib/proyecto-inposible-pagos"

type DatosGuardados = {
  nombre: string
  planPago: PlanPago
  pais: string
  monedaInternacional: MonedaInternacional
}

function BloquePagoArs({ planPago }: { planPago: PlanPago }) {
  const montos = calcularMontos(planPago, "Argentina")
  if (montos.esInternacional) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
        <p className="text-sm font-semibold text-gray-800">
          Por transferencia — {formatearMontoArs(montos.transferencia)}
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Alias: <span className="font-medium">{TRANSFERENCIA_ARS.alias}</span>
          <br />
          CVU: <span className="font-medium">{TRANSFERENCIA_ARS.cvu}</span>
          <br />
          Titular: {TRANSFERENCIA_ARS.titular}
        </p>
      </div>
      <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
        <p className="text-sm font-semibold text-gray-800">
          Por Mercado Pago — {formatearMontoArs(MERCADOPAGO[planPago].monto)}
        </p>
        <a
          href={MERCADOPAGO[planPago].link}
          target="_blank"
          rel="noopener noreferrer"
          className="workspace-button-primary mt-3 inline-flex"
          style={{ color: "#fff" }}
        >
          Pagar con Mercado Pago
        </a>
      </div>
    </div>
  )
}

function BloquePagoInternacional({
  planPago,
  moneda,
}: {
  planPago: PlanPago
  moneda: MonedaInternacional
}) {
  const montos = calcularMontos(planPago, "Otro", moneda)
  if (!montos.esInternacional) return null

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
      <p className="text-sm font-semibold text-gray-800">
        Transferencia internacional — {formatearMontoInternacional(montos.monto, montos.moneda)}
      </p>
      <p className="mt-2 text-sm text-gray-600">
        Titular: {TRANSFERENCIA_INTERNACIONAL.titular}
        <br />
        Banco: {TRANSFERENCIA_INTERNACIONAL.banco}
        <br />
        Tipo de cuenta: {TRANSFERENCIA_INTERNACIONAL.tipoCuenta}
        <br />
        Cuenta: {TRANSFERENCIA_INTERNACIONAL.cuenta}
        <br />
        Ruta: {TRANSFERENCIA_INTERNACIONAL.ruta}
        <br />
        Dirección: {TRANSFERENCIA_INTERNACIONAL.direccion}
      </p>
    </div>
  )
}

export default function GraciasContenido() {
  const [datos, setDatos] = useState<DatosGuardados | null>(null)
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const raw = sessionStorage.getItem("proyecto-inposible-gracias")
        if (raw) setDatos(JSON.parse(raw))
      } catch {
        // sin datos guardados — se muestra el estado genérico de respaldo.
      }
      setCargado(true)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  if (!cargado) return null

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
        Proyecto In+Posible
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-gray-900 sm:text-4xl">
        {datos ? `¡Gracias, ${datos.nombre}!` : "¡Reservá tu lugar!"}
      </h1>
      <p className="mt-3 text-gray-600">
        {datos
          ? "Ya guardamos tu preinscripción. Señá tu lugar con cualquiera de estas opciones."
          : "Estos son los datos para señar tu lugar en Proyecto In+Posible."}
      </p>

      <div className="mt-8 space-y-8">
        {datos ? (
          esArgentina(datos.pais) ? (
            <BloquePagoArs planPago={datos.planPago} />
          ) : (
            <BloquePagoInternacional planPago={datos.planPago} moneda={datos.monedaInternacional} />
          )
        ) : (
          <>
            <div>
              <p className="mb-3 text-sm font-semibold text-gray-700">Pago único — los tres meses</p>
              <BloquePagoArs planPago="unico" />
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-gray-700">Mes a mes</p>
              <BloquePagoArs planPago="mensual" />
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-gray-700">Desde afuera de Argentina</p>
              <BloquePagoInternacional planPago="unico" moneda="USD" />
            </div>
          </>
        )}
      </div>

      <div className="mt-10 rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.7)] p-5">
        <p className="text-sm font-semibold text-gray-800">Los tres talleres en vivo, 19 hs</p>
        <p className="mt-1 text-sm text-gray-600">
          {TALLERES.map((t) => t.etiqueta).join(" · ")}
        </p>
      </div>

      <p className="mt-6 text-sm text-gray-600">
        En las próximas horas te llega el primer material de la inducción por mail. Si tenés dudas, escribinos por WhatsApp.
      </p>

      <Link href="/proyecto-inposible" className="mt-8 inline-block text-sm text-[var(--accent-strong)] underline">
        Volver a Proyecto In+Posible
      </Link>
    </main>
  )
}
