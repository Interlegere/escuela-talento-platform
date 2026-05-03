import { NextResponse } from "next/server"
import { requireAuthenticatedActor } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  nombre?: string
  apellido?: string
  whatsapp?: string
  fechaCumpleanos?: string
}

function normalizarFecha(value?: string) {
  const fecha = String(value || "").trim()

  if (!fecha) {
    return null
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null
}

export async function GET() {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from("usuarios_plataforma")
      .select("id, nombre, apellido, email, whatsapp, fecha_cumpleanos, role, activo")
      .eq("email", auth.actor.email)
      .maybeSingle()

    if (error) {
      throw error
    }

    return NextResponse.json({
      ok: true,
      perfil: data || {
        id: null,
        nombre: auth.actor.name,
        apellido: "",
        email: auth.actor.email,
        whatsapp: "",
        fecha_cumpleanos: null,
        role: auth.actor.role,
        activo: true,
      },
      editable: Boolean(data),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar el perfil.",
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

    const body = (await req.json()) as Body
    const nombre = String(body.nombre || "").trim()
    const apellido = String(body.apellido || "").trim()
    const whatsapp = String(body.whatsapp || "").trim()
    const fechaCumpleanos = normalizarFecha(body.fechaCumpleanos)

    if (!nombre) {
      return NextResponse.json(
        { error: "El nombre es obligatorio." },
        { status: 400 }
      )
    }

    if (body.fechaCumpleanos && !fechaCumpleanos) {
      return NextResponse.json(
        { error: "La fecha de cumpleaños no es válida." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const { data: existente, error: existenteError } = await supabase
      .from("usuarios_plataforma")
      .select("id")
      .eq("email", auth.actor.email)
      .maybeSingle()

    if (existenteError) {
      throw existenteError
    }

    if (!existente?.id) {
      return NextResponse.json(
        {
          error:
            "Este perfil todavía pertenece a un usuario de prueba. Creá el usuario desde Admin Usuarios para habilitar edición completa.",
        },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from("usuarios_plataforma")
      .update({
        nombre,
        apellido: apellido || null,
        whatsapp: whatsapp || null,
        fecha_cumpleanos: fechaCumpleanos,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existente.id)
      .select("id, nombre, apellido, email, whatsapp, fecha_cumpleanos, role, activo")
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      ok: true,
      perfil: data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo guardar el perfil.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}

