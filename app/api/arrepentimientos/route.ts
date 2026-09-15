import { NextResponse } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { obtenerFechaISOArgentina } from "@/lib/fechas"
import { enviarArrepentimientoAdmin, enviarArrepentimientoParticipante } from "@/lib/mailing"

// Botón de Arrepentimiento y Botón de Baja de servicio (Disposición
// 954/2025) — misma tabla, mismo endpoint, distinguidos por "tipo". Público,
// sin sesión: la disposición exige que se pueda pedir sin registro previo.

const PREFIJOS: Record<"arrepentimiento" | "baja", string> = {
  arrepentimiento: "ARR",
  baja: "BAJA",
}

const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // sin 0/O/1/I, para que no se confundan al transcribir a mano

function generarCodigo(tipo: "arrepentimiento" | "baja") {
  const fecha = obtenerFechaISOArgentina().replaceAll("-", "")
  let sufijo = ""
  for (let i = 0; i < 4; i++) {
    sufijo += ALFABETO_CODIGO[Math.floor(Math.random() * ALFABETO_CODIGO.length)]
  }
  return `${PREFIJOS[tipo]}-${fecha}-${sufijo}`
}

// Rate limit simple por IP, mismo criterio que /api/preinscripcion: alcanza
// para frenar un doble envío accidental o un bot básico.
const INTENTOS_POR_IP = new Map<string, number[]>()
const VENTANA_MS = 10 * 60 * 1000
const MAX_INTENTOS_POR_VENTANA = 5

function estaLimitadoPorIp(ip: string) {
  const ahora = Date.now()
  const intentos = (INTENTOS_POR_IP.get(ip) || []).filter((t) => ahora - t < VENTANA_MS)
  intentos.push(ahora)
  INTENTOS_POR_IP.set(ip, intentos)
  return intentos.length > MAX_INTENTOS_POR_VENTANA
}

function obtenerIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return req.headers.get("x-real-ip") || "desconocida"
}

type Body = {
  tipo?: string
  nombre?: string
  email?: string
  actividad?: string
  motivo?: string
}

export async function POST(req: Request) {
  try {
    const ip = obtenerIp(req)
    if (estaLimitadoPorIp(ip)) {
      return NextResponse.json({ error: "Demasiados intentos. Probá de nuevo en un rato." }, { status: 429 })
    }

    const body: Body = await req.json().catch(() => ({}))
    const tipo = body.tipo === "baja" ? "baja" : body.tipo === "arrepentimiento" ? "arrepentimiento" : null
    const nombre = String(body.nombre || "").trim()
    const email = String(body.email || "").trim().toLowerCase()
    const actividad = String(body.actividad || "").trim()
    const motivo = String(body.motivo || "").trim()

    if (!tipo) {
      return NextResponse.json({ error: "Tipo inválido." }, { status: 400 })
    }
    if (!nombre) {
      return NextResponse.json({ error: "Falta nombre y apellido." }, { status: 400 })
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Ingresá un email válido." }, { status: 400 })
    }

    const codigo = generarCodigo(tipo)

    const supabase = createAdminSupabaseClient()
    const { error: errorInsert } = await supabase.from("arrepentimientos").insert({
      tipo,
      codigo,
      nombre,
      email,
      actividad: actividad || null,
      motivo: motivo || null,
    })

    if (errorInsert) {
      console.error("Error guardando arrepentimiento/baja:", errorInsert)
      return NextResponse.json({ error: "No se pudo guardar el pedido." }, { status: 500 })
    }

    const advertencias: string[] = []

    const envioParticipante = await enviarArrepentimientoParticipante({
      tipo,
      nombre,
      email,
      codigo,
    }).catch((error) => {
      console.error("Error enviando mail de arrepentimiento/baja al participante:", error)
      return { enviado: false as const, motivo: String(error) }
    })
    if (!envioParticipante.enviado) advertencias.push("No se pudo enviar el mail con el código.")

    const envioAdmin = await enviarArrepentimientoAdmin({
      tipo,
      nombre,
      email,
      actividad,
      motivo,
      codigo,
    }).catch((error) => {
      console.error("Error enviando mail de arrepentimiento/baja a admin:", error)
      return { enviado: false as const, motivo: String(error) }
    })
    if (!envioAdmin.enviado) advertencias.push("No se pudo avisar por mail al admin.")

    return NextResponse.json({
      ok: true,
      codigo,
      ...(advertencias.length ? { advertencias } : {}),
    })
  } catch (error) {
    console.error("Error en /api/arrepentimientos:", error)
    return NextResponse.json({ error: "Error interno." }, { status: 500 })
  }
}
