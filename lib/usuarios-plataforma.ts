import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

// Cuánto dura activo un link de recuperación de clave.
const RESET_TOKEN_TTL_MINUTOS = 60
// Cooldown mínimo entre dos pedidos de recuperación seguidos, para que
// alguien no pueda hacer que se disparen mails en cadena.
const RESET_COOLDOWN_MINUTOS = 2

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

function hashearTokenRecuperacion(token: string) {
  // A diferencia de la clave (baja entropía, necesita salt + hash lento),
  // el token es un random de 32 bytes generado acá mismo — con esa entropía
  // un hash rápido (sha256) ya alcanza, no hace falta scrypt.
  return createHash("sha256").update(token).digest("hex")
}

type SolicitudRecuperacion =
  | { generado: true; token: string; nombre: string; email: string }
  | { generado: false; motivo: "no_encontrado" | "inactivo" | "cooldown" }

export async function solicitarRecuperacionClave(
  email: string
): Promise<SolicitudRecuperacion> {
  const emailNormalizado = normalizarEmail(email)
  const supabase = createAdminSupabaseClient()

  const { data } = await supabase
    .from("usuarios_plataforma")
    .select("id, nombre, activo, reset_requested_at")
    .eq("email", emailNormalizado)
    .maybeSingle()

  if (!data) {
    return { generado: false, motivo: "no_encontrado" }
  }

  if (!data.activo) {
    return { generado: false, motivo: "inactivo" }
  }

  const pedidoAnterior = data.reset_requested_at
    ? new Date(data.reset_requested_at as string).getTime()
    : 0
  const cooldownMs = RESET_COOLDOWN_MINUTOS * 60 * 1000

  if (pedidoAnterior && Date.now() - pedidoAnterior < cooldownMs) {
    return { generado: false, motivo: "cooldown" }
  }

  const token = randomBytes(32).toString("hex")
  const ahora = new Date()
  const expira = new Date(ahora.getTime() + RESET_TOKEN_TTL_MINUTOS * 60 * 1000)

  const { error } = await supabase
    .from("usuarios_plataforma")
    .update({
      reset_token_hash: hashearTokenRecuperacion(token),
      reset_token_expires_at: expira.toISOString(),
      reset_requested_at: ahora.toISOString(),
    })
    .eq("id", data.id)

  if (error) {
    throw error
  }

  return {
    generado: true,
    token,
    nombre: (data.nombre as string) || "",
    email: emailNormalizado,
  }
}

type ConfirmacionRecuperacion =
  | { ok: true }
  | { ok: false; error: "token_invalido" | "token_vencido" }

export async function confirmarRecuperacionClave(
  token: string,
  nuevaClave: string
): Promise<ConfirmacionRecuperacion> {
  const supabase = createAdminSupabaseClient()
  const hash = hashearTokenRecuperacion(token)

  const { data } = await supabase
    .from("usuarios_plataforma")
    .select("id, reset_token_expires_at")
    .eq("reset_token_hash", hash)
    .maybeSingle()

  if (!data) {
    return { ok: false, error: "token_invalido" }
  }

  const expiraEn = data.reset_token_expires_at
    ? new Date(data.reset_token_expires_at as string).getTime()
    : 0

  if (!expiraEn || Date.now() > expiraEn) {
    return { ok: false, error: "token_vencido" }
  }

  const { error } = await supabase
    .from("usuarios_plataforma")
    .update({
      password_hash: crearPasswordHash(nuevaClave),
      reset_token_hash: null,
      reset_token_expires_at: null,
      reset_requested_at: null,
    })
    .eq("id", data.id)

  if (error) {
    throw error
  }

  return { ok: true }
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
