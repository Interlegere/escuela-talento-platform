// Lógica compartida de Proyecto In+Posible (landing + formulario + API).
// Deliberadamente sin datos de pago (CVU, links de Mercado Pago, cuenta
// internacional) — esos viven en lib/proyecto-inposible-pagos.ts, que solo
// importan el endpoint del servidor y la pantalla de gracias, nunca la
// landing pública ni el formulario.
import { obtenerFechaISOArgentina } from "@/lib/fechas"

// Hasta cuándo se puede entrar a este ciclo.
// Después del segundo taller, una persona nueva tendría un solo taller en vivo
// y poco más de un mes de acompañamiento por el precio completo.
// Ahí conviene cerrar este ciclo y abrir el siguiente con fechas nuevas.
// Este número no se muestra en ningún lado de la página — es un freno, no
// una fecha de venta. Si hay que mover el cierre, se toca solo esta línea.
const INSCRIPCION_CIERRA = "2026-10-12"

export const TALLERES = [
  { fecha: "2026-09-14", etiqueta: "Lunes 14 de septiembre" },
  { fecha: "2026-10-12", etiqueta: "Lunes 12 de octubre" },
  { fecha: "2026-11-09", etiqueta: "Lunes 9 de noviembre" },
] as const

type Taller = (typeof TALLERES)[number]

// El primer taller que todavía no pasó — el día del taller cuenta como
// "todavía no pasó". Mismo criterio de comparación de strings ISO que ya
// usa estaInscripcionAbierta(), para que las dos vean el mismo día. Si ya
// pasaron los tres, no hay próximo taller que mostrar.
export function proximoTaller(fechaISOArgentinaHoy: string = obtenerFechaISOArgentina()): Taller | null {
  return TALLERES.find((taller) => taller.fecha >= fechaISOArgentinaHoy) || null
}

// "Lunes 14 de septiembre" -> "lunes 14 de septiembre", para usar en medio
// de una oración ("Próximo taller en vivo: lunes 14 de septiembre").
export function formatearProximoTallerLargo(taller: Taller) {
  return taller.etiqueta.charAt(0).toLowerCase() + taller.etiqueta.slice(1)
}

// "2026-09-14" -> "14/09", para la barra fija angosta del celular.
export function formatearProximoTallerCorto(taller: Taller) {
  const [, mes, dia] = taller.fecha.split("-")
  return `${dia}/${mes}`
}

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
  return fechaISOArgentinaHoy <= INSCRIPCION_CIERRA
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

// WHATSAPP_CONTACTO/crearLinkWhatsapp vivían acá — se movieron a
// lib/whatsapp.ts (compartido con Entusiasmento) y quedan re-exportados
// para no tocar ningún import existente de la landing ni del formulario.
export { WHATSAPP_CONTACTO, crearLinkWhatsapp } from "@/lib/whatsapp"
