import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import {
  calcularProximaEjecucion,
  type Recurrencia,
} from "@/lib/comunicaciones-programadas"
import type { FiltroPagoPendiente, SegmentoComunicacion } from "@/lib/comunicaciones"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  nombre?: string
  tipo?: string
  actividadSlug?: string | null
  asunto?: string
  contenido?: string
  segmento?: SegmentoComunicacion
  filtroPagoPendiente?: FiltroPagoPendiente | null
  emailsManual?: string | null
  destinatariosSeleccionados?: Array<{ email?: string | null; fuente?: string | null }>
  recurrencia?: Recurrencia
  fechaUnaVez?: string | null
  diaSemana?: number | null
  diaMes?: number | null
  intervaloDias?: number | null
  hora?: string
  modoDisparo?: "automatico" | "requiere_aprobacion"
}

const RECURRENCIAS_VALIDAS: Recurrencia[] = [
  "una_vez",
  "semanal",
  "mensual",
  "intervalo_dias",
]

export async function GET() {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const supabase = createAdminSupabaseClient()

    const { data, error } = await supabase
      .from("comunicaciones_programadas")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "No se pudieron cargar las programaciones.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, programadas: data || [] })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno cargando programaciones.", detalle: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()

    const nombre = String(body.nombre || "").trim()
    const asunto = String(body.asunto || "").trim()
    const contenido = String(body.contenido || "").trim()
    const segmento = body.segmento
    const recurrencia = body.recurrencia
    const hora = String(body.hora || "").trim()
    const modoDisparo = body.modoDisparo === "automatico" ? "automatico" : "requiere_aprobacion"

    if (!nombre || !asunto || !contenido || !segmento) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios (nombre, asunto, contenido o segmento)." },
        { status: 400 }
      )
    }

    if (!recurrencia || !RECURRENCIAS_VALIDAS.includes(recurrencia)) {
      return NextResponse.json(
        { error: "Tipo de recurrencia inválido." },
        { status: 400 }
      )
    }

    if (!/^\d{2}:\d{2}$/.test(hora)) {
      return NextResponse.json(
        { error: "La hora debe tener formato HH:MM." },
        { status: 400 }
      )
    }

    let proximaEjecucion: Date

    try {
      proximaEjecucion = calcularProximaEjecucion({
        recurrencia,
        fechaUnaVez: body.fechaUnaVez || null,
        diaSemana: body.diaSemana ?? null,
        diaMes: body.diaMes ?? null,
        intervaloDias: body.intervaloDias ?? null,
        hora,
      })
    } catch (calculoError) {
      return NextResponse.json(
        {
          error:
            calculoError instanceof Error
              ? calculoError.message
              : "No se pudo calcular la próxima ejecución.",
        },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data, error } = await supabase
      .from("comunicaciones_programadas")
      .insert({
        nombre,
        tipo: body.tipo || "general",
        actividad_slug: body.actividadSlug || null,
        asunto,
        contenido,
        segmento,
        filtro_pago_pendiente: body.filtroPagoPendiente || null,
        emails_manual: body.emailsManual || null,
        destinatarios_seleccionados: body.destinatariosSeleccionados || [],
        recurrencia,
        fecha_una_vez: body.fechaUnaVez || null,
        dia_semana: body.diaSemana ?? null,
        dia_mes: body.diaMes ?? null,
        intervalo_dias: body.intervaloDias ?? null,
        hora,
        modo_disparo: modoDisparo,
        proxima_ejecucion: proximaEjecucion.toISOString(),
        creado_por_email: auth.actor.email,
      })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo crear la programación.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, programada: data })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno creando la programación.", detalle: String(error) },
      { status: 500 }
    )
  }
}
