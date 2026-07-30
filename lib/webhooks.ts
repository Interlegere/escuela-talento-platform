import { createHmac, timingSafeEqual } from "crypto"

const TOLERANCIA_SEGUNDOS = 300

export type EncabezadosSvix = {
  svixId?: string | null
  svixTimestamp?: string | null
  svixSignature?: string | null
}

/**
 * Verifica un webhook firmado con el esquema de Svix (usado por Resend):
 * HMAC-SHA256 sobre "{svix-id}.{svix-timestamp}.{body-crudo}", clave = la
 * parte del secreto después de "whsec_", codificada en base64.
 * https://docs.svix.com/receiving/verifying-payloads/how-manual
 */
export function verificarFirmaSvix(
  payloadCrudo: string,
  headers: EncabezadosSvix,
  secret: string
): boolean {
  const { svixId, svixTimestamp, svixSignature } = headers

  if (!svixId || !svixTimestamp || !svixSignature || !secret) {
    return false
  }

  const timestampNumero = Number(svixTimestamp)
  if (!Number.isFinite(timestampNumero)) {
    return false
  }

  const ahoraSegundos = Math.floor(Date.now() / 1000)
  if (Math.abs(ahoraSegundos - timestampNumero) > TOLERANCIA_SEGUNDOS) {
    return false
  }

  const secretSinPrefijo = secret.startsWith("whsec_")
    ? secret.slice("whsec_".length)
    : secret
  const clave = Buffer.from(secretSinPrefijo, "base64")

  const contenidoFirmado = `${svixId}.${svixTimestamp}.${payloadCrudo}`
  const firmaEsperada = createHmac("sha256", clave)
    .update(contenidoFirmado)
    .digest("base64")

  const firmasRecibidas = svixSignature
    .split(" ")
    .map((parte) => parte.split(",")[1])
    .filter(Boolean) as string[]

  const firmaEsperadaBuffer = Buffer.from(firmaEsperada)

  return firmasRecibidas.some((firmaRecibida) => {
    const firmaRecibidaBuffer = Buffer.from(firmaRecibida)
    if (firmaRecibidaBuffer.length !== firmaEsperadaBuffer.length) {
      return false
    }
    return timingSafeEqual(firmaEsperadaBuffer, firmaRecibidaBuffer)
  })
}
