import { NextResponse } from "next/server"
import {
  hasAnyPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { isDevelopmentPreviewEnabled } from "@/lib/dev-flags"
import { obtenerPartesArgentina } from "@/lib/fechas"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
const MODO_PRUEBA = isDevelopmentPreviewEnabled()

type Body = {
  videoId: number
  votanteNombre: string
  votanteEmail?: string
}

export async function POST(req: Request) {
  try {
    const auth = await requireActivityAccess("casatalentos", "casatalentos.admin")

    if ("response" in auth) {
      return auth.response
    }

    if (
      !hasAnyPermission(auth.actor, [
        "casatalentos.vote",
        "casatalentos.admin",
      ])
    ) {
      return NextResponse.json(
        { error: "No tenés permisos para elegir videos." },
        { status: 403 }
      )
    }

    const body: Body = await req.json()
    const videoId = Number(body.videoId)
    const votanteNombre = auth.actor.name
    const votanteEmail = auth.actor.email

    if (!videoId) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios" },
        { status: 400 }
      )
    }

    if (!MODO_PRUEBA) {
      const ahora = obtenerPartesArgentina()

      if (ahora.weekdayShort !== "Wed") {
        return NextResponse.json(
          { error: "La evaluación solo está habilitada los miércoles." },
          { status: 400 }
        )
      }

      const minutosActuales = ahora.hour * 60 + ahora.minute
      const inicio = 18 * 60 + 30
      const fin = 21 * 60 + 30

      if (minutosActuales < inicio || minutosActuales > fin) {
        return NextResponse.json(
          { error: "La evaluación está habilitada solo entre las 18:30 y las 21:30 hs." },
          { status: 400 }
        )
      }
    }

    const supabase = createAdminSupabaseClient()

    const { data: video, error: videoError } = await supabase
      .from("casatalentos_videos")
      .select("id, fecha_semana")
      .eq("id", videoId)
      .single()

    if (videoError || !video) {
      return NextResponse.json(
        { error: "No se encontró el video", detalle: videoError },
        { status: 404 }
      )
    }

    const fechaSemana = video.fecha_semana || null

    if (!fechaSemana) {
      return NextResponse.json(
        { error: "El video no tiene fecha de semana asociada" },
        { status: 400 }
      )
    }

    const consulta = votanteEmail
      ? supabase
          .from("casatalentos_votos")
          .select("*")
          .eq("votante_email", votanteEmail.trim())
          .eq("fecha_semana", fechaSemana)
          .maybeSingle()
      : supabase
          .from("casatalentos_votos")
          .select("*")
          .eq("votante_nombre", votanteNombre.trim())
          .eq("fecha_semana", fechaSemana)
          .maybeSingle()

    const { data: votoExistente, error: existenteError } = await consulta

    if (existenteError) {
      return NextResponse.json(
        { error: "No se pudo consultar la elección existente", detalle: existenteError },
        { status: 500 }
      )
    }

    if (votoExistente) {
      const { error: updateError } = await supabase
        .from("casatalentos_votos")
        .update({
          video_id: videoId,
          votante_nombre: votanteNombre.trim(),
          votante_email: votanteEmail || null,
          fecha_semana: fechaSemana,
          created_at: new Date().toISOString(),
        })
        .eq("id", votoExistente.id)

      if (updateError) {
        return NextResponse.json(
          { error: "No se pudo actualizar la elección", detalle: updateError },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ok: true,
        actualizado: true,
        modo_prueba: MODO_PRUEBA,
      })
    }

    const { error: insertError } = await supabase
      .from("casatalentos_votos")
      .insert({
        video_id: videoId,
        votante_nombre: votanteNombre.trim(),
        votante_email: votanteEmail || null,
        fecha_semana: fechaSemana,
      })

    if (insertError) {
      return NextResponse.json(
        { error: "No se pudo guardar la elección", detalle: insertError },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      actualizado: false,
      modo_prueba: MODO_PRUEBA,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno eligiendo",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
