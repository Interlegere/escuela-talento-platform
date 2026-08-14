import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const BUCKET = process.env.SUPABASE_ENTUSIASMO_BUCKET || "entusiasmo-producciones"

type ProduccionRow = {
  id: number
  proyecto_id: number
  categoria: string
  tipo: string
  titulo: string | null
  contenido: string | null
  storage_path: string | null
  mime_type: string | null
  visible: boolean
  created_at: string
  updated_at: string
}

type PostBody = {
  participanteEmail?: string
  tipo?: string
  titulo?: string
  contenido?: string
  storagePath?: string
  mimeType?: string
}

type PatchBody = {
  id?: number
  titulo?: string
  contenido?: string
  visible?: boolean
}

type DeleteBody = {
  id?: number
}

const TIPOS_VALIDOS = ["imagen", "texto", "audio", "video"]

async function resolverProyectoId(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  email: string
) {
  const { data } = await supabase
    .from("entusiasmo_proyectos")
    .select("id")
    .eq("participante_email", email)
    .maybeSingle()

  return data?.id as number | undefined
}

export async function GET(req: Request) {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return auth.response
    }

    const url = new URL(req.url)
    const emailConsultado = url.searchParams.get("email")?.trim().toLowerCase()
    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")

    if (emailConsultado && emailConsultado !== auth.actor.email && !esAdmin) {
      return NextResponse.json(
        { error: "No podés ver las producciones de otra persona." },
        { status: 403 }
      )
    }

    const emailObjetivo = emailConsultado || auth.actor.email
    const supabase = createAdminSupabaseClient()

    // Un solo viaje a la base (join + filtro por email) en vez de resolver
    // primero el proyecto_id y recién después pedir las producciones.
    const { data, error } = await supabase
      .from("entusiasmo_producciones")
      .select("*, entusiasmo_proyectos!inner(participante_email)")
      .eq("entusiasmo_proyectos.participante_email", emailObjetivo)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "No se pudieron cargar las producciones.", detalle: error },
        { status: 500 }
      )
    }

    const producciones = (data as ProduccionRow[]) || []
    const conStoragePath = producciones.filter((item) => item.storage_path)

    const signedUrls = new Map<string, string>()

    if (conStoragePath.length > 0) {
      const { data: signedData } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(
          conStoragePath.map((item) => item.storage_path as string),
          60 * 60
        )

      for (const item of signedData || []) {
        if (item.path && item.signedUrl) {
          signedUrls.set(item.path, item.signedUrl)
        }
      }
    }

    const produccionesConUrl = producciones.map((item) => ({
      ...item,
      signedUrl: item.storage_path ? signedUrls.get(item.storage_path) || null : null,
    }))

    return NextResponse.json({ ok: true, producciones: produccionesConUrl })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno cargando las producciones.", detalle: String(error) },
      { status: 500 }
    )
  }
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

    const body: PostBody = await req.json()
    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")
    const emailSolicitado = body.participanteEmail?.trim().toLowerCase()

    if (emailSolicitado && emailSolicitado !== auth.actor.email && !esAdmin) {
      return NextResponse.json(
        { error: "No podés crear una producción de otra persona." },
        { status: 403 }
      )
    }

    const emailObjetivo = emailSolicitado || auth.actor.email
    const tipo = String(body.tipo || "").trim().toLowerCase()

    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json(
        { error: "Tipo de producción inválido." },
        { status: 400 }
      )
    }

    if (tipo === "texto" && !String(body.contenido || "").trim()) {
      return NextResponse.json(
        { error: "Falta el contenido de la producción de texto." },
        { status: 400 }
      )
    }

    if (tipo !== "texto" && !body.storagePath) {
      return NextResponse.json(
        { error: "Falta el archivo de la producción." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()
    let proyectoId = await resolverProyectoId(supabase, emailObjetivo)

    if (!proyectoId) {
      const { data: proyectoNuevo, error: crearError } = await supabase
        .from("entusiasmo_proyectos")
        .insert({ participante_email: emailObjetivo })
        .select("id")
        .single()

      if (crearError || !proyectoNuevo) {
        return NextResponse.json(
          { error: "No se pudo preparar el espacio de esa persona.", detalle: crearError },
          { status: 500 }
        )
      }

      proyectoId = proyectoNuevo.id
    }

    const { data, error } = await supabase
      .from("entusiasmo_producciones")
      .insert({
        proyecto_id: proyectoId,
        categoria: "general",
        tipo,
        titulo: body.titulo?.trim() || null,
        contenido: body.contenido?.trim() || null,
        storage_path: body.storagePath || null,
        mime_type: body.mimeType || null,
        visible: false,
      })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo guardar la producción.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, produccion: data as ProduccionRow })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno guardando la producción.", detalle: String(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return auth.response
    }

    const body: PatchBody = await req.json()
    const id = Number(body.id)

    if (!id) {
      return NextResponse.json({ error: "Falta el id de la producción." }, { status: 400 })
    }

    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")
    const supabase = createAdminSupabaseClient()

    const { data: existente } = await supabase
      .from("entusiasmo_producciones")
      .select("proyecto_id, entusiasmo_proyectos!inner(participante_email)")
      .eq("id", id)
      .maybeSingle<{
        proyecto_id: number
        entusiasmo_proyectos: { participante_email: string }
      }>()

    if (!existente) {
      return NextResponse.json({ error: "No se encontró la producción." }, { status: 404 })
    }

    const esDueno =
      existente.entusiasmo_proyectos?.participante_email === auth.actor.email

    if (!esDueno && !esAdmin) {
      return NextResponse.json(
        { error: "No podés editar la producción de otra persona." },
        { status: 403 }
      )
    }

    const cambios: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.titulo !== undefined) cambios.titulo = body.titulo.trim() || null
    if (body.contenido !== undefined) cambios.contenido = body.contenido.trim() || null
    if (body.visible !== undefined) cambios.visible = Boolean(body.visible)

    const { data, error } = await supabase
      .from("entusiasmo_producciones")
      .update(cambios)
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo actualizar la producción.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, produccion: data as ProduccionRow })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno actualizando la producción.", detalle: String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return auth.response
    }

    const body: DeleteBody = await req.json()
    const id = Number(body.id)

    if (!id) {
      return NextResponse.json({ error: "Falta el id de la producción." }, { status: 400 })
    }

    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")
    const supabase = createAdminSupabaseClient()

    const { data: existente } = await supabase
      .from("entusiasmo_producciones")
      .select("storage_path, entusiasmo_proyectos!inner(participante_email)")
      .eq("id", id)
      .maybeSingle<{
        storage_path: string | null
        entusiasmo_proyectos: { participante_email: string }
      }>()

    if (!existente) {
      return NextResponse.json({ error: "No se encontró la producción." }, { status: 404 })
    }

    const esDueno =
      existente.entusiasmo_proyectos?.participante_email === auth.actor.email

    if (!esDueno && !esAdmin) {
      return NextResponse.json(
        { error: "No podés eliminar la producción de otra persona." },
        { status: 403 }
      )
    }

    if (existente.storage_path) {
      await supabase.storage.from(BUCKET).remove([existente.storage_path])
    }

    const { error } = await supabase.from("entusiasmo_producciones").delete().eq("id", id)

    if (error) {
      return NextResponse.json(
        { error: "No se pudo eliminar la producción.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno eliminando la producción.", detalle: String(error) },
      { status: 500 }
    )
  }
}
