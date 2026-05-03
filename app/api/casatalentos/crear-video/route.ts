import { NextResponse } from "next/server"
import {
  hasAnyPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { obtenerPartesArgentina } from "@/lib/fechas"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

function limpiarNombreArchivo(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
}

function weekdayToDiaClave(weekday: string) {
  if (weekday === "Mon") return "lunes"
  if (weekday === "Tue") return "martes"
  if (weekday === "Wed") return "miercoles"
  return null
}

function obtenerFechaSemanaLunes(year: number, month: number, day: number, weekday: string) {
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  }

  const offset = map[weekday]
  const base = new Date(Date.UTC(year, month - 1, day))
  base.setUTCDate(base.getUTCDate() - offset)

  const yyyy = base.getUTCFullYear()
  const mm = String(base.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(base.getUTCDate()).padStart(2, "0")

  return `${yyyy}-${mm}-${dd}`
}

export async function POST(req: Request) {
  try {
    const auth = await requireActivityAccess("casatalentos", "casatalentos.admin")

    if ("response" in auth) {
      return auth.response
    }

    if (
      !hasAnyPermission(auth.actor, [
        "casatalentos.participate",
        "casatalentos.admin",
      ])
    ) {
      return NextResponse.json(
        { error: "No tenés permisos para subir videos." },
        { status: 403 }
      )
    }

    const formData = await req.formData()

    const participanteNombre =
      String(formData.get("participanteNombre") || "").trim() || auth.actor.name
    const participanteEmail = auth.actor.email
    const titulo = String(formData.get("titulo") || "").trim()

    const archivo = formData.get("archivo")

    if (!participanteNombre || !titulo) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios" },
        { status: 400 }
      )
    }

    if (!(archivo instanceof File)) {
      return NextResponse.json(
        { error: "Falta el archivo de video" },
        { status: 400 }
      )
    }

    if (!archivo.type.startsWith("video/")) {
      return NextResponse.json(
        { error: "El archivo debe ser un video" },
        { status: 400 }
      )
    }

    const maxBytes = 50 * 1024 * 1024
    if (archivo.size > maxBytes) {
      return NextResponse.json(
        { error: "El video supera el máximo permitido de 50MB" },
        { status: 400 }
      )
    }

    const ahora = obtenerPartesArgentina()
    const diaClave = weekdayToDiaClave(ahora.weekdayShort)

    if (!diaClave) {
      return NextResponse.json(
        { error: "Los videos del dispositivo solo se pueden subir lunes, martes o miércoles." },
        { status: 400 }
      )
    }

    if (diaClave === "miercoles") {
      const minutosActuales = ahora.hour * 60 + ahora.minute
      const limite = 18 * 60 + 30

      if (minutosActuales > limite) {
        return NextResponse.json(
          { error: "El video del miércoles solo puede subirse hasta las 18:30 hs." },
          { status: 400 }
        )
      }
    }

    const fechaSemana = obtenerFechaSemanaLunes(
      ahora.year,
      ahora.month,
      ahora.day,
      ahora.weekdayShort
    )

    const supabase = createAdminSupabaseClient()

    const participanteClave = participanteEmail || participanteNombre

    const consulta = participanteEmail
      ? supabase
          .from("casatalentos_videos")
          .select("*")
          .eq("participante_email", participanteEmail)
          .eq("fecha_semana", fechaSemana)
          .eq("dia_clave", diaClave)
          .maybeSingle()
      : supabase
          .from("casatalentos_videos")
          .select("*")
          .eq("participante_nombre", participanteClave)
          .eq("fecha_semana", fechaSemana)
          .eq("dia_clave", diaClave)
          .maybeSingle()

    const { data: existente, error: existenteError } = await consulta

    if (existenteError) {
      return NextResponse.json(
        { error: "No se pudo validar el video existente", detalle: existenteError },
        { status: 500 }
      )
    }

    if (existente) {
      return NextResponse.json(
        { error: `Ya subiste tu video de ${diaClave} para esta semana.` },
        { status: 400 }
      )
    }

    const extensionOriginal = archivo.name.split(".").pop() || "mp4"
    const extension = limpiarNombreArchivo(extensionOriginal)
    const nombreBase = limpiarNombreArchivo(titulo || archivo.name || "video")
    const timestamp = Date.now()

    const storagePath = `${fechaSemana}/${diaClave}/${timestamp}-${nombreBase}.${extension}`

    const arrayBuffer = await archivo.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from("casatalentos-videos")
      .upload(storagePath, buffer, {
        contentType: archivo.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: "No se pudo subir el archivo al storage", detalle: uploadError },
        { status: 500 }
      )
    }

    const { data, error } = await supabase
      .from("casatalentos_videos")
      .insert({
        participante_nombre: participanteNombre,
        participante_email: participanteEmail || null,
        titulo,
        dia: diaClave,
        dia_clave: diaClave,
        fecha_semana: fechaSemana,
        video_url: null,
        storage_path: storagePath,
        mime_type: archivo.type || null,
        file_size: archivo.size || null,
      })
      .select("*")
      .single()

    if (error) {
      await supabase.storage.from("casatalentos-videos").remove([storagePath])

      return NextResponse.json(
        { error: "No se pudo crear el registro del video", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      video: data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno creando video",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
