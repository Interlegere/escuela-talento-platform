import { google } from "googleapis"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

// Mismo patrón de OAuth que ya usa lib/google-calendar.ts para la cuenta
// única de Nicolás, pero indexado por participante en vez de por la cuenta
// configurada en GOOGLE_CALENDAR_OWNER_EMAIL — es intencional que este
// archivo no reutilice ni modifique lib/google-calendar.ts: esa lógica ya
// está en producción sosteniendo la sincronización de la Agenda, y esto es
// un flujo nuevo e independiente (una fila de google_calendar_tokens por
// participante, vía la columna participante_email).
const SCOPE_PARTICIPANTE = "https://www.googleapis.com/auth/calendar.events"

type TokenRow = {
  id: number
  access_token?: string | null
  refresh_token?: string | null
}

// Necesita su propia variable de entorno (no reutiliza GOOGLE_REDIRECT_URI)
// porque apunta a un path distinto (/api/google/participante/callback en
// vez de /api/google/callback) — hay que cargarla en Vercel y registrar esa
// misma URL como "Authorized redirect URI" en el proyecto de Google Cloud
// (mismo Client ID que ya se usa, no hace falta una app nueva).
export function faltaConfigurarGoogleParticipante() {
  return !(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_PARTICIPANTE_REDIRECT_URI
  )
}

function construirOauth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_PARTICIPANTE_REDIRECT_URI
  )
}

export function generarUrlConexionParticipante() {
  const oauth2Client = construirOauth2Client()

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [SCOPE_PARTICIPANTE],
  })
}

export async function intercambiarCodigoYGuardar(participanteEmail: string, code: string) {
  const oauth2Client = construirOauth2Client()
  const { tokens } = await oauth2Client.getToken(code)
  const supabase = createAdminSupabaseClient()

  const { data: existente } = await supabase
    .from("google_calendar_tokens")
    .select("id, refresh_token")
    .eq("participante_email", participanteEmail)
    .maybeSingle<{ id: number; refresh_token: string | null }>()

  const payload = {
    participante_email: participanteEmail,
    user_email: participanteEmail,
    access_token: tokens.access_token || null,
    // Google solo manda refresh_token la primera vez que se conecta (con
    // prompt=consent); si ya había uno guardado y esta vez no vino, hay que
    // conservar el que ya se tenía en vez de pisarlo con null.
    refresh_token: tokens.refresh_token || existente?.refresh_token || null,
    scope: tokens.scope || null,
    token_type: tokens.token_type || null,
    expiry_date: tokens.expiry_date ? String(tokens.expiry_date) : null,
  }

  // upsert atómico (apoyado en el índice único de participante_email) en vez
  // de "leer si existe y decidir insert/update" — evita la ventana de
  // carrera entre el select y el write. La lectura de arriba sigue haciendo
  // falta, pero solo para decidir el refresh_token a conservar, no para
  // decidir insert-vs-update.
  await supabase
    .from("google_calendar_tokens")
    .upsert(payload, { onConflict: "participante_email" })
}

async function buscarTokenParticipante(participanteEmail: string) {
  const supabase = createAdminSupabaseClient()

  const { data } = await supabase
    .from("google_calendar_tokens")
    .select("id, access_token, refresh_token")
    .eq("participante_email", participanteEmail)
    .maybeSingle<TokenRow>()

  return data
}

export async function tieneGoogleConectado(participanteEmail: string) {
  const token = await buscarTokenParticipante(participanteEmail)
  return Boolean(token?.refresh_token)
}

// Devuelve un cliente de Calendar autenticado como ESE participante (no
// como Nicolás) — cualquier evento que se cree ahí vive directo en el
// calendario de la persona, sin invitar a nadie y sin pasar por la cuenta
// admin, así que no aplica el bloqueo de Workspace a invitados externos.
export async function obtenerClienteCalendarParticipante(participanteEmail: string) {
  const tokenRow = await buscarTokenParticipante(participanteEmail)

  if (!tokenRow?.refresh_token) {
    return null
  }

  const oauth2Client = construirOauth2Client()
  oauth2Client.setCredentials({
    access_token: tokenRow.access_token || undefined,
    refresh_token: tokenRow.refresh_token,
  })

  oauth2Client.on("tokens", async (tokens) => {
    try {
      const cambios: Record<string, string> = {}
      if (tokens.access_token) cambios.access_token = tokens.access_token
      if (tokens.refresh_token) cambios.refresh_token = tokens.refresh_token
      if (tokens.expiry_date) cambios.expiry_date = String(tokens.expiry_date)

      if (Object.keys(cambios).length > 0) {
        await createAdminSupabaseClient()
          .from("google_calendar_tokens")
          .update(cambios)
          .eq("id", tokenRow.id)
      }
    } catch (error) {
      console.warn("No se pudo refrescar el token de Google del participante:", error)
    }
  })

  return google.calendar({ version: "v3", auth: oauth2Client })
}

export async function desconectarGoogleParticipante(participanteEmail: string) {
  const supabase = createAdminSupabaseClient()
  await supabase.from("google_calendar_tokens").delete().eq("participante_email", participanteEmail)
}
