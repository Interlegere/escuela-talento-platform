// Lógica compartida de Proyecto In+Posible (landing + formulario + API).
// Deliberadamente sin datos de pago (CVU, links de Mercado Pago, cuenta
// internacional) — esos viven en lib/proyecto-inposible-pagos.ts, que solo
// importan el endpoint del servidor y la pantalla de gracias, nunca la
// landing pública ni el formulario.
import { obtenerFechaISOArgentina } from "@/lib/fechas"

// Único lugar donde vive la fecha de cierre — no repetirla en otro lado.
export const FECHA_CIERRE_INSCRIPCION = "2026-09-11"

export const TALLERES = [
  { fecha: "2026-09-14", etiqueta: "Lunes 14 de septiembre" },
  { fecha: "2026-10-12", etiqueta: "Lunes 12 de octubre" },
  { fecha: "2026-11-09", etiqueta: "Lunes 9 de noviembre" },
] as const

export type PlanPago = "mensual" | "unico"
export type TieneProyecto = "si" | "idea" | "no"
export type MonedaInternacional = "USD" | "EUR"

export const PAISES = [
  "Argentina",
  "España",
  "Chile",
  "Uruguay",
  "México",
  "Colombia",
  "Perú",
  "Estados Unidos",
  "Otro",
] as const

// Precios en pesos argentinos — única fuente de verdad para ARS, tanto en
// el formulario (preview en vivo) como en el servidor (cálculo real).
export const PRECIOS_ARS = {
  mensual: { transferencia: 180000, mercadopago: 200000 },
  unico: { transferencia: 500000, mercadopago: 550000 },
} as const

// Mismo monto en USD y EUR — solo cambia la moneda elegida, no el número.
export const PRECIOS_INTERNACIONAL = {
  mensual: 180,
  unico: 500,
} as const

export function esArgentina(pais: string) {
  return pais.trim().toLowerCase() === "argentina"
}

// 9% en pago único, 10% en mes a mes — es la diferencia real entre
// transferencia y Mercado Pago ($500.000→$550.000 y $180.000→$200.000).
export function calcularDescuentoPct(planPago: PlanPago) {
  return planPago === "unico" ? 9 : 10
}

export function estaInscripcionAbierta(fechaISOArgentinaHoy: string = obtenerFechaISOArgentina()) {
  return fechaISOArgentinaHoy <= FECHA_CIERRE_INSCRIPCION
}

export type MontosPreinscripcion =
  | { esInternacional: false; moneda: "ARS"; transferencia: number; mercadopago: number }
  | { esInternacional: true; moneda: MonedaInternacional; monto: number }

export function calcularMontos(
  planPago: PlanPago,
  pais: string,
  monedaInternacional: MonedaInternacional = "USD"
): MontosPreinscripcion {
  if (esArgentina(pais)) {
    const precios = PRECIOS_ARS[planPago]
    return {
      esInternacional: false,
      moneda: "ARS",
      transferencia: precios.transferencia,
      mercadopago: precios.mercadopago,
    }
  }

  return {
    esInternacional: true,
    moneda: monedaInternacional,
    monto: PRECIOS_INTERNACIONAL[planPago],
  }
}

export function formatearMontoArs(monto: number) {
  return `$${monto.toLocaleString("es-AR")}`
}

export function formatearMontoInternacional(monto: number, moneda: MonedaInternacional) {
  return `${moneda} ${monto.toLocaleString("es-AR")}`
}

// Número de WhatsApp de Nicolás, sin el "+", sin espacios y sin guiones
// (formato que pide wa.me) — el "9" después del "54" es obligatorio para
// móviles argentinos. Se usa en la landing ("escribime por WhatsApp"
// debajo del CTA principal), en /proyecto-inposible/gracias (comprobante
// de transferencia ARS, y coordinar el pago desde el exterior) y en el
// mail de confirmación de la preinscripción.
export const WHATSAPP_CONTACTO: string | null = "5493515166582"

export function crearLinkWhatsapp(mensaje: string) {
  if (!WHATSAPP_CONTACTO) return null
  return `https://wa.me/${WHATSAPP_CONTACTO}?text=${encodeURIComponent(mensaje)}`
}
