import { NextResponse } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import {
  calcularDescuentoPct,
  calcularMontos,
  estaInscripcionAbierta,
  formatearMontoArs,
  formatearMontoInternacional,
  PAISES,
  type MonedaInternacional,
  type PlanPago,
  type TieneProyecto,
} from "@/lib/proyecto-inposible"
import { MERCADOPAGO, TRANSFERENCIA_ARS, TRANSFERENCIA_INTERNACIONAL } from "@/lib/proyecto-inposible-pagos"
import {
  enviarPreinscripcionAdmin,
  enviarPreinscripcionParticipante,
  type PreinscripcionInstruccionesPago,
} from "@/lib/mailing"

const TIENE_PROYECTO_VALORES: TieneProyecto[] = ["si", "idea", "no"]
const PLAN_PAGO_VALORES: PlanPago[] = ["mensual", "unico"]
const MONEDA_INTERNACIONAL_VALORES: MonedaInternacional[] = ["USD", "EUR"]

const TIENE_PROYECTO_TEXTO: Record<TieneProyecto, string> = {
  si: "Sí, lo tiene claro",
  idea: "Tiene una idea dando vueltas",
  no: "Todavía no",
}

const PLAN_PAGO_TEXTO: Record<PlanPago, string> = {
  mensual: "Mes a mes",
  unico: "Pago único",
}

// Rate limit simple por IP: en memoria del proceso — alcanza para frenar un
// doble envío accidental o un bot básico. No sobrevive a un cold start
// nuevo de la función serverless, y eso está bien para este caso de uso.
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

function obtenerOrigen(req: Request) {
  const referer = req.headers.get("referer")
  if (!referer) return null

  try {
    const url = new URL(referer)
    const utmSource = url.searchParams.get("utm_source")
    if (utmSource) return utmSource
    return `${url.hostname}${url.pathname}`
  } catch {
    return referer
  }
}

type Body = {
  nombre?: string
  apellido?: string
  email?: string
  whatsapp?: string
  pais?: string
  tieneProyecto?: string
  proyectoDescripcion?: string
  planPago?: string
  monedaInternacional?: string
}

export async function POST(req: Request) {
  try {
    if (!estaInscripcionAbierta()) {
      return NextResponse.json(
        { error: "La inscripción a Proyecto In+Posible ya cerró." },
        { status: 409 }
      )
    }

    const ip = obtenerIp(req)
    if (estaLimitadoPorIp(ip)) {
      return NextResponse.json(
        { error: "Demasiados intentos. Probá de nuevo en un rato." },
        { status: 429 }
      )
    }

    const body: Body = await req.json().catch(() => ({}))

    const nombre = String(body.nombre || "").trim()
    const apellido = String(body.apellido || "").trim()
    const email = String(body.email || "").trim().toLowerCase()
    const whatsapp = String(body.whatsapp || "").trim()
    const pais = String(body.pais || "Argentina").trim()
    const tieneProyecto = String(body.tieneProyecto || "") as TieneProyecto
    const proyectoDescripcion = String(body.proyectoDescripcion || "").trim()
    const planPago = String(body.planPago || "") as PlanPago
    const monedaInternacionalPedida = String(body.monedaInternacional || "USD") as MonedaInternacional

    if (!nombre || !apellido) {
      return NextResponse.json({ error: "Falta nombre o apellido." }, { status: 400 })
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Ingresá un email válido." }, { status: 400 })
    }
    if (!whatsapp) {
      return NextResponse.json({ error: "Falta el WhatsApp." }, { status: 400 })
    }
    if (!TIENE_PROYECTO_VALORES.includes(tieneProyecto)) {
      return NextResponse.json({ error: "Elegí una opción sobre tu proyecto." }, { status: 400 })
    }
    if (!PLAN_PAGO_VALORES.includes(planPago)) {
      return NextResponse.json({ error: "Elegí un plan de pago." }, { status: 400 })
    }
    if (!PAISES.includes(pais as (typeof PAISES)[number])) {
      return NextResponse.json({ error: "País inválido." }, { status: 400 })
    }

    const monedaInternacional: MonedaInternacional = MONEDA_INTERNACIONAL_VALORES.includes(
      monedaInternacionalPedida
    )
      ? monedaInternacionalPedida
      : "USD"

    // El monto y la moneda se calculan acá, nunca se confía en lo que
    // mande el cliente — mismo criterio para el descuento.
    const montos = calcularMontos(planPago, pais, monedaInternacional)
    const descuentoPct = calcularDescuentoPct(planPago)
    const moneda = montos.esInternacional ? montos.moneda : "ARS"

    const supabase = createAdminSupabaseClient()
    const { error: errorInsert } = await supabase.from("preinscripciones").insert({
      nombre,
      apellido,
      email,
      whatsapp,
      pais,
      tiene_proyecto: tieneProyecto,
      proyecto_descripcion: proyectoDescripcion || null,
      plan_pago: planPago,
      moneda,
      descuento_pct: descuentoPct,
      origen: obtenerOrigen(req),
    })

    if (errorInsert) {
      console.error("Error guardando preinscripción:", errorInsert)
      return NextResponse.json({ error: "No se pudo guardar la preinscripción." }, { status: 500 })
    }

    const pago: PreinscripcionInstruccionesPago = montos.esInternacional
      ? {
          esInternacional: true,
          montoTexto: formatearMontoInternacional(montos.monto, montos.moneda),
          titular: TRANSFERENCIA_INTERNACIONAL.titular,
          banco: TRANSFERENCIA_INTERNACIONAL.banco,
          tipoCuenta: TRANSFERENCIA_INTERNACIONAL.tipoCuenta,
          cuenta: TRANSFERENCIA_INTERNACIONAL.cuenta,
          ruta: TRANSFERENCIA_INTERNACIONAL.ruta,
          direccion: TRANSFERENCIA_INTERNACIONAL.direccion,
        }
      : {
          esInternacional: false,
          transferencia: {
            montoTexto: formatearMontoArs(montos.transferencia),
            alias: TRANSFERENCIA_ARS.alias,
            cvu: TRANSFERENCIA_ARS.cvu,
            titular: TRANSFERENCIA_ARS.titular,
          },
          mercadopago: {
            montoTexto: formatearMontoArs(MERCADOPAGO[planPago].monto),
            link: MERCADOPAGO[planPago].link,
          },
        }

    const montoTexto = montos.esInternacional
      ? formatearMontoInternacional(montos.monto, montos.moneda)
      : `${formatearMontoArs(montos.transferencia)} transferencia / ${formatearMontoArs(montos.mercadopago)} Mercado Pago`

    const advertencias: string[] = []

    const envioParticipante = await enviarPreinscripcionParticipante({
      nombre,
      email,
      planPagoTexto: PLAN_PAGO_TEXTO[planPago],
      pago,
    }).catch((error) => {
      console.error("Error enviando mail de preinscripción al participante:", error)
      return { enviado: false as const, motivo: String(error) }
    })
    if (!envioParticipante.enviado) advertencias.push("No se pudo enviar el mail de confirmación.")

    const envioAdmin = await enviarPreinscripcionAdmin({
      nombre,
      apellido,
      email,
      whatsapp,
      pais,
      tieneProyectoTexto: TIENE_PROYECTO_TEXTO[tieneProyecto],
      proyectoDescripcion,
      planPagoTexto: PLAN_PAGO_TEXTO[planPago],
      montoTexto,
    }).catch((error) => {
      console.error("Error enviando mail de preinscripción a admin:", error)
      return { enviado: false as const, motivo: String(error) }
    })
    if (!envioAdmin.enviado) advertencias.push("No se pudo avisar por mail al admin.")

    return NextResponse.json({
      ok: true,
      nombre,
      planPago,
      pais,
      moneda,
      ...(advertencias.length ? { advertencias } : {}),
    })
  } catch (error) {
    console.error("Error en /api/preinscripcion:", error)
    return NextResponse.json({ error: "Error interno." }, { status: 500 })
  }
}
