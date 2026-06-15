import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  fechaSemana: string
  titulo: string
  descripcion?: string
  videoUrl?: string
  storagePath?: string
  mimeType?: string
  fileSize?: number
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

async function existeArchivoStorage(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  storagePath: string
) {
  const partes = storagePath.split("/")
  const nombre = partes.pop()
  const carpeta = partes.join("/")

  if (!nombre || !carpeta) return false

  const { data, error } = await supabase.storage
    .from("casatalentos-videos")
    .list(carpeta, {
      limit: 100,
      search: nombre,
    })

  if (error) {
    throw error
  }

  return Boolean(data?.some((item) => item.name === nombre))
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
    let storagePathRecibido = ""
    let mimeTypeRecibido = ""
    let fileSizeRecibido = 0
    let archivo: File | null = null

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      fechaSemana = String(formData.get("fechaSemana") || "").trim()
      titulo = String(formData.get("titulo") || "").trim()
      descripcion = String(formData.get("descripcion") || "").trim()
      videoUrl = String(formData.get("videoUrl") || "").trim()
      storagePathRecibido = String(formData.get("storagePath") || "").trim()
      mimeTypeRecibido = String(formData.get("mimeType") || "").trim()
      fileSizeRecibido = Number(formData.get("fileSize") || 0)
      const archivoRaw = formData.get("archivo")
      archivo = archivoRaw instanceof File ? archivoRaw : null
    } else {
      const body: Body = await req.json()
      fechaSemana = (body.fechaSemana || "").trim()
      titulo = (body.titulo || "").trim()
      descripcion = (body.descripcion || "").trim()
      videoUrl = (body.videoUrl || "").trim()
      storagePathRecibido = (body.storagePath || "").trim()
      mimeTypeRecibido = (body.mimeType || "").trim()
      fileSizeRecibido = Number(body.fileSize || 0)
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

    const storagePathAnterior = existente?.storage_path || null
    let storagePathParaRemoverLuego: string | null = null
    let storagePathNuevoSubido: string | null = null
    let storagePath: string | null = storagePathAnterior
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

      storagePathNuevoSubido = storagePath
      if (storagePathAnterior) {
        storagePathParaRemoverLuego = storagePathAnterior
      }
      finalVideoUrl = null
      mimeType = archivo.type || null
      fileSize = archivo.size || null
    } else if (storagePathRecibido) {
      const existeArchivo = await existeArchivoStorage(supabase, storagePathRecibido)

      if (!existeArchivo) {
        return NextResponse.json(
          { error: "No se encontró el video subido del referente semanal en el storage." },
          { status: 404 }
        )
      }

      storagePathNuevoSubido = storagePathRecibido
      if (storagePathAnterior && storagePathAnterior !== storagePathRecibido) {
        storagePathParaRemoverLuego = storagePathAnterior
      }
      storagePath = storagePathRecibido
      finalVideoUrl = null
      mimeType = mimeTypeRecibido || null
      fileSize = fileSizeRecibido || null
    } else if (videoUrl) {
      if (storagePathAnterior) {
        storagePathParaRemoverLuego = storagePathAnterior
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
        if (storagePathNuevoSubido) {
          await supabase.storage
            .from("casatalentos-videos")
            .remove([storagePathNuevoSubido])
        }

        return NextResponse.json(
          { error: "No se pudo actualizar el referente semanal", detalle: resultado.error },
          { status: 500 }
        )
      }

      if (storagePathParaRemoverLuego) {
        await supabase.storage
          .from("casatalentos-videos")
          .remove([storagePathParaRemoverLuego])
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
      if (storagePathNuevoSubido) {
        await supabase.storage
          .from("casatalentos-videos")
          .remove([storagePathNuevoSubido])
      }

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
