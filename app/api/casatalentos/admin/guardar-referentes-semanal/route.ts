import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  fechaSemana: string
  titulo: string
  descripcion?: string
  videoUrl?: string
}

function limpiarNombreArchivo(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
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

function faltanColumnasStorage(detalle: unknown) {
  const texto = String(detalle || "").toLowerCase()
  return (
    texto.includes("storage_path") ||
    texto.includes("mime_type") ||
    texto.includes("file_size") ||
    texto.includes("column")
  )
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("casatalentos.admin")

    if ("response" in auth) {
      return auth.response
    }

    const contentType = req.headers.get("content-type") || ""
    let fechaSemana = ""
    let titulo = ""
    let descripcion = ""
    let videoUrl = ""
    let archivo: File | null = null

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      fechaSemana = String(formData.get("fechaSemana") || "").trim()
      titulo = String(formData.get("titulo") || "").trim()
      descripcion = String(formData.get("descripcion") || "").trim()
      videoUrl = String(formData.get("videoUrl") || "").trim()
      const archivoRaw = formData.get("archivo")
      archivo = archivoRaw instanceof File ? archivoRaw : null
    } else {
      const body: Body = await req.json()
      fechaSemana = (body.fechaSemana || "").trim()
      titulo = (body.titulo || "").trim()
      descripcion = (body.descripcion || "").trim()
      videoUrl = (body.videoUrl || "").trim()
    }

    if (!fechaSemana || !titulo) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios para guardar el referente semanal." },
        { status: 400 }
      )
    }

    fechaSemana = normalizarFechaSemana(fechaSemana)

    const supabase = createAdminSupabaseClient()

    const { data: existente, error: buscarError } = await supabase
      .from("casatalentos_referentes_semanales")
      .select("*")
      .eq("fecha_semana", fechaSemana)
      .maybeSingle()

    if (buscarError) {
      return NextResponse.json(
        { error: "No se pudo consultar el referente semanal", detalle: buscarError },
        { status: 500 }
      )
    }

    let storagePath: string | null = existente?.storage_path || null
    let finalVideoUrl: string | null = existente?.video_url || null
    let mimeType: string | null = existente?.mime_type || null
    let fileSize: number | null = existente?.file_size || null

    if (archivo) {
      const extensionOriginal = archivo.name.split(".").pop() || "mp4"
      const extension = limpiarNombreArchivo(extensionOriginal) || "mp4"
      const nombreBase = limpiarNombreArchivo(titulo || archivo.name || "referente")
      const timestamp = Date.now()

      storagePath = `referentes-semanales/${fechaSemana}/${timestamp}-${nombreBase}.${extension}`

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
          { error: "No se pudo subir el video del referente semanal", detalle: uploadError },
          { status: 500 }
        )
      }

      if (existente?.storage_path) {
        await supabase.storage
          .from("casatalentos-videos")
          .remove([existente.storage_path])
      }

      finalVideoUrl = null
      mimeType = archivo.type || null
      fileSize = archivo.size || null
    } else if (videoUrl) {
      if (existente?.storage_path) {
        await supabase.storage
          .from("casatalentos-videos")
          .remove([existente.storage_path])
      }

      storagePath = null
      finalVideoUrl = videoUrl
      mimeType = null
      fileSize = null
    }

    const payloadCompleto = {
      titulo,
      descripcion: descripcion || null,
      video_url: finalVideoUrl,
      storage_path: storagePath,
      mime_type: mimeType,
      file_size: fileSize,
      updated_at: new Date().toISOString(),
    }

    const payloadCompat = {
      titulo,
      descripcion: descripcion || null,
      video_url: storagePath || finalVideoUrl,
      updated_at: new Date().toISOString(),
    }

    if (existente) {
      let resultado = await supabase
        .from("casatalentos_referentes_semanales")
        .update(payloadCompleto)
        .eq("id", existente.id)
        .select("*")
        .single()

      if (resultado.error && faltanColumnasStorage(resultado.error.message)) {
        resultado = await supabase
          .from("casatalentos_referentes_semanales")
          .update(payloadCompat)
          .eq("id", existente.id)
          .select("*")
          .single()
      }

      if (resultado.error) {
        return NextResponse.json(
          { error: "No se pudo actualizar el referente semanal", detalle: resultado.error },
          { status: 500 }
        )
      }

      return NextResponse.json({ ok: true, item: resultado.data })
    }

    let resultado = await supabase
      .from("casatalentos_referentes_semanales")
      .insert({
        fecha_semana: fechaSemana,
        ...payloadCompleto,
      })
      .select("*")
      .single()

    if (resultado.error && faltanColumnasStorage(resultado.error.message)) {
      resultado = await supabase
        .from("casatalentos_referentes_semanales")
        .insert({
          fecha_semana: fechaSemana,
          ...payloadCompat,
        })
        .select("*")
        .single()
    }

    if (resultado.error) {
      return NextResponse.json(
        { error: "No se pudo crear el referente semanal", detalle: resultado.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, item: resultado.data })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno guardando referente semanal",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
