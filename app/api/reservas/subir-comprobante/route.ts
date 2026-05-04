import { NextResponse } from "next/server"
import {
  hasPermission,
  requireAuthenticatedActor,
} from "@/lib/authz"
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
    const reservaId = Number(formData.get("reservaId"))
    const archivo = formData.get("archivo")

    if (!reservaId || Number.isNaN(reservaId)) {
      return NextResponse.json(
        { error: "Falta una reserva válida." },
        { status: 400 }
      )
    }

    if (!(archivo instanceof File)) {
      return NextResponse.json(
        { error: "Falta adjuntar un archivo." },
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
        { error: "El archivo supera los 10 MB permitidos." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: reserva, error: reservaError } = await supabase
      .from("reservas")
      .select("id, participante_email, estado")
      .eq("id", reservaId)
      .single()

    if (reservaError || !reserva) {
      return NextResponse.json(
        { error: "No se encontró la reserva." },
        { status: 404 }
      )
    }

    const esAdmin = hasPermission(auth.actor, "terapia.admin")
    const esTitular =
      String(reserva.participante_email || "").trim().toLowerCase() ===
      auth.actor.email

    if (!esAdmin && !esTitular) {
      return NextResponse.json(
        { error: "No tenés permisos para subir comprobantes a esta reserva." },
        { status: 403 }
      )
    }

    const nombreBase = archivo.name.replace(/\.[^/.]+$/, "") || "comprobante"
    const nombreSanitizado = nombreBase
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "comprobante"

    const path = `reservas/${reservaId}/${Date.now()}-${nombreSanitizado}.${extension || "bin"}`

    const { error: uploadError } = await supabase.storage
      .from("comprobantes-pagos")
      .upload(path, archivo, {
        cacheControl: "3600",
        upsert: false,
        contentType: archivo.type || undefined,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: "No se pudo subir el comprobante.", detalle: uploadError },
        { status: 500 }
      )
    }

    const { error: updateError } = await supabase
      .from("reservas")
      .update({
        estado: "pendiente_pago",
        medio_pago: "transferencia",
        comprobante_url: path,
        comprobante_nombre_archivo: archivo.name,
        comprobante_subido_at: new Date().toISOString(),
      })
      .eq("id", reservaId)

    if (updateError) {
      return NextResponse.json(
        {
          error:
            "Se subió el comprobante pero no se pudo actualizar la reserva.",
          detalle: updateError,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      reservaId,
      comprobante_url: path,
      comprobante_nombre_archivo: archivo.name,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno subiendo comprobante de reserva",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
