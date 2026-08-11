import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const BUCKET = process.env.SUPABASE_ENTUSIASMO_BUCKET || "entusiasmo-producciones"
const MAX_BYTES = 50 * 1024 * 1024

type Body = {
  participanteEmail?: string
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
    .replace(/^-|-$/g, "")
    .toLowerCase()
}

function extensionDesdeNombre(nombre?: string, mimeType?: string) {
  const extension = String(nombre || "").split(".").pop() || ""

  if (extension) {
    return limpiarNombreArchivo(extension)
  }

  if (mimeType?.startsWith("video/")) return "webm"
  if (mimeType?.startsWith("image/")) return mimeType.split("/")[1] || "png"
  return "bin"
}

function mimePermitido(mimeType: string) {
  return mimeType.startsWith("video/") || mimeType.startsWith("image/")
}

async function asegurarBucketEntusiasmo(
  supabase: ReturnType<typeof createAdminSupabaseClient>
) {
  const { data: buckets, error: listarError } = await supabase.storage.listBuckets()

  if (listarError) {
    throw listarError
  }

  const bucketExistente = buckets.find((bucket) => bucket.name === BUCKET)

  if (bucketExistente) {
    if (bucketExistente.public) {
      const { error: actualizarError } = await supabase.storage.updateBucket(BUCKET, {
        public: false,
        fileSizeLimit: MAX_BYTES,
      })

      if (actualizarError) {
        throw actualizarError
      }
    }

    return
  }

  const { error: crearError } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
  })

  if (crearError && !crearError.message.toLowerCase().includes("already exists")) {
    throw crearError
  }
}

export async function POST(req: Request) {
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
        { error: "No podés subir el pitch de otra persona." },
        { status: 403 }
      )
    }

    const emailObjetivo = emailSolicitado || auth.actor.email
    const fileName = String(body.fileName || "").trim()
    const mimeType = String(body.mimeType || "").trim().toLowerCase()
    const fileSize = Number(body.fileSize || 0)

    if (!fileName || !mimeType || !fileSize) {
      return NextResponse.json(
        { error: "Faltan datos del archivo a subir." },
        { status: 400 }
      )
    }

    if (!mimePermitido(mimeType)) {
      return NextResponse.json(
        { error: "El pitch tiene que ser un video o una imagen." },
        { status: 400 }
      )
    }

    if (fileSize > MAX_BYTES) {
      return NextResponse.json(
        { error: `El archivo supera el máximo permitido de ${MAX_BYTES / (1024 * 1024)}MB.` },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()
    await asegurarBucketEntusiasmo(supabase)

    const extension = extensionDesdeNombre(fileName, mimeType)
    const participante = limpiarNombreArchivo(emailObjetivo)
    const timestamp = Date.now()
    const storagePath = `pitch/${participante}/${timestamp}.${extension}`

    const { data: signedUpload, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath)

    if (signedError || !signedUpload) {
      return NextResponse.json(
        {
          error: "No se pudo preparar la subida del pitch.",
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
      mimeType,
      maxBytes: MAX_BYTES,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno preparando la subida del pitch.", detalle: String(error) },
      { status: 500 }
    )
  }
}
