import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type MensajeAgenteRow = {
  id: number
  participante_email: string
  fecha: string
  tipo_caso: string | null
  texto_generado: string | null
  estado: string
  motivo_omision: string | null
  valoracion: string | null
  nota: string | null
  created_at: string
}

// No genera nada nuevo con IA — solo lee lo que lib/agente-entusiasmo.ts ya
// insertó en cada corrida diaria (ver app/api/entusiasmo/agente/diario).
const LIMITE_MENSAJES = 20

export async function GET(req: Request) {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return auth.response
    }

    const url = new URL(req.url)
    const emailConsultado = url.searchParams.get("email")?.trim().toLowerCase()
    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")

    // Mismo chequeo que /api/entusiasmo/aportes: nunca los mensajes de otra
    // persona, salvo que quien pregunta sea admin.
    if (emailConsultado && emailConsultado !== auth.actor.email && !esAdmin) {
      return NextResponse.json(
        { error: "No podés ver los mensajes del agente de otra persona." },
        { status: 403 }
      )
    }

    const emailObjetivo = emailConsultado || auth.actor.email
    const supabase = createAdminSupabaseClient()

    const { data, error } = await supabase
      .from("entusiasmo_agente_mensajes")
      .select("*")
      .eq("participante_email", emailObjetivo)
      .eq("estado", "enviado")
      .order("fecha", { ascending: false })
      .limit(LIMITE_MENSAJES)

    if (error) {
      return NextResponse.json(
        { error: "No se pudieron cargar los mensajes del agente.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, mensajes: (data as MensajeAgenteRow[]) || [] })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno cargando los mensajes del agente.", detalle: String(error) },
      { status: 500 }
    )
  }
}

type PatchBody = {
  id?: number
  valoracion?: string | null
}

const VALORACIONES_VALIDAS = ["util", "no_util"]

export async function PATCH(req: Request) {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return auth.response
    }

    const body: PatchBody = await req.json()
    const id = Number(body.id)

    if (!id) {
      return NextResponse.json({ error: "Falta el id del mensaje." }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()

    const { data: existente } = await supabase
      .from("entusiasmo_agente_mensajes")
      .select("participante_email")
      .eq("id", id)
      .maybeSingle<{ participante_email: string }>()

    if (!existente) {
      return NextResponse.json({ error: "No se encontró el mensaje." }, { status: 404 })
    }

    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")
    const esDueno = existente.participante_email === auth.actor.email

    // Solo la persona que recibió el mensaje puede decir si le sirvió (el
    // admin puede corregirlo si hiciera falta, mismo criterio que el resto
    // de los endpoints de Entusiasmento).
    if (!esDueno && !esAdmin) {
      return NextResponse.json(
        { error: "No podés calificar el mensaje de otra persona." },
        { status: 403 }
      )
    }

    const valoracion = body.valoracion?.trim() || null

    if (valoracion && !VALORACIONES_VALIDAS.includes(valoracion)) {
      return NextResponse.json({ error: "Valoración inválida." }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("entusiasmo_agente_mensajes")
      .update({ valoracion })
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo guardar la valoración.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, mensaje: data as MensajeAgenteRow })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno guardando la valoración.", detalle: String(error) },
      { status: 500 }
    )
  }
}
