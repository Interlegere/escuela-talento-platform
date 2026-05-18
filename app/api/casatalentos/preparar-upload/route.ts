import { NextResponse } from "next/server"
import {
  hasAnyPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { obtenerPartesArgentina } from "@/lib/fechas"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const BUCKET = "casatalentos-videos"
const MAX_BYTES = 50 * 1024 * 1024

type Body = {
  titulo?: string
  fileName?: string
  mimeType?: string
  fileSize?: number
  participanteNombre?: string
}

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

function extensionDesdeNombre(nombre?: string, mimeType?: string) {
  const extension = String(nombre || "").split(".").pop() || ""

  if (extension) {
    return limpiarNombreArchivo(extension)
  }

  if (mimeType?.includes("webm")) return "webm"
  if (mimeType?.includes("quicktime")) return "mov"
  return "mp4"
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

    const body = (await req.json()) as Body
    const participanteNombre =
      String(body.participanteNombre || "").trim() || auth.actor.name
    const participanteEmail = auth.actor.email
    const titulo = String(body.titulo || "").trim()
    const fileName = String(body.fileName || "").trim()
    const mimeType = String(body.mimeType || "").trim()
    const fileSize = Number(body.fileSize || 0)

    if (!participanteNombre || !titulo) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios." },
        { status: 400 }
      )
    }

    if (!mimeType.startsWith("video/")) {
      return NextResponse.json(
        { error: "El archivo debe ser un video." },
        { status: 400 }
      )
    }

    if (!fileSize || fileSize > MAX_BYTES) {
      return NextResponse.json(
        { error: "El video supera el máximo permitido de 50MB." },
        { status: 400 }
      )
    }

    const ahora = obtenerPartesArgentina()
    const diaClave = weekdayToDiaClave(ahora.weekdayShort)

    if (!diaClave) {
      const errorSubida =
        ahora.weekdayShort === "Tue"
          ? "El martes es día de aportes escritos. Los videos del dispositivo se suben lunes y miércoles."
          : "Los videos del dispositivo solo se pueden subir lunes y miércoles."
      return NextResponse.json({ error: errorSubida }, { status: 400 })
    }

    const fechaSemana = obtenerFechaSemanaLunes(
      ahora.year,
      ahora.month,
      ahora.day,
      ahora.weekdayShort
    )

    const supabase = createAdminSupabaseClient()

    const { data: existente, error: existenteError } = await supabase
      .from("casatalentos_videos")
      .select("id")
      .eq("participante_email", participanteEmail)
      .eq("fecha_semana", fechaSemana)
      .eq("dia_clave", diaClave)
      .maybeSingle()

    if (existenteError) {
      return NextResponse.json(
        { error: "No se pudo validar el video existente.", detalle: existenteError },
        { status: 500 }
      )
    }

    if (existente) {
      return NextResponse.json(
        { error: `Ya subiste tu video de ${diaClave} para esta semana.` },
        { status: 400 }
      )
    }

    const extension = extensionDesdeNombre(fileName, mimeType)
    const nombreBase = limpiarNombreArchivo(titulo || fileName || "video")
    const emailSlug = limpiarNombreArchivo(participanteEmail || "sin-email")
    const timestamp = Date.now()
    const storagePath = `${fechaSemana}/${diaClave}/${emailSlug}/${timestamp}-${nombreBase}.${extension}`

    const { data: signedUpload, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath)

    if (signedError || !signedUpload) {
      return NextResponse.json(
        {
          error:
            "No se pudo preparar la subida directa al storage. Verificá que el bucket casatalentos-videos exista.",
          detalle: signedError,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      bucket: BUCKET,
      storagePath,
      signedToken: signedUpload.token,
      signedUrl: signedUpload.signedUrl,
      dia: diaClave,
      diaClave,
      fechaSemana,
      maxBytes: MAX_BYTES,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno preparando la subida del video.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
