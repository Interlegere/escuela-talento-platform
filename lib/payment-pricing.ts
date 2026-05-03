import { createAdminSupabaseClient } from "@/lib/supabase-admin"

function normalizarNumero(input: string | number | null | undefined) {
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : 0
  }

  const raw = String(input || "").trim()

  if (!raw) {
    return 0
  }

  const sanitized = raw
    .replace(/\s/g, "")
    .replace(/\$/g, "")
    .replace(/ARS/gi, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "")

  const parsed = Number(sanitized)
  return Number.isFinite(parsed) ? parsed : 0
}

function redondearMoneda(value: number) {
  return Math.round(value * 100) / 100
}

export function obtenerRecargoMercadoPagoPorcentaje() {
  const porcentaje = normalizarNumero(
    process.env.NEXT_PUBLIC_MP_SURCHARGE_PERCENT || "0"
  )

  if (porcentaje < 0) {
    return 0
  }

  return porcentaje
}

export async function obtenerRecargoMercadoPagoPorcentajeConfigurado() {
  const fallback = obtenerRecargoMercadoPagoPorcentaje()

  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from("configuracion_plataforma")
      .select("valor_texto")
      .eq("clave", "mercado_pago_recargo_porcentaje")
      .maybeSingle()

    if (error || !data?.valor_texto) {
      return fallback
    }

    const porcentaje = normalizarNumero(data.valor_texto)

    if (!Number.isFinite(porcentaje) || porcentaje < 0) {
      return fallback
    }

    return porcentaje
  } catch {
    return fallback
  }
}

export function calcularMontosPagoMensual(
  montoBaseInput: string | number | null | undefined
) {
  const montoTransferencia = redondearMoneda(normalizarNumero(montoBaseInput))
  const porcentajeRecargoMercadoPago = obtenerRecargoMercadoPagoPorcentaje()
  const recargoMercadoPago = redondearMoneda(
    (montoTransferencia * porcentajeRecargoMercadoPago) / 100
  )
  const montoMercadoPago = redondearMoneda(
    montoTransferencia + recargoMercadoPago
  )

  return {
    montoTransferencia,
    porcentajeRecargoMercadoPago,
    recargoMercadoPago,
    montoMercadoPago,
  }
}

export async function calcularMontosPagoMensualConfigurado(
  montoBaseInput: string | number | null | undefined
) {
  const montoTransferencia = redondearMoneda(normalizarNumero(montoBaseInput))
  const porcentajeRecargoMercadoPago =
    await obtenerRecargoMercadoPagoPorcentajeConfigurado()
  const recargoMercadoPago = redondearMoneda(
    (montoTransferencia * porcentajeRecargoMercadoPago) / 100
  )
  const montoMercadoPago = redondearMoneda(
    montoTransferencia + recargoMercadoPago
  )

  return {
    montoTransferencia,
    porcentajeRecargoMercadoPago,
    recargoMercadoPago,
    montoMercadoPago,
  }
}
