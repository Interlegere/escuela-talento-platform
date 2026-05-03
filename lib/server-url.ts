import type { NextRequest } from "next/server"

type RequestLike = Request | NextRequest

export function obtenerOrigenRequest(req: RequestLike) {
  const forwardedProto = req.headers.get("x-forwarded-proto")
  const forwardedHost = req.headers.get("x-forwarded-host")
  const host = forwardedHost || req.headers.get("host")

  if (host) {
    const protocolo = forwardedProto || new URL(req.url).protocol.replace(":", "")
    return `${protocolo}://${host}`
  }

  return new URL(req.url).origin
}

export function obtenerAppUrl(req: RequestLike) {
  if (process.env.NODE_ENV === "production") {
    return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || obtenerOrigenRequest(req)
  }

  return obtenerOrigenRequest(req)
}
