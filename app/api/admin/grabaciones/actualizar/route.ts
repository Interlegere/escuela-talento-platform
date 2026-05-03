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
  grabacionId: number
  titulo: string
  descripcion?: string
  driveUrl: string
  fecha: string
  visible: boolean
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("grabaciones.manage")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()

    const {
      grabacionId,
      titulo,
      descripcion,
      driveUrl,
      fecha,
      visible,
    } = body

    if (!grabacionId || !titulo || !driveUrl || !fecha) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios" },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const driveFileId = extraerDriveFileId(driveUrl)

    const { data, error } = await supabase
      .from("grabaciones")
      .update({
        titulo: titulo.trim(),
        descripcion: descripcion?.trim() || null,
        drive_url: driveUrl.trim(),
        drive_file_id: driveFileId,
        fecha,
        visible,
        updated_at: new Date().toISOString(),
      })
      .eq("id", grabacionId)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo actualizar la grabación", detalle: error },
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
        error: "Error interno actualizando grabación",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
