import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireAuthenticatedActor,
  resolveActivityAccess,
} from "@/lib/authz"
import { asegurarActividadBase } from "@/lib/core-activities"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { tieneContenidoRecurso } from "@/lib/recursos"

type Body = {
  recursoId?: number
  titulo?: string
  descripcion?: string
  recursoTipo?: string
  url?: string
  visible?: boolean
}

type ActividadRecursoRow = {
  id: number
  activo?: boolean | null
  recursos?:
    | {
        id: number
        slug?: string | null
        nombre?: string | null
        descripcion?: string | null
        tipo?: string | null
        url?: string | null
      }
    | Array<{
        id: number
        slug?: string | null
        nombre?: string | null
        descripcion?: string | null
        tipo?: string | null
        url?: string | null
      }>
    | null
}

function tomarRecurso(row: ActividadRecursoRow) {
  if (Array.isArray(row.recursos)) {
    return row.recursos[0] || null
  }

  return row.recursos || null
}

function mapearActividadRecurso(row: ActividadRecursoRow) {
  const recurso = tomarRecurso(row)

  return {
    id: recurso?.id || row.id,
    actividadRecursoId: row.id,
    slug: recurso?.slug || null,
    titulo: recurso?.nombre || "Recurso",
    descripcion: recurso?.descripcion || null,
    recurso_tipo: recurso?.tipo || "enlace",
    url: recurso?.url || "",
    visible: row.activo !== false,
  }
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
}

export async function GET() {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const adminPermission = getActivityAdminPermission("conectando-sentidos")
    const esAdmin = adminPermission
      ? hasPermission(auth.actor, adminPermission)
      : false

    if (!esAdmin) {
      const acceso = await resolveActivityAccess(
        "conectando-sentidos",
        auth.actor.email
      )

      return NextResponse.json({
        ok: true,
        recursos: (acceso.recursos || [])
          .filter(
            (item) =>
              item.tipo !== "reunion" &&
              item.tipo !== "biblioteca"
          )
          .map((item) => ({
            id: item.id,
            titulo: item.nombre || "Recurso",
            descripcion: item.descripcion || null,
            recurso_tipo: item.tipo || "enlace",
            url: item.url || "",
            visible: true,
          })),
      })
    }

    const actividad = await asegurarActividadBase("conectando-sentidos")
    const supabase = createAdminSupabaseClient()

    const { data, error } = await supabase
      .from("actividad_recursos")
      .select("id, activo, recursos(*)")
      .eq("actividad_id", actividad.id)
      .order("id", { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({
      ok: true,
      recursos: ((data || []) as ActividadRecursoRow[])
        .filter(
          (item) =>
            tomarRecurso(item)?.tipo !== "reunion" &&
            tomarRecurso(item)?.tipo !== "biblioteca"
        )
        .map(mapearActividadRecurso),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron cargar los recursos de Conectando Sentidos.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const adminPermission = getActivityAdminPermission("conectando-sentidos")
    const esAdmin = adminPermission
      ? hasPermission(auth.actor, adminPermission)
      : false

    if (!esAdmin) {
      return NextResponse.json(
        { error: "No tenés permisos para cargar recursos." },
        { status: 403 }
      )
    }

    const body = (await req.json()) as Body

    if (
      !body.titulo?.trim() ||
      !tieneContenidoRecurso({
        descripcion: body.descripcion,
        url: body.url,
      })
    ) {
      return NextResponse.json(
        {
          error:
            "Completá el título y agregá una descripción o una URL.",
        },
        { status: 400 }
      )
    }

    const actividad = await asegurarActividadBase("conectando-sentidos")
    const supabase = createAdminSupabaseClient()
    const slugBase = slugify(body.titulo.trim()) || "recurso-conectando"
    const slug = `${slugBase}-${Date.now()}`

    const { data: recurso, error: recursoError } = await supabase
      .from("recursos")
      .insert({
        slug,
        nombre: body.titulo.trim(),
        descripcion: body.descripcion?.trim() || null,
        tipo: body.recursoTipo?.trim() || "enlace",
        proveedor: "externo",
        url: body.url?.trim() || "",
      })
      .select("*")
      .single()

    if (recursoError || !recurso) {
      throw recursoError || new Error("No se pudo crear el recurso.")
    }

    const { error: actividadRecursoError } = await supabase
      .from("actividad_recursos")
      .insert({
        actividad_id: actividad.id,
        recurso_id: recurso.id,
        activo: body.visible !== false,
      })

    if (actividadRecursoError) {
      throw actividadRecursoError
    }

    const { data: actividadRecurso, error: actividadRecursoFetchError } =
      await supabase
        .from("actividad_recursos")
        .select("id, activo, recursos(*)")
        .eq("actividad_id", actividad.id)
        .eq("recurso_id", recurso.id)
        .single()

    if (actividadRecursoFetchError || !actividadRecurso) {
      throw (
        actividadRecursoFetchError ||
        new Error("No se pudo leer el recurso recién creado.")
      )
    }

    return NextResponse.json({
      ok: true,
      recurso: mapearActividadRecurso(actividadRecurso as ActividadRecursoRow),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo guardar el recurso.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const adminPermission = getActivityAdminPermission("conectando-sentidos")
    const esAdmin = adminPermission
      ? hasPermission(auth.actor, adminPermission)
      : false

    if (!esAdmin) {
      return NextResponse.json(
        { error: "No tenés permisos para editar recursos." },
        { status: 403 }
      )
    }

    const body = (await req.json()) as Body

    if (!body.recursoId) {
      return NextResponse.json(
        { error: "Falta el recurso a actualizar." },
        { status: 400 }
      )
    }

    const actividad = await asegurarActividadBase("conectando-sentidos")
    const supabase = createAdminSupabaseClient()

    if (body.titulo !== undefined) {
      if (
        !body.titulo.trim() ||
        !tieneContenidoRecurso({
          descripcion: body.descripcion,
          url: body.url,
        })
      ) {
        return NextResponse.json(
          {
            error: "Completá el título y agregá una descripción o una URL.",
          },
          { status: 400 }
        )
      }

      const { error: recursoError } = await supabase
        .from("recursos")
        .update({
          nombre: body.titulo.trim(),
          descripcion: body.descripcion?.trim() || null,
          tipo: body.recursoTipo?.trim() || "enlace",
          url: body.url?.trim() || "",
        })
        .eq("id", body.recursoId)

      if (recursoError) {
        throw recursoError
      }
    }

    const { data, error } = await supabase
      .from("actividad_recursos")
      .update({
        activo: body.visible === true,
      })
      .eq("actividad_id", actividad.id)
      .eq("recurso_id", body.recursoId)
      .select("id, activo, recursos(*)")
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      ok: true,
      recurso: mapearActividadRecurso(data as ActividadRecursoRow),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo actualizar el recurso.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const adminPermission = getActivityAdminPermission("conectando-sentidos")
    const esAdmin = adminPermission
      ? hasPermission(auth.actor, adminPermission)
      : false

    if (!esAdmin) {
      return NextResponse.json(
        { error: "No tenés permisos para eliminar recursos." },
        { status: 403 }
      )
    }

    const body = (await req.json()) as Body

    if (!body.recursoId) {
      return NextResponse.json(
        { error: "Falta el recurso a eliminar." },
        { status: 400 }
      )
    }

    const actividad = await asegurarActividadBase("conectando-sentidos")
    const supabase = createAdminSupabaseClient()

    const { error: joinError } = await supabase
      .from("actividad_recursos")
      .delete()
      .eq("actividad_id", actividad.id)
      .eq("recurso_id", body.recursoId)

    if (joinError) {
      throw joinError
    }

    const { error: recursoError } = await supabase
      .from("recursos")
      .delete()
      .eq("id", body.recursoId)

    if (recursoError) {
      throw recursoError
    }

    return NextResponse.json({
      ok: true,
      recursoId: body.recursoId,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo eliminar el recurso.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
