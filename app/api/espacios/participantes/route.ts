import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  requireActivityAccess,
} from "@/lib/authz"
import {
  esActividadEspacio,
  listarParticipantesActividad,
} from "@/lib/espacios"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  actividadSlug?: string
}

type UsuarioActividadRow = {
  usuario_email?: string | null
  usuarios_plataforma?: {
    nombre?: string | null
    apellido?: string | null
    email?: string | null
    activo?: boolean | null
  } | null
}

function normalizarEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase()
}

async function listarParticipantesDesdeUsuarioActividades(actividadSlug: string) {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from("usuario_actividades")
    .select(
      `
      usuario_email,
      usuarios_plataforma:usuario_id (
        nombre,
        apellido,
        email,
        activo
      )
    `
    )
    .eq("actividad_slug", actividadSlug)
    .eq("estado", "activa")
    .order("usuario_email", { ascending: true })

  if (error) {
    throw error
  }

  const filas = (data || []) as UsuarioActividadRow[]

  return filas
    .filter((item) => item.usuarios_plataforma?.activo !== false)
    .map((item) => {
      const usuario = item.usuarios_plataforma
      const email = normalizarEmail(usuario?.email || item.usuario_email)
      const nombre =
        [usuario?.nombre, usuario?.apellido].filter(Boolean).join(" ").trim() ||
        email

      return {
        email,
        nombre,
      }
    })
    .filter((item) => item.email)
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body

    if (!body.actividadSlug || !esActividadEspacio(body.actividadSlug)) {
      return NextResponse.json(
        { error: "Actividad inválida para este espacio." },
        { status: 400 }
      )
    }

    const auth = await requireActivityAccess(
      body.actividadSlug,
      getActivityAdminPermission(body.actividadSlug)
    )

    if ("response" in auth) {
      return auth.response
    }

    if (auth.actor.role !== "admin") {
      return NextResponse.json(
        { error: "Solo admin puede listar participantes." },
        { status: 403 }
      )
    }

    let participantes = await listarParticipantesDesdeUsuarioActividades(
      body.actividadSlug
    )

    if (participantes.length === 0) {
      participantes = await listarParticipantesActividad(body.actividadSlug)
    }

    return NextResponse.json({
      ok: true,
      participantes,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron cargar los participantes.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}