import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { enviarBienvenidaUsuario } from "@/lib/mailing"
import {
  normalizarDocumentosNotas,
  parsearDocumentosNotasDesdeTexto,
} from "@/lib/documentos-notas"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import {
  crearPasswordHash,
  listarUsuariosPlataforma,
  normalizarUsuarioRole,
  type UsuarioPlataformaRole,
} from "@/lib/usuarios-plataforma"

type Body = {
  id?: string
  nombre?: string
  apellido?: string
  email?: string
  whatsapp?: string
  fechaCumpleanos?: string
  notasDocumentos?: string | unknown[]
  role?: UsuarioPlataformaRole
  activo?: boolean
  password?: string
  enviarBienvenida?: boolean
}

function normalizarEmail(email?: string) {
  return String(email || "").trim().toLowerCase()
}

function validarPassword(password: string, esNuevo: boolean) {
  if (!password && !esNuevo) {
    return null
  }

  if (password.length < 4) {
    return "La contraseña debe tener al menos 4 caracteres."
  }

  return null
}

export async function GET() {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const usuarios = await listarUsuariosPlataforma()

    return NextResponse.json({
      ok: true,
      usuarios,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron cargar los usuarios.",
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

    const body = (await req.json()) as Body
    const id = String(body.id || "").trim()
    const nombre = String(body.nombre || "").trim()
    const apellido = String(body.apellido || "").trim()
    const email = normalizarEmail(body.email)
    const whatsapp = String(body.whatsapp || "").trim()
    const fechaCumpleanos = String(body.fechaCumpleanos || "").trim()
    const notasDocumentos =
      typeof body.notasDocumentos === "string"
        ? parsearDocumentosNotasDesdeTexto(body.notasDocumentos)
        : normalizarDocumentosNotas(body.notasDocumentos)
    const role = normalizarUsuarioRole(body.role)
    const activo = body.activo !== false
    const password = String(body.password || "")
    const esNuevo = !id
    const enviarBienvenida = body.enviarBienvenida !== false

    if (!nombre || !email) {
      return NextResponse.json(
        { error: "Faltan nombre y email para guardar el usuario." },
        { status: 400 }
      )
    }

    const passwordError = validarPassword(password, esNuevo)

    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()
    const payload: Record<string, unknown> = {
      nombre,
      apellido: apellido || null,
      email,
      whatsapp: whatsapp || null,
      fecha_cumpleanos: fechaCumpleanos || null,
      notas_documentos: notasDocumentos,
      role,
      activo,
      updated_at: new Date().toISOString(),
    }

    if (password) {
      payload.password_hash = crearPasswordHash(password)
    }

    if (esNuevo) {
      payload.created_at = new Date().toISOString()

      const { data, error } = await supabase
        .from("usuarios_plataforma")
        .insert(payload)
        .select(
          "id, nombre, apellido, email, whatsapp, fecha_cumpleanos, notas_documentos, role, activo, created_at, updated_at"
        )
        .single()

      if (error) {
        return NextResponse.json(
          {
            error:
              error.code === "23505"
                ? "Ya existe un usuario con ese email."
                : "No se pudo crear el usuario.",
            detalle: error,
          },
          { status: 500 }
        )
      }

      const mailing =
        enviarBienvenida && password
          ? await enviarBienvenidaUsuario({
              nombre,
              email,
              password,
              role,
            })
          : {
              enviado: false as const,
              motivo: "Bienvenida por email omitida.",
            }

      return NextResponse.json({ ok: true, usuario: data, mailing })
    }

    const { data, error } = await supabase
      .from("usuarios_plataforma")
      .update(payload)
      .eq("id", id)
      .select(
        "id, nombre, apellido, email, whatsapp, fecha_cumpleanos, notas_documentos, role, activo, created_at, updated_at"
      )
      .single()

    if (error) {
      return NextResponse.json(
        {
          error: "No se pudo actualizar el usuario.",
          detalle: error,
        },
        { status: 500 }
      )
    }

    const mailing =
      enviarBienvenida && password
        ? await enviarBienvenidaUsuario({
            nombre,
            email,
            password,
            role,
          })
        : null

    return NextResponse.json({ ok: true, usuario: data, mailing })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno guardando el usuario.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
