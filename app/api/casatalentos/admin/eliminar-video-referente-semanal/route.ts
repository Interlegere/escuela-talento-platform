import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  referenteSemanalId?: number
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

function esStorageInterno(value?: string | null) {
  const texto = String(value || "").trim()
  if (!texto) return false
  return !/^https?:\/\//i.test(texto)
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("casatalentos.admin")

    if ("response" in auth) {
      return auth.response
    }

    const body = (await req.json()) as Body
    const referenteSemanalId = Number(body.referenteSemanalId)

    if (!referenteSemanalId || Number.isNaN(referenteSemanalId)) {
      return NextResponse.json(
        { error: "Falta el referente semanal a modificar." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    let consulta = await supabase
      .from("casatalentos_referentes_semanales")
      .select("id, storage_path, video_url")
      .eq("id", referenteSemanalId)
      .maybeSingle()

    if (consulta.error && faltanColumnasStorage(consulta.error.message)) {
      consulta = await supabase
        .from("casatalentos_referentes_semanales")
        .select("id, video_url")
        .eq("id", referenteSemanalId)
        .maybeSingle()
    }

    const { data: existente, error: buscarError } = consulta

    if (buscarError) {
      return NextResponse.json(
        { error: "No se pudo consultar el referente semanal.", detalle: buscarError },
        { status: 500 }
      )
    }

    if (!existente) {
      return NextResponse.json(
        { error: "No se encontró el referente semanal indicado." },
        { status: 404 }
      )
    }

    const storagePath =
      existente.storage_path ||
      (esStorageInterno(existente.video_url) ? existente.video_url : null)

    if (storagePath) {
      await supabase
        .storage
        .from("casatalentos-videos")
        .remove([storagePath])
    }

    let resultado = await supabase
      .from("casatalentos_referentes_semanales")
      .update({
        video_url: null,
        storage_path: null,
        mime_type: null,
        file_size: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", referenteSemanalId)
      .select("*")
      .single()

    if (resultado.error && faltanColumnasStorage(resultado.error.message)) {
      resultado = await supabase
        .from("casatalentos_referentes_semanales")
        .update({
          video_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", referenteSemanalId)
        .select("*")
        .single()
    }

    if (resultado.error) {
      return NextResponse.json(
        { error: "No se pudo borrar el video del referente semanal.", detalle: resultado.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      item: resultado.data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno borrando el video del referente semanal.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
