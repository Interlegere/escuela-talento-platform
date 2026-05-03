import { NextResponse } from "next/server"
import { requireAuthenticatedActor } from "@/lib/authz"
import {
  CONSENTIMIENTO_VERSION,
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

    if (disponibilidadId !== null) {
      query = query.eq("disponibilidad_id", disponibilidadId)
    } else {
      query = query.is("disponibilidad_id", null)
    }

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

    const { data, error } = await supabase
      .from("consentimientos")
      .upsert(
        {
          user_email: auth.actor.email,
          actividad,
          disponibilidad_id: disponibilidadId,
          fecha_encuentro: body.fechaEncuentro || null,
          hora_encuentro: body.horaEncuentro || null,
          aceptado: true,
          version: CONSENTIMIENTO_VERSION,
        },
        {
          onConflict: "user_email,actividad,version,disponibilidad_id",
          ignoreDuplicates: false,
        }
      )
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
    return NextResponse.json(
      {
        error: "No se pudo guardar el consentimiento.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
