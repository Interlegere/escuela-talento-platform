import { NextResponse } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import {
  getActivityAdminPermission,
  requireActivityAccess,
} from "@/lib/authz"

type VideoDB = {
  id: number
  participante_nombre: string
  participante_email?: string | null
  titulo: string
  dia?: string | null
  dia_clave?: string | null
  fecha_semana?: string | null
  video_url?: string | null
  storage_path?: string | null
  mime_type?: string | null
  file_size?: number | null
  created_at?: string
}

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

    const { data: videos, error: videosError } = await supabase
      .from("casatalentos_videos")
      .select("*")
      .order("created_at", { ascending: false })

    if (videosError) {
      return NextResponse.json(
        { error: "No se pudieron cargar los videos", detalle: videosError },
        { status: 500 }
      )
    }

    const videosTyped = (videos || []) as VideoDB[]
    const storagePaths = videosTyped
      .map((v) => v.storage_path)
      .filter((v): v is string => Boolean(v))

    const signedMap = new Map<string, string>()

    if (storagePaths.length > 0) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from("casatalentos-videos")
        .createSignedUrls(storagePaths, 60 * 60)

      if (signedError) {
        return NextResponse.json(
          { error: "No se pudieron firmar los videos", detalle: signedError },
          { status: 500 }
        )
      }

      for (let i = 0; i < storagePaths.length; i++) {
        const path = storagePaths[i]
        const signed = signedData?.[i]?.signedUrl || ""
        if (path && signed) {
          signedMap.set(path, signed)
        }
      }
    }

    const videosConUrl = videosTyped.map((video) => ({
      ...video,
      video_url:
        video.storage_path && signedMap.has(video.storage_path)
          ? signedMap.get(video.storage_path)
          : video.video_url || null,
    }))

    const { data: votos, error: votosError } = await supabase
      .from("casatalentos_votos")
      .select("*")
      .order("created_at", { ascending: false })

    if (votosError) {
      return NextResponse.json(
        { error: "No se pudieron cargar los votos", detalle: votosError },
        { status: 500 }
      )
    }

    const { data: comentarios, error: comentariosError } = await supabase
      .from("casatalentos_comentarios")
      .select("*")
      .order("created_at", { ascending: true })

    if (comentariosError) {
      return NextResponse.json(
        { error: "No se pudieron cargar los comentarios", detalle: comentariosError },
        { status: 500 }
      )
    }

    const { data: referentesGenerales, error: generalesError } = await supabase
      .from("casatalentos_referentes_generales")
      .select("*")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)

    if (generalesError) {
      return NextResponse.json(
        { error: "No se pudieron cargar los referentes generales", detalle: generalesError },
        { status: 500 }
      )
    }

    const { data: referentesSemanales, error: semanalesError } = await supabase
      .from("casatalentos_referentes_semanales")
      .select("*")
      .order("fecha_semana", { ascending: false })

    if (semanalesError) {
      return NextResponse.json(
        { error: "No se pudieron cargar los referentes semanales", detalle: semanalesError },
        { status: 500 }
      )
    }

    const referentesSemanalesTyped =
      (referentesSemanales || []) as ReferenteSemanalDB[]
    const storagePathsReferentes = referentesSemanalesTyped
      .map((item) => item.storage_path || (esStorageInterno(item.video_url) ? item.video_url : null))
      .filter((item): item is string => Boolean(item))

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

    const { data: mensajesGenerales, error: mensajesError } = await supabase
      .from("casatalentos_mensajes")
      .select("*")
      .order("created_at", { ascending: true })

    if (mensajesError) {
      return NextResponse.json(
        { error: "No se pudieron cargar los mensajes", detalle: mensajesError },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      videos: videosConUrl,
      votos: votos || [],
      comentarios: comentarios || [],
      referentesGenerales: referentesGenerales?.[0] || null,
      referentesSemanales: referentesSemanalesConUrl,
      mensajesGenerales: (mensajesGenerales || []) as MensajeGeneralDB[],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno cargando CasaTalentos",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
