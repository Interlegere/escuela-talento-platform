import { randomBytes, scryptSync, timingSafeEqual } from "crypto"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export type UsuarioPlataformaRole = "admin" | "colaborador" | "participante"

export type UsuarioPlataforma = {
  id: string
  nombre: string
  apellido?: string | null
  email: string
  whatsapp?: string | null
  fecha_cumpleanos?: string | null
  notas_documentos?: unknown
  charla_intro_habilitada?: boolean | null
  role: UsuarioPlataformaRole
  activo: boolean
  created_at?: string | null
  updated_at?: string | null
}

type UsuarioPlataformaRow = UsuarioPlataforma & {
  password_hash: string
}

type AuthResult =
  | { found: true; user: UsuarioPlataforma | null }
  | { found: false; user?: never }

function normalizarEmail(email: string) {
  return email.trim().toLowerCase()
}

export function normalizarUsuarioRole(role?: string | null): UsuarioPlataformaRole {
  if (role === "admin" || role === "colaborador") {
    return role
  }

  return "participante"
}

export function crearPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")

  return `scrypt:${salt}:${hash}`
}

export function verificarPassword(password: string, storedHash: string) {
  const [metodo, salt, hash] = storedHash.split(":")

  if (metodo !== "scrypt" || !salt || !hash) {
    return false
  }

  const expected = Buffer.from(hash, "hex")
  const actual = scryptSync(password, salt, expected.length)

  if (expected.length !== actual.length) {
    return false
  }

  return timingSafeEqual(expected, actual)
}

function mapearUsuario(row: UsuarioPlataformaRow): UsuarioPlataforma {
  return {
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido || null,
    email: normalizarEmail(row.email),
    whatsapp: row.whatsapp || null,
    fecha_cumpleanos: row.fecha_cumpleanos || null,
    notas_documentos: row.notas_documentos || [],
    charla_intro_habilitada: row.charla_intro_habilitada === true,
    role: normalizarUsuarioRole(row.role),
    activo: row.activo === true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function autenticarUsuarioPlataforma(
  email: string,
  password: string
): Promise<AuthResult> {
  const emailNormalizado = normalizarEmail(email)

  if (!emailNormalizado || !password) {
    return { found: false }
  }

  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from("usuarios_plataforma")
      .select("*")
      .eq("email", emailNormalizado)
      .maybeSingle()

    if (error) {
      const texto = String(error.message || "").toLowerCase()

      if (
        texto.includes("does not exist") ||
        texto.includes("relation") ||
        texto.includes("could not find")
      ) {
        return { found: false }
      }

      throw error
    }

    if (!data) {
      return { found: false }
    }

    const usuario = data as UsuarioPlataformaRow

    if (!usuario.activo || !verificarPassword(password, usuario.password_hash)) {
      return { found: true, user: null }
    }

    return {
      found: true,
      user: mapearUsuario(usuario),
    }
  } catch (error) {
    console.error("Error autenticando usuario de plataforma", error)
    return { found: false }
  }
}

export async function listarUsuariosPlataforma() {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from("usuarios_plataforma")
    .select(
      "id, nombre, apellido, email, whatsapp, fecha_cumpleanos, notas_documentos, charla_intro_habilitada, role, activo, created_at, updated_at"
    )
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return ((data || []) as UsuarioPlataforma[]).map((item) => ({
    ...item,
    email: normalizarEmail(item.email),
    role: normalizarUsuarioRole(item.role),
  }))
}
