import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { obtenerPartesArgentina } from "@/lib/fechas"

// Salida de solo lectura para que la planilla de Google de Nicolás pueda
// pedir los datos de preinscripciones cada diez minutos sin tener una
// clave de Supabase guardada en una cuenta de Google (esa clave abre toda
// la base). Acá el gate es un token propio, acotado a este único endpoint.

const PLAN_PAGO_TEXTO: Record<string, string> = {
  unico: "Pago único",
  mensual: "Mes a mes",
}

const TIENE_PROYECTO_TEXTO: Record<string, string> = {
  si: "Sí, lo tengo claro",
  idea: "Tengo una idea dando vueltas",
  no: "Todavía no",
}

type PreinscripcionRow = {
  id: number
  nombre: string | null
  apellido: string | null
  email: string | null
  whatsapp: string | null
  pais: string | null
  plan_pago: string | null
  tiene_proyecto: string | null
  proyecto_descripcion: string | null
  created_at: string
}

// Comparación con largo desparejo: timingSafeEqual tira una excepción en
// vez de devolver false, así que el chequeo de longitud tiene que ir
// antes — no hay forma de evitarlo sin perder la comparación de tiempo
// constante para el caso normal (mismo largo, contenido distinto).
function tokenValido(req: Request) {
  const tokenConfigurado = process.env.PLANILLA_TOKEN

  if (!tokenConfigurado) {
    return false
  }

  const tokenRecibido = new URL(req.url).searchParams.get("token") || ""
  const esperado = Buffer.from(tokenConfigurado)
  const recibido = Buffer.from(tokenRecibido)

  if (esperado.length !== recibido.length) {
    return false
  }

  return timingSafeEqual(esperado, recibido)
}

function formatearFechaArgentina(iso: string) {
  const partes = obtenerPartesArgentina(new Date(iso))
  const dd = String(partes.day).padStart(2, "0")
  const mm = String(partes.month).padStart(2, "0")
  const hh = String(partes.hour).padStart(2, "0")
  const min = String(partes.minute).padStart(2, "0")

  return `${dd}/${mm}/${partes.year} ${hh}:${min}`
}

export async function GET(req: Request) {
  if (!tokenValido(req)) {
    return new NextResponse(null, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from("preinscripciones")
    .select(
      "id, nombre, apellido, email, whatsapp, pais, plan_pago, tiene_proyecto, proyecto_descripcion, created_at"
    )
    .order("id", { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: "No se pudieron leer las preinscripciones.", detalle: error },
      { status: 500 }
    )
  }

  const filas = ((data as PreinscripcionRow[]) || []).map((row) => ({
    id: row.id,
    fecha: formatearFechaArgentina(row.created_at),
    nombre: row.nombre || "",
    apellido: row.apellido || "",
    whatsapp: row.whatsapp || "",
    email: row.email || "",
    pais: row.pais || "",
    plan: (row.plan_pago && PLAN_PAGO_TEXTO[row.plan_pago]) || row.plan_pago || "",
    tiene_proyecto:
      (row.tiene_proyecto && TIENE_PROYECTO_TEXTO[row.tiene_proyecto]) || row.tiene_proyecto || "",
    proyecto: row.proyecto_descripcion || "",
  }))

  return NextResponse.json(filas, {
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  })
}
