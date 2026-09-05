"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  calcularMontos,
  crearLinkWhatsapp,
  esArgentina,
  formatearMontoArs,
  formatearMontoInternacional,
  TALLERES,
  type MonedaInternacional,
  type PlanPago,
} from "@/lib/proyecto-inposible"
import { MERCADOPAGO, TRANSFERENCIA_ARS, TRANSFERENCIA_INTERNACIONAL } from "@/lib/proyecto-inposible-pagos"
import PieDePagina from "@/components/proyecto-inposible/PieDePagina"
import { FUENTES_CLASSNAME } from "@/app/proyecto-inposible/fonts"
import { PALETA_PROYECTO_INPOSIBLE } from "@/app/proyecto-inposible/tokens"

type DatosGuardados = {
  nombre: string
  planPago: PlanPago
  pais: string
  monedaInternacional: MonedaInternacional
}

// Mismo halo que los botones "¡Quiero mi lugar!" de la landing (ver
// app/proyecto-inposible/page.tsx, BotonCTA) — es la pantalla donde la
// persona ya decidió pagar, no puede ser el único lugar con un sistema
// visual distinto.
const BOTON_DORADO =
  "inline-flex items-center justify-center rounded-full bg-[var(--dorado)] px-6 py-3 text-[16px] font-bold text-[var(--tinta)] shadow-[0_0_16px_rgba(249,195,62,0.35),0_0_32px_rgba(249,195,62,0.16)] transition hover:bg-[var(--dorado-hover)] hover:shadow-[0_0_22px_rgba(249,195,62,0.49),0_0_45px_rgba(249,195,62,0.22)]"

const TARJETA = "rounded-3xl border border-[var(--tinta)]/15 bg-[var(--nube)] p-5 shadow-[0_18px_40px_rgba(36,31,28,0.06)]"

function LinkComprobante() {
  const link = crearLinkWhatsapp("Hola Nicolás, te mando el comprobante de mi pago de Proyecto In+Posible.")
  return (
    <div className="mt-4">
      <p className="text-sm opacity-80">
        <strong>Cuando transfieras, mandanos el comprobante por WhatsApp</strong> y te confirmamos el
        lugar en el día.
      </p>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center justify-center rounded-full border border-[var(--tinta)]/20 px-5 py-2.5 text-sm font-semibold text-[var(--tinta)] transition hover:bg-[var(--tinta)]/5"
        >
          Enviar el comprobante
        </a>
      )}
    </div>
  )
}

function BloquePagoArs({ planPago }: { planPago: PlanPago }) {
  const montos = calcularMontos(planPago, "Argentina")
  if (montos.esInternacional) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className={TARJETA}>
        <p className="text-sm font-semibold">Por transferencia — {formatearMontoArs(montos.transferencia)}</p>
        <p className="mt-2 text-sm opacity-70">
          Alias: <span className="font-medium opacity-100">{TRANSFERENCIA_ARS.alias}</span>
          <br />
          CVU: <span className="font-medium opacity-100">{TRANSFERENCIA_ARS.cvu}</span>
          <br />
          Titular: {TRANSFERENCIA_ARS.titular}
        </p>
        <LinkComprobante />
      </div>
      <div className={TARJETA}>
        <p className="text-sm font-semibold">Por Mercado Pago — {formatearMontoArs(MERCADOPAGO[planPago].monto)}</p>
        <a href={MERCADOPAGO[planPago].link} target="_blank" rel="noopener noreferrer" className={`${BOTON_DORADO} mt-3`}>
          Pagar con Mercado Pago
        </a>
      </div>
    </div>
  )
}

function BloquePagoInternacional({ planPago, moneda }: { planPago: PlanPago; moneda: MonedaInternacional }) {
  const montos = calcularMontos(planPago, "Otro", moneda)
  if (!montos.esInternacional) return null

  return (
    <div className={TARJETA}>
      <p className="text-sm font-semibold">
        Transferencia internacional — {formatearMontoInternacional(montos.monto, montos.moneda)}
      </p>
      <p className="mt-2 text-sm opacity-70">
        Titular: {TRANSFERENCIA_INTERNACIONAL.titular}
        <br />
        Banco: {TRANSFERENCIA_INTERNACIONAL.banco}
        <br />
        Tipo de cuenta: {TRANSFERENCIA_INTERNACIONAL.tipoCuenta}
        {/* SWIFT/BIC pendiente de confirmar con Lead Bank — sin ese dato el
            número de ruta (uso interno de EE.UU.) no le sirve a un banco
            fuera de EE.UU. No se inventa un valor: la línea entra sola
            apenas TRANSFERENCIA_INTERNACIONAL.swift deje de ser null. */}
        {TRANSFERENCIA_INTERNACIONAL.swift && (
          <>
            <br />
            SWIFT/BIC: {TRANSFERENCIA_INTERNACIONAL.swift}
          </>
        )}
        <br />
        Ruta: {TRANSFERENCIA_INTERNACIONAL.ruta}
        <br />
        Dirección: {TRANSFERENCIA_INTERNACIONAL.direccion}
      </p>
      <LinkComprobante />
    </div>
  )
}

export default function GraciasContenido({ logoExiste }: { logoExiste: boolean }) {
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
    <div
      className={`${FUENTES_CLASSNAME} min-h-screen [font-family:var(--font-cuerpo)] bg-[var(--crema)] text-[var(--tinta)]`}
      style={PALETA_PROYECTO_INPOSIBLE}
    >
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        {logoExiste && (
          <Image src="/logo-entheos.png" alt="ENTHEOS" width={291} height={236} className="mx-auto mb-6 h-12 w-auto object-contain" />
        )}
        <p className="text-center text-xs font-semibold uppercase tracking-[0.35em] opacity-70">Proyecto In+Posible</p>
        <h1 className="[font-family:var(--font-titulo)] mt-2 text-center text-3xl font-extrabold sm:text-4xl">
          {datos ? `¡Gracias, ${datos.nombre}!` : "¡Reservá tu lugar!"}
        </h1>
        <p className="mt-3 text-center opacity-80">
          {datos
            ? "Ya guardamos tu preinscripción. Completá el pago con cualquiera de estas opciones."
            : "Estos son los datos para completar el pago de Proyecto In+Posible."}
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
                <p className="mb-3 text-sm font-semibold opacity-80">Pago único — los tres meses</p>
                <BloquePagoArs planPago="unico" />
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold opacity-80">Mes a mes</p>
                <BloquePagoArs planPago="mensual" />
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold opacity-80">Desde otros países</p>
                <BloquePagoInternacional planPago="unico" moneda="USD" />
              </div>
            </>
          )}
        </div>

        <div className={`mt-10 ${TARJETA} bg-[var(--arena)]`}>
          <p className="text-sm font-semibold">Los tres talleres en vivo, 19 hs</p>
          <p className="mt-1 text-sm opacity-70">{TALLERES.map((t) => t.etiqueta).join(" · ")}</p>
        </div>

        <p className="mt-6 text-sm opacity-70">
          En las próximas horas te llega el primer material de la inducción por mail. Si tenés dudas,
          escribinos por WhatsApp.
        </p>

        <Link href="/proyecto-inposible" className="mt-8 inline-block text-sm font-medium text-[var(--tinta)] underline decoration-[var(--dorado)] decoration-2 underline-offset-4 hover:opacity-70">
          Volver a Proyecto In+Posible
        </Link>
      </main>
      <PieDePagina />
    </div>
  )
}
