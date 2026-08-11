import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const BUCKET = process.env.SUPABASE_ENTUSIASMO_BUCKET || "entusiasmo-producciones"

type Body = {
  participanteEmail?: string
  storagePath?: string
  mimeType?: string
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
        { error: "No podés confirmar el pitch de otra persona." },
        { status: 403 }
      )
    }

    const emailObjetivo = emailSolicitado || auth.actor.email
    const storagePath = String(body.storagePath || "").trim()
    const mimeType = String(body.mimeType || "").trim().toLowerCase()

    if (!storagePath) {
      return NextResponse.json({ error: "Falta storagePath." }, { status: 400 })
    }

    if (!storagePath.startsWith(`pitch/`)) {
      return NextResponse.json(
        { error: "Ruta de archivo inválida." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const carpeta = storagePath.split("/").slice(0, -1).join("/")
    const nombreArchivo = storagePath.split("/").pop() || ""

    const { data: listado, error: listarError } = await supabase.storage
      .from(BUCKET)
      .list(carpeta, { search: nombreArchivo })

    if (listarError || !listado?.some((item) => item.name === nombreArchivo)) {
      return NextResponse.json(
        { error: "No se encontró el archivo subido. Probá de nuevo." },
        { status: 400 }
      )
    }

    const { data: existente } = await supabase
      .from("entusiasmo_proyectos")
      .select("participante_nombre, pitch_storage_path")
      .eq("participante_email", emailObjetivo)
      .maybeSingle()

    const ahora = new Date().toISOString()

    const { data, error } = await supabase
      .from("entusiasmo_proyectos")
      .upsert(
        {
          participante_email: emailObjetivo,
          participante_nombre: existente?.participante_nombre || auth.actor.name || null,
          pitch_storage_path: storagePath,
          pitch_mime_type: mimeType || null,
          pitch_actualizado_at: ahora,
          updated_at: ahora,
        },
        { onConflict: "participante_email" }
      )
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo confirmar el pitch.", detalle: error },
        { status: 500 }
      )
    }

    // Retención: el pitch no se descarta como los videos viejos de
    // CasaTalentos (es la carta de presentación vigente), pero no hay
    // que acumular versiones anteriores cuando alguien regraba.
    const pathAnterior = existente?.pitch_storage_path
    if (pathAnterior && pathAnterior !== storagePath) {
      await supabase.storage.from(BUCKET).remove([pathAnterior])
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60)

    if (signedError) {
      return NextResponse.json(
        { error: "Pitch confirmado, pero no se pudo generar el link para verlo.", detalle: signedError },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, proyecto: data, pitchUrl: signedData.signedUrl })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno confirmando el pitch.", detalle: String(error) },
      { status: 500 }
    )
  }
}
