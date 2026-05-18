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
  participanteNombre?: string
  titulo?: string
  storagePath?: string
  mimeType?: string
  fileSize?: number
  diaClave?: string
  fechaSemana?: string
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

async function existeArchivoStorage(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  storagePath: string
) {
  const partes = storagePath.split("/")
  const nombre = partes.pop()
  const carpeta = partes.join("/")

  if (!nombre || !carpeta) return false

  const { data, error } = await supabase.storage
    .from(BUCKET)
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
  let storagePathParaLimpiar: string | null = null

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
        { error: "No tenés permisos para confirmar videos." },
        { status: 403 }
      )
    }

    const body = (await req.json()) as Body
    const participanteNombre =
      String(body.participanteNombre || "").trim() || auth.actor.name
    const participanteEmail = auth.actor.email
    const titulo = String(body.titulo || "").trim()
    const storagePath = String(body.storagePath || "").trim()
    const mimeType = String(body.mimeType || "").trim()
    const fileSize = Number(body.fileSize || 0)

    storagePathParaLimpiar = storagePath || null

    if (!participanteNombre || !titulo || !storagePath) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios para confirmar el video." },
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
    const diaClaveActual = weekdayToDiaClave(ahora.weekdayShort)

    if (!diaClaveActual) {
      return NextResponse.json(
        { error: "Los videos del dispositivo solo se pueden subir lunes y miércoles." },
        { status: 400 }
      )
    }

    const fechaSemanaActual = obtenerFechaSemanaLunes(
      ahora.year,
      ahora.month,
      ahora.day,
      ahora.weekdayShort
    )
    const diaClave = body.diaClave || diaClaveActual
    const fechaSemana = body.fechaSemana || fechaSemanaActual

    if (diaClave !== diaClaveActual || fechaSemana !== fechaSemanaActual) {
      return NextResponse.json(
        { error: "La preparación de subida ya no coincide con el día actual." },
        { status: 400 }
      )
    }

    const emailSlug = limpiarNombreArchivo(participanteEmail || "sin-email")
    const prefijoEsperado = `${fechaSemana}/${diaClave}/${emailSlug}/`

    if (!storagePath.startsWith(prefijoEsperado)) {
      return NextResponse.json(
        { error: "El archivo confirmado no corresponde a este participante." },
        { status: 403 }
      )
    }

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
      await supabase.storage.from(BUCKET).remove([storagePath])

      return NextResponse.json(
        { error: `Ya subiste tu video de ${diaClave} para esta semana.` },
        { status: 400 }
      )
    }

    const existeArchivo = await existeArchivoStorage(supabase, storagePath)

    if (!existeArchivo) {
      return NextResponse.json(
        { error: "No se encontró el archivo subido en el storage." },
        { status: 404 }
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
        mime_type: mimeType || null,
        file_size: fileSize || null,
      })
      .select("*")
      .single()

    if (error) {
      await supabase.storage.from(BUCKET).remove([storagePath])

      return NextResponse.json(
        { error: "No se pudo crear el registro del video.", detalle: error },
        { status: 500 }
      )
    }

    storagePathParaLimpiar = null

    return NextResponse.json({
      ok: true,
      video: data,
    })
  } catch (error) {
    if (storagePathParaLimpiar) {
      try {
        const supabase = createAdminSupabaseClient()
        await supabase.storage.from(BUCKET).remove([storagePathParaLimpiar])
      } catch {
        // Si falla la limpieza, priorizamos devolver el error original.
      }
    }

    return NextResponse.json(
      {
        error: "Error interno confirmando el video.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
