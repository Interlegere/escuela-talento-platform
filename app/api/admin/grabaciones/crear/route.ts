import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

function extraerDriveFileId(url?: string | null) {
  if (!url) return null

  const matchFile = url.match(/\/file\/d\/([^/]+)/)
  if (matchFile?.[1]) return matchFile[1]

  const matchOpen = url.match(/[?&]id=([^&]+)/)
  if (matchOpen?.[1]) return matchOpen[1]

  return null
}

type Body = {
  titulo: string
  descripcion?: string
  actividadSlug: string
  driveUrl: string
  fecha: string
  visible?: boolean
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("grabaciones.manage")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()

    const {
      titulo,
      descripcion,
      actividadSlug,
      driveUrl,
      fecha,
      visible,
    } = body

    if (!titulo || !actividadSlug || !driveUrl || !fecha) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios" },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: actividad, error: actividadError } = await supabase
      .from("actividades")
      .select("*")
      .eq("slug", actividadSlug)
      .single()

    if (actividadError || !actividad) {
      return NextResponse.json(
        { error: "Actividad no encontrada", detalle: actividadError },
        { status: 404 }
      )
    }

    const driveFileId = extraerDriveFileId(driveUrl)

    const { data, error } = await supabase
      .from("grabaciones")
      .insert({
        titulo: titulo.trim(),
        descripcion: descripcion?.trim() || null,
        actividad_id: actividad.id,
        recurso_id: null,
        drive_url: driveUrl.trim(),
        drive_file_id: driveFileId,
        fecha,
        visible: visible ?? true,
      })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo crear la grabación", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      grabacion: data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno creando grabación",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
