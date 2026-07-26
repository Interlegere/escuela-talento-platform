import { NextResponse } from "next/server"
import { requirePermission, type ActivitySlug } from "@/lib/authz"
import { asegurarActividadBase } from "@/lib/core-activities"
import {
  asegurarHonorarioYPagoAdmin,
  sincronizarPrecioComboSiCorresponde,
  syncInscripcionAdmin,
  syncHonorarioEstadoAdmin,
  syncUsuarioActividadAdmin,
} from "@/lib/admin-activity-sync"
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
      .select("id, nombre, apellido, email, activo")
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

    const actividadesValidas = body.actividades.filter((item) =>
      esActividadValida(item.actividadSlug)
    )

    if (actividadesValidas.length === 0) {
      return NextResponse.json(
        { error: "No hay actividades válidas para guardar." },
        { status: 400 }
      )
    }

    const nombreCompleto = [usuario.nombre, usuario.apellido]
      .filter(Boolean)
      .join(" ")
    const advertencias: string[] = []
    let honorariosCreados = 0
    let pagosCreados = 0

    const actividadesConInscripcion = new Map<number | string, { id: number }>()

    for (const actividad of actividadesValidas) {
      if (actividad.actividadSlug === "membresia") {
        continue
      }

      const actividadBase = await asegurarActividadBase(
        actividad.actividadSlug as Exclude<ActivitySlug, "membresia">
      )
      actividadesConInscripcion.set(actividadBase.slug, {
        id: actividadBase.id,
      })
    }

    for (const actividad of actividadesValidas) {
      await syncUsuarioActividadAdmin({
        supabase,
        usuarioId: usuario.id,
        usuarioEmail,
        actividadSlug: actividad.actividadSlug,
        habilitada: actividad.habilitada,
        notas: actividad.notas || null,
      })

      const actividadBase = actividadesConInscripcion.get(actividad.actividadSlug)

      if (!actividadBase) {
        continue
      }

      await syncInscripcionAdmin({
        supabase,
        actividadId: actividadBase.id,
        participanteEmail: usuarioEmail,
        participanteNombre: nombreCompleto,
        activa: actividad.habilitada,
      })

      await syncHonorarioEstadoAdmin({
        supabase,
        actividadId: actividadBase.id,
        participanteEmail: usuarioEmail,
        activo: actividad.habilitada,
      })

      if (!actividad.habilitada) {
        continue
      }

      const provision = await asegurarHonorarioYPagoAdmin({
        supabase,
        actividadId: actividadBase.id,
        actividadSlug: actividad.actividadSlug,
        participanteEmail: usuarioEmail,
        participanteNombre: nombreCompleto,
      })

      if (provision.honorarioCreado) {
        honorariosCreados += 1
      }

      if (provision.pagoCreado) {
        pagosCreados += 1
      }

      if (provision.advertencia) {
        advertencias.push(provision.advertencia)
      }
    }

    await sincronizarPrecioComboSiCorresponde(supabase, usuarioEmail)

    const { data, error } = await supabase
      .from("usuario_actividades")
      .select("*")
      .eq("usuario_email", usuarioEmail)
      .order("actividad_slug", { ascending: true })

    if (error) {
      return NextResponse.json(
        {
          error: "Las actividades se guardaron, pero no se pudieron recargar.",
          detalle: error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      actividades: data || [],
      provisioning: {
        honorariosCreados,
        pagosCreados,
        advertencias,
      },
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
