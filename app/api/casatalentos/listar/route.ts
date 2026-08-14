import { NextResponse } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import {
  getActivityAdminPermission,
  requireActivityAccess,
} from "@/lib/authz"

type ReferenteSemanalDB = {
  id: number
  fecha_semana: string
  titulo: string
  descripcion?: string | null
  video_url?: string | null
  storage_path?: string | null
  mime_type?: string | null
  file_size?: number | null
}

type MensajeGeneralDB = {
  id: number
  parent_id?: number | null
  asunto?: string | null
  autor_nombre: string
  autor_email?: string | null
  autor_rol?: string | null
  contenido: string
  contenido_html?: string | null
  created_at?: string
  updated_at?: string
}

function esStorageInterno(value?: string | null) {
  const texto = String(value || "").trim()
  if (!texto) return false
  return !/^https?:\/\//i.test(texto)
}

export async function GET(req: Request) {
  try {
    const preview =
      process.env.NODE_ENV !== "production" &&
      new URL(req.url).searchParams.get("preview") === "1"

    if (!preview) {
      const auth = await requireActivityAccess(
        "casatalentos",
        getActivityAdminPermission("casatalentos")
      )

      if ("response" in auth) {
        return auth.response
      }
    }

    const supabase = createAdminSupabaseClient()

    // Referentes generales, referentes semanales y mensajes son
    // independientes entre sí, así que se piden en simultáneo en vez de
    // uno atrás del otro.
    const [referentesGeneralesResult, referentesSemanalesResult, mensajesGeneralesResult] =
      await Promise.all([
        supabase
          .from("casatalentos_referentes_generales")
          .select("*")
          .order("updated_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(1),
        supabase
          .from("casatalentos_referentes_semanales")
          .select("*")
          .order("fecha_semana", { ascending: false }),
        supabase
          .from("casatalentos_mensajes")
          .select("*")
          .eq("activo", true)
          .order("created_at", { ascending: true }),
      ])

    if (referentesGeneralesResult.error) {
      return NextResponse.json(
        { error: "No se pudieron cargar los referentes generales", detalle: referentesGeneralesResult.error },
        { status: 500 }
      )
    }

    if (referentesSemanalesResult.error) {
      return NextResponse.json(
        { error: "No se pudieron cargar los referentes semanales", detalle: referentesSemanalesResult.error },
        { status: 500 }
      )
    }

    let mensajesGenerales = mensajesGeneralesResult.data
    let mensajesError = mensajesGeneralesResult.error

    if (mensajesError && faltaColumnaActivo(mensajesError)) {
      const retry = await supabase
        .from("casatalentos_mensajes")
        .select("*")
        .order("created_at", { ascending: true })

      mensajesGenerales = retry.data
      mensajesError = retry.error
    }

    if (mensajesError) {
      return NextResponse.json(
        { error: "No se pudieron cargar los mensajes", detalle: mensajesError },
        { status: 500 }
      )
    }

    const referentesSemanalesTyped =
      (referentesSemanalesResult.data || []) as ReferenteSemanalDB[]
    const storagePathsReferentes = referentesSemanalesTyped
      .map((item) => item.storage_path || (esStorageInterno(item.video_url) ? item.video_url : null))
      .filter((item): item is string => Boolean(item))

    const signedMap = new Map<string, string>()

    if (storagePathsReferentes.length > 0) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from("casatalentos-videos")
        .createSignedUrls(storagePathsReferentes, 60 * 60)

      if (signedError) {
        return NextResponse.json(
          { error: "No se pudieron firmar los referentes semanales", detalle: signedError },
          { status: 500 }
        )
      }

      for (let i = 0; i < storagePathsReferentes.length; i++) {
        const path = storagePathsReferentes[i]
        const signed = signedData?.[i]?.signedUrl || ""
        if (path && signed) {
          signedMap.set(path, signed)
        }
      }
    }

    const referentesSemanalesConUrl = referentesSemanalesTyped.map((item) => ({
      ...item,
      video_url:
        item.storage_path && signedMap.has(item.storage_path)
          ? signedMap.get(item.storage_path)
          : item.video_url && esStorageInterno(item.video_url) && signedMap.has(item.video_url)
            ? signedMap.get(item.video_url)
            : item.video_url || null,
    }))

    return NextResponse.json({
      ok: true,
      referentesGenerales: referentesGeneralesResult.data?.[0] || null,
      referentesSemanales: referentesSemanalesConUrl,
      mensajesGenerales: (mensajesGenerales || []) as MensajeGeneralDB[],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno cargando Entusiasmento",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
function faltaColumnaActivo(error: unknown) {
  const err = error as { code?: string; message?: string }
  return err?.code === "42703" || String(err?.message || "").includes("activo")
}
