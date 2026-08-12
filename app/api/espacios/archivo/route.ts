import { NextResponse } from "next/server"
import { limpiarNombreArchivo, resolverContextoEspacio } from "@/lib/espacios"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const BUCKET = process.env.SUPABASE_ESPACIOS_BUCKET || "espacios-archivos"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const path = url.searchParams.get("path")?.trim() || ""
  const actividadSlug = url.searchParams.get("actividadSlug")?.trim() || ""
  const participanteEmail = url.searchParams.get("participanteEmail")?.trim() || ""

  if (!path || !actividadSlug) {
    return NextResponse.json({ error: "Faltan datos del archivo." }, { status: 400 })
  }

  const contexto = await resolverContextoEspacio({
    actividadSlug,
    participanteEmail,
    crearSiNoExiste: false,
  })

  if ("response" in contexto) {
    return contexto.response
  }

  const prefijoEsperado = `${actividadSlug}/${limpiarNombreArchivo(contexto.participanteEmail)}/`

  if (!path.startsWith(prefijoEsperado)) {
    return NextResponse.json(
      { error: "No tenés acceso a este archivo." },
      { status: 403 }
    )
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "No se pudo generar el acceso al archivo.", detalle: error },
      { status: 404 }
    )
  }

  return NextResponse.redirect(data.signedUrl)
}
