import { NextResponse } from "next/server"
import {
  esErrorConfiguracionEspacios,
  resolverContextoEspacio,
} from "@/lib/espacios"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const BUCKET = process.env.SUPABASE_ESPACIOS_BUCKET || "espacios-archivos"
const MAX_BYTES = 20 * 1024 * 1024

type Body = {
  actividadSlug?: string
  participanteEmail?: string
  fileName?: string
  mimeType?: string
  fileSize?: number
  destino?: "mensaje" | "recurso"
}

function limpiarNombreArchivo(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
}

function mimePermitido(mimeType: string) {
  if (!mimeType) return false
  if (mimeType.startsWith("image/")) return true

  return [
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/x-zip-compressed",
  ].includes(mimeType)
}

function extensionDesdeNombre(nombre?: string, mimeType?: string) {
  const extension = String(nombre || "").split(".").pop() || ""

  if (extension) {
    return limpiarNombreArchivo(extension)
  }

  if (mimeType?.startsWith("image/")) {
    return mimeType.split("/")[1] || "png"
  }

  if (mimeType === "application/pdf") return "pdf"
  if (mimeType === "text/plain") return "txt"
  return "bin"
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body

    if (!body.actividadSlug) {
      return NextResponse.json({ error: "Falta actividadSlug." }, { status: 400 })
    }

    const contexto = await resolverContextoEspacio({
      actividadSlug: body.actividadSlug,
      participanteEmail: body.participanteEmail,
    })

    if ("response" in contexto) {
      return contexto.response
    }

    if (!contexto.esAdmin) {
      return NextResponse.json(
        { error: "Solo admin puede subir archivos en este espacio." },
        { status: 403 }
      )
    }

    const fileName = String(body.fileName || "").trim()
    const mimeType = String(body.mimeType || "").trim().toLowerCase()
    const fileSize = Number(body.fileSize || 0)
    const destino = body.destino === "mensaje" ? "mensaje" : "recurso"

    if (!fileName || !mimeType || !fileSize) {
      return NextResponse.json(
        { error: "Faltan datos del archivo a subir." },
        { status: 400 }
      )
    }

    if (!mimePermitido(mimeType)) {
      return NextResponse.json(
        {
          error:
            "Formato no permitido. Podés subir imágenes, PDF y archivos de documentos habituales.",
        },
        { status: 400 }
      )
    }

    if (fileSize > MAX_BYTES) {
      return NextResponse.json(
        { error: `El archivo supera el máximo permitido de ${MAX_BYTES / (1024 * 1024)}MB.` },
        { status: 400 }
      )
    }

    if (!contexto.espacio) {
      return NextResponse.json(
        { error: "No se encontró el espacio configurado." },
        { status: 404 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const extension = extensionDesdeNombre(fileName, mimeType)
    const base = limpiarNombreArchivo(fileName.replace(/\.[^.]+$/, "")) || destino
    const participante = limpiarNombreArchivo(contexto.participanteEmail)
    const timestamp = Date.now()
    const storagePath = [
      body.actividadSlug,
      participante,
      destino,
      `${timestamp}-${base}.${extension}`,
    ].join("/")

    const { data: signedUpload, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath)

    if (signedError || !signedUpload) {
      return NextResponse.json(
        {
          error:
            "No se pudo preparar la subida del archivo. Verificá que el bucket de espacios exista y esté disponible.",
          detalle: signedError,
        },
        { status: 500 }
      )
    }

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

    return NextResponse.json({
      ok: true,
      bucket: BUCKET,
      storagePath,
      signedToken: signedUpload.token,
      signedUrl: signedUpload.signedUrl,
      publicUrl: publicData.publicUrl,
      maxBytes: MAX_BYTES,
    })
  } catch (error) {
    if (esErrorConfiguracionEspacios(error)) {
      return NextResponse.json(
        { error: "Falta configurar las tablas de espacios." },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: "No se pudo preparar la subida del archivo.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
