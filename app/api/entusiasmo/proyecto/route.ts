import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const BUCKET = process.env.SUPABASE_ENTUSIASMO_BUCKET || "entusiasmo-producciones"

type ProyectoRow = {
  id: number
  participante_email: string
  participante_nombre: string | null
  que: string | null
  para_que: string | null
  problema_solucion: string | null
  resultado_semanal: string | null
  resultado_mensual: string | null
  resultado_trimestral: string | null
  resultado_anual: string | null
  habilidad_a_desarrollar: string | null
  que_te_entusiasma: string | null
  pitch_contenido: string | null
  pitch_storage_path: string | null
  pitch_mime_type: string | null
  pitch_actualizado_at: string | null
  created_at: string
  updated_at: string
}

type Body = {
  participanteEmail?: string
  que?: string
  paraQue?: string
  problemaSolucion?: string
  resultadoSemanal?: string
  resultadoMensual?: string
  resultadoTrimestral?: string
  resultadoAnual?: string
  habilidadADesarrollar?: string
  queTeEntusiasma?: string
  pitchContenido?: string
}

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

    if (emailConsultado && emailConsultado !== auth.actor.email && !esAdmin) {
      return NextResponse.json(
        { error: "No podés ver el proyecto de otra persona." },
        { status: 403 }
      )
    }

    const emailObjetivo = emailConsultado || auth.actor.email
    const supabase = createAdminSupabaseClient()

    const { data, error } = await supabase
      .from("entusiasmo_proyectos")
      .select("*")
      .eq("participante_email", emailObjetivo)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo cargar el proyecto.", detalle: error },
        { status: 500 }
      )
    }

    const proyecto = (data as ProyectoRow | null) || null
    let pitchSignedUrl: string | null = null

    if (proyecto?.pitch_storage_path) {
      const { data: signedData } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(proyecto.pitch_storage_path, 60 * 60)

      pitchSignedUrl = signedData?.signedUrl || null
    }

    return NextResponse.json({ ok: true, proyecto, pitchSignedUrl })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno cargando el proyecto.", detalle: String(error) },
      { status: 500 }
    )
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")
    const emailSolicitado = body.participanteEmail?.trim().toLowerCase()

    if (emailSolicitado && emailSolicitado !== auth.actor.email && !esAdmin) {
      return NextResponse.json(
        { error: "No podés editar el proyecto de otra persona." },
        { status: 403 }
      )
    }

    const emailObjetivo = emailSolicitado || auth.actor.email
    const esPropio = emailObjetivo === auth.actor.email
    const supabase = createAdminSupabaseClient()

    let participanteNombre: string | null = null

    if (esPropio) {
      participanteNombre = auth.actor.name || null
    } else {
      const { data: existente } = await supabase
        .from("entusiasmo_proyectos")
        .select("participante_nombre")
        .eq("participante_email", emailObjetivo)
        .maybeSingle()

      participanteNombre = existente?.participante_nombre || null
    }

    const { data, error } = await supabase
      .from("entusiasmo_proyectos")
      .upsert(
        {
          participante_email: emailObjetivo,
          participante_nombre: participanteNombre,
          que: body.que ?? null,
          para_que: body.paraQue ?? null,
          problema_solucion: body.problemaSolucion ?? null,
          resultado_semanal: body.resultadoSemanal ?? null,
          resultado_mensual: body.resultadoMensual ?? null,
          resultado_trimestral: body.resultadoTrimestral ?? null,
          resultado_anual: body.resultadoAnual ?? null,
          habilidad_a_desarrollar: body.habilidadADesarrollar ?? null,
          que_te_entusiasma: body.queTeEntusiasma ?? null,
          pitch_contenido: body.pitchContenido ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "participante_email" }
      )
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo guardar el proyecto.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, proyecto: data as ProyectoRow })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno guardando el proyecto.", detalle: String(error) },
      { status: 500 }
    )
  }
}
