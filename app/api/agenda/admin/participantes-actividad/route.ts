import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
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

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("agenda.manage")

    if ("response" in auth) {
      return auth.response
    }

    const body = (await req.json()) as Body
    const actividadSlug = String(body.actividadSlug || "").trim()

    if (actividadSlug !== "mentorias" && actividadSlug !== "terapia") {
      return NextResponse.json(
        { error: "Actividad inválida para listar participantes." },
        { status: 400 }
      )
    }

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
      return NextResponse.json(
        {
          error: "No se pudieron cargar los participantes de la actividad.",
          detalle: error,
        },
        { status: 500 }
      )
    }

    const participantes = ((data || []) as UsuarioActividadRow[])
      .filter((item) => item.usuarios_plataforma?.activo !== false)
      .map((item) => {
        const usuario = item.usuarios_plataforma
        const email = normalizarEmail(usuario?.email || item.usuario_email)
        const nombre =
          [usuario?.nombre, usuario?.apellido].filter(Boolean).join(" ").trim() ||
          email

        return { email, nombre }
      })
      .filter((item) => item.email)

    return NextResponse.json({
      ok: true,
      participantes,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron cargar los participantes de la actividad.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}