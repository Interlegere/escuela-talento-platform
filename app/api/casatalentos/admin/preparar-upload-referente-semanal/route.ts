import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const BUCKET = "casatalentos-videos"
const MAX_BYTES = 50 * 1024 * 1024

type Body = {
  fechaSemana?: string
  titulo?: string
  fileName?: string
  mimeType?: string
  fileSize?: number
}

function limpiarNombreArchivo(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
}

function normalizarFechaSemana(fecha: string) {
  const base = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(base.getTime())) {
    return fecha
  }

  const dia = base.getDay()
  const desplazamiento = dia === 0 ? -6 : 1 - dia
  base.setDate(base.getDate() + desplazamiento)

  const year = base.getFullYear()
  const month = String(base.getMonth() + 1).padStart(2, "0")
  const day = String(base.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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
    const auth = await requirePermission("casatalentos.admin")

    if ("response" in auth) {
      return auth.response
    }

    const body = (await req.json()) as Body
    const fechaSemanaRaw = String(body.fechaSemana || "").trim()
    const titulo = String(body.titulo || "").trim()
    const fileName = String(body.fileName || "").trim()
    const mimeType = String(body.mimeType || "").trim()
    const fileSize = Number(body.fileSize || 0)

    if (!fechaSemanaRaw || !titulo) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios para preparar el video del referente semanal." },
        { status: 400 }
      )
    }

    if (!mimeType.startsWith("video/")) {
      return NextResponse.json(
        { error: "El archivo del referente semanal debe ser un video." },
        { status: 400 }
      )
    }

    if (!fileSize || fileSize > MAX_BYTES) {
      return NextResponse.json(
        { error: "El video del referente semanal supera el máximo permitido de 50MB." },
        { status: 400 }
      )
    }

    const fechaSemana = normalizarFechaSemana(fechaSemanaRaw)
    const extension = extensionDesdeNombre(fileName, mimeType)
    const nombreBase = limpiarNombreArchivo(titulo || fileName || "referente")
    const timestamp = Date.now()
    const storagePath = `referentes-semanales/${fechaSemana}/${timestamp}-${nombreBase}.${extension}`

    const supabase = createAdminSupabaseClient()
    const { data: signedUpload, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath)

    if (signedError || !signedUpload) {
      return NextResponse.json(
        {
          error:
            "No se pudo preparar la subida del referente semanal. Verificá que el bucket casatalentos-videos exista.",
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
      fechaSemana,
      maxBytes: MAX_BYTES,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno preparando la subida del referente semanal.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
