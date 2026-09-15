import { NextResponse } from "next/server"
import { requireAuthenticatedActor } from "@/lib/authz"
import {
  CONSENTIMIENTO_VERSION,
  TERMINOS_VERSION,
  esActividadConsentimiento,
} from "@/lib/consentimientos"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  actividad?: string
  disponibilidadId?: number | string | null
  fechaEncuentro?: string | null
  horaEncuentro?: string | null
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const { searchParams } = new URL(req.url)
    const actividad = searchParams.get("actividad") || ""
    const disponibilidadIdRaw = searchParams.get("disponibilidadId")
    const disponibilidadId = disponibilidadIdRaw
      ? Number(disponibilidadIdRaw)
      : null
    const fechaEncuentro = searchParams.get("fechaEncuentro")
    const horaEncuentro = searchParams.get("horaEncuentro")

    if (!esActividadConsentimiento(actividad)) {
      return NextResponse.json(
        { error: "Actividad inválida para consentimiento." },
        { status: 400 }
      )
    }

    if (disponibilidadIdRaw && Number.isNaN(disponibilidadId)) {
      return NextResponse.json(
        { error: "Encuentro inválido para consentimiento." },
        { status: 400 }
      )
    }

    // Sin disponibilidadId no hay encuentro identificado (la charla
    // introductoria, o cualquier caso donde el id no llegue) — no se busca
    // nada y se muestra el cartel siempre. Buscar acá una aceptación
    // anterior de la actividad rompía la regla de la sección 17 de los
    // Términos ("cada encuentro pregunta"), porque una aceptación vieja de
    // OTRO encuentro sin id dejaba pasar sin preguntar.
    if (disponibilidadId === null) {
      return NextResponse.json({
        ok: true,
        actividad,
        version: CONSENTIMIENTO_VERSION,
        aceptado: false,
        consentimiento: null,
      })
    }

    const supabase = createAdminSupabaseClient()

    let query = supabase
      .from("consentimientos")
      .select(
        "id, aceptado, version, created_at, disponibilidad_id, fecha_encuentro, hora_encuentro"
      )
      .eq("user_email", auth.actor.email)
      .eq("actividad", actividad)
      .eq("version", CONSENTIMIENTO_VERSION)
      .eq("aceptado", true)
      .eq("disponibilidad_id", disponibilidadId)

    if (fechaEncuentro) {
      query = query.eq("fecha_encuentro", fechaEncuentro)
    }

    if (horaEncuentro) {
      query = query.eq("hora_encuentro", horaEncuentro)
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .maybeSingle()

    if (error) {
      throw error
    }

    return NextResponse.json({
      ok: true,
      actividad,
      version: CONSENTIMIENTO_VERSION,
      aceptado: Boolean(data),
      consentimiento: data || null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo verificar el consentimiento.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const body = (await req.json()) as Body
    const actividad = body.actividad || ""
    const disponibilidadId =
      body.disponibilidadId !== undefined &&
      body.disponibilidadId !== null &&
      body.disponibilidadId !== ""
        ? Number(body.disponibilidadId)
        : null

    if (!esActividadConsentimiento(actividad)) {
      return NextResponse.json(
        { error: "Actividad inválida para consentimiento." },
        { status: 400 }
      )
    }

    if (
      body.disponibilidadId !== undefined &&
      body.disponibilidadId !== null &&
      Number.isNaN(disponibilidadId)
    ) {
      return NextResponse.json(
        { error: "Encuentro inválido para consentimiento." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    // Siempre una fila nueva, nunca upsert: cada aceptación es su propia
    // constancia (sección 17 de los Términos). Con el upsert de antes, una
    // aceptación con disponibilidad_id null pisaba a la anterior en vez de
    // dejar historial.
    const { data, error } = await supabase
      .from("consentimientos")
      .insert({
        user_email: auth.actor.email,
        actividad,
        disponibilidad_id: disponibilidadId,
        fecha_encuentro: body.fechaEncuentro || null,
        hora_encuentro: body.horaEncuentro || null,
        aceptado: true,
        version: CONSENTIMIENTO_VERSION,
        terminos_version: TERMINOS_VERSION,
      })
      .select("*")
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      ok: true,
      consentimiento: data,
    })
  } catch (error) {
    // Plan B (Prompt 44): que esto falle nunca deja a nadie afuera de su
    // encuentro — ConsentimientoMeetButton deja pasar igual aunque este
    // POST devuelva error. Lo único que se pierde acá es el registro, así
    // que queda anotado en el log del servidor para poder repararlo después.
    console.error("[consentimientos][POST] No se pudo guardar el consentimiento:", error)

    return NextResponse.json(
      {
        error: "No se pudo guardar el consentimiento.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
