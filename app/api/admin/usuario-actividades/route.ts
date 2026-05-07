import { NextResponse } from "next/server"
import { requirePermission, type ActivitySlug } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const ACTIVIDADES_VALIDAS: ActivitySlug[] = [
  "casatalentos",
  "conectando-sentidos",
  "mentorias",
  "terapia",
  "membresia",
]

type Body = {
  usuarioId?: string
  usuarioEmail?: string
  actividades?: {
    actividadSlug: ActivitySlug
    habilitada: boolean
    notas?: string
  }[]
}

function normalizarEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase()
}

function esActividadValida(slug: string): slug is ActivitySlug {
  return ACTIVIDADES_VALIDAS.includes(slug as ActivitySlug)
}

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const { searchParams } = new URL(req.url)
    const usuarioEmail = normalizarEmail(searchParams.get("usuarioEmail"))

    if (!usuarioEmail) {
      return NextResponse.json(
        { error: "Falta usuarioEmail." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data, error } = await supabase
      .from("usuario_actividades")
      .select("*")
      .eq("usuario_email", usuarioEmail)
      .order("actividad_slug", { ascending: true })

    if (error) {
      return NextResponse.json(
        {
          error: "No se pudieron cargar las actividades del usuario.",
          detalle: error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      actividades: data || [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno cargando actividades del usuario.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const usuarioEmail = normalizarEmail(body.usuarioEmail)

    if (!usuarioEmail) {
      return NextResponse.json(
        { error: "Falta usuarioEmail." },
        { status: 400 }
      )
    }

    if (!Array.isArray(body.actividades)) {
      return NextResponse.json(
        { error: "Falta la lista de actividades." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: usuario, error: usuarioError } = await supabase
      .from("usuarios_plataforma")
      .select("id, email, activo")
      .eq("email", usuarioEmail)
      .maybeSingle()

    if (usuarioError) {
      return NextResponse.json(
        {
          error: "No se pudo validar el usuario.",
          detalle: usuarioError,
        },
        { status: 500 }
      )
    }

    if (!usuario) {
      return NextResponse.json(
        {
          error:
            "Ese usuario no existe. Primero crealo desde Admin Usuarios.",
        },
        { status: 404 }
      )
    }

    const registros = body.actividades
      .filter((item) => esActividadValida(item.actividadSlug))
      .map((item) => ({
        usuario_id: usuario.id,
        usuario_email: usuarioEmail,
        actividad_slug: item.actividadSlug,
        estado: item.habilitada ? "activa" : "inactiva",
        origen: "admin",
        notas: item.notas || null,
        updated_at: new Date().toISOString(),
      }))

    if (registros.length === 0) {
      return NextResponse.json(
        { error: "No hay actividades válidas para guardar." },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("usuario_actividades")
      .upsert(registros, {
        onConflict: "usuario_email,actividad_slug",
      })
      .select("*")

    if (error) {
      return NextResponse.json(
        {
          error: "No se pudieron guardar las actividades del usuario.",
          detalle: error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      actividades: data || [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno guardando actividades del usuario.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}