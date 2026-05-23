import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type ContactoBody = {
  id?: number | string | null
  email?: string | null
  nombre?: string | null
  apellido?: string | null
  telefono?: string | null
  origen?: string | null
  etiquetas?: unknown
  activo?: boolean | null
  notas?: string | null
}

function normalizarEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase()
}

function normalizarTexto(value?: string | null) {
  const texto = String(value || "").trim()
  return texto || null
}

function normalizarEtiquetas(etiquetas: unknown) {
  if (Array.isArray(etiquetas)) {
    return etiquetas
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  }

  if (typeof etiquetas === "string") {
    return etiquetas
      .split(/[,;\n]+/g)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

export async function GET() {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from("comunicacion_contactos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json(
        {
          error:
            "No se pudieron cargar los contactos externos. Verificá que la migración esté aplicada.",
          detalle: error.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      contactos: data || [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los contactos externos.",
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

    const body = (await req.json()) as ContactoBody
    const email = normalizarEmail(body.email)

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Ingresá un email válido." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from("comunicacion_contactos")
      .insert({
        email,
        nombre: normalizarTexto(body.nombre),
        apellido: normalizarTexto(body.apellido),
        telefono: normalizarTexto(body.telefono),
        origen: normalizarTexto(body.origen),
        etiquetas: normalizarEtiquetas(body.etiquetas),
        activo: body.activo !== false,
        notas: normalizarTexto(body.notas),
      })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo crear el contacto externo.", detalle: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      contacto: data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear el contacto externo.",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const body = (await req.json()) as ContactoBody
    const id = Number(body.id)

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { error: "Falta id de contacto." },
        { status: 400 }
      )
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.email !== undefined) {
      const email = normalizarEmail(body.email)
      if (!email || !email.includes("@")) {
        return NextResponse.json(
          { error: "Ingresá un email válido." },
          { status: 400 }
        )
      }
      update.email = email
    }

    if (body.nombre !== undefined) update.nombre = normalizarTexto(body.nombre)
    if (body.apellido !== undefined) update.apellido = normalizarTexto(body.apellido)
    if (body.telefono !== undefined) update.telefono = normalizarTexto(body.telefono)
    if (body.origen !== undefined) update.origen = normalizarTexto(body.origen)
    if (body.etiquetas !== undefined) {
      update.etiquetas = normalizarEtiquetas(body.etiquetas)
    }
    if (body.activo !== undefined && body.activo !== null) {
      update.activo = body.activo === true
    }
    if (body.notas !== undefined) update.notas = normalizarTexto(body.notas)

    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from("comunicacion_contactos")
      .update(update)
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        {
          error: "No se pudo actualizar el contacto externo.",
          detalle: error.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      contacto: data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el contacto externo.",
      },
      { status: 500 }
    )
  }
}
