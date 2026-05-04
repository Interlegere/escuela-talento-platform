import { NextResponse } from "next/server"
import { requireAuthenticatedActor } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const TIPOS_PERMITIDOS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
])

const EXTENSIONES_PERMITIDAS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "pdf",
])

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const formData = await req.formData()

    const pagoMensualId = Number(formData.get("pagoMensualId"))
    const archivo = formData.get("archivo") as File | null

    if (!pagoMensualId) {
      return NextResponse.json(
        { error: "Falta pagoMensualId" },
        { status: 400 }
      )
    }

    if (!archivo) {
      return NextResponse.json(
        { error: "Falta archivo" },
        { status: 400 }
      )
    }

    const extension = archivo.name.includes(".")
      ? archivo.name.split(".").pop()?.toLowerCase() || ""
      : ""
    const tipoValido =
      TIPOS_PERMITIDOS.has(archivo.type) ||
      (!!extension && EXTENSIONES_PERMITIDAS.has(extension))

    if (!tipoValido) {
      return NextResponse.json(
        {
          error:
            "Tipo de archivo no permitido. Usa JPG, PNG, WEBP, HEIC, HEIF o PDF.",
        },
        { status: 400 }
      )
    }

    const maxBytes = 10 * 1024 * 1024

    if (archivo.size > maxBytes) {
      return NextResponse.json(
        {
          error: "El archivo supera los 10 MB permitidos.",
        },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: pago, error: pagoError } = await supabase
      .from("pagos_mensuales")
      .select("*, inscripciones(participante_email)")
      .eq("id", pagoMensualId)
      .single()

    if (pagoError || !pago) {
      return NextResponse.json(
        { error: "No se encontró el pago mensual", detalle: pagoError },
        { status: 404 }
      )
    }

    const emailPago = (pago.inscripciones?.participante_email || "").trim().toLowerCase()
    const puedeAdministrar = auth.actor.role === "admin"

    if (!puedeAdministrar && emailPago !== auth.actor.email) {
      return NextResponse.json(
        { error: "No tenés permisos para subir comprobantes para este pago." },
        { status: 403 }
      )
    }

    const extensionFinal = extension || "bin"
    const safeEmail = auth.actor.email.replace(/[^a-zA-Z0-9@._-]/g, "_")
    const nombreArchivo = `${Date.now()}-${safeEmail}.${extensionFinal}`
    const path = `${pago.anio}/${String(pago.mes).padStart(2, "0")}/pago-${pagoMensualId}/${nombreArchivo}`

    const arrayBuffer = await archivo.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from("comprobantes-pagos")
      .upload(path, buffer, {
        contentType: archivo.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: "No se pudo subir el archivo", detalle: uploadError },
        { status: 500 }
      )
    }

    const { error: updateError } = await supabase
      .from("pagos_mensuales")
      .update({
        estado: "en_revision",
        medio_pago: "transferencia",
        comprobante_url: path,
        comprobante_nombre_archivo: archivo.name,
        comprobante_subido_at: new Date().toISOString(),
      })
      .eq("id", pagoMensualId)

    if (updateError) {
      return NextResponse.json(
        {
          error: "Se subió el comprobante pero no se pudo actualizar el pago",
          detalle: updateError,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      pagoMensualId,
      comprobante_url: path,
      estado: "en_revision",
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno subiendo comprobante",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
