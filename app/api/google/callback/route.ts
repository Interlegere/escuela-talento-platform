import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import {
  getConfiguredGoogleCalendarOwnerEmail,
  resolverGoogleAccountEmailDesdeCalendar,
} from "@/lib/google-calendar"
import { obtenerAppUrl } from "@/lib/server-url"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission("agenda.manage")

    if ("response" in auth) {
      return auth.response
    }

    const appUrl = obtenerAppUrl(req)
    const code = req.nextUrl.searchParams.get("code")

    if (!code) {
      return NextResponse.json(
        { error: "Falta code en callback de Google" },
        { status: 400 }
      )
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { error: "Faltan variables de Google en .env.local" },
        { status: 500 }
      )
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    )

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    const supabase = createAdminSupabaseClient()
    const googleOwnerEmail = getConfiguredGoogleCalendarOwnerEmail()
    const googleRealEmail = await resolverGoogleAccountEmailDesdeCalendar(
      oauth2Client
    )

    if (googleOwnerEmail && googleRealEmail !== googleOwnerEmail) {
      const params = new URLSearchParams({
        google_error: `Conectaste ${googleRealEmail}, pero ENTHEOS está configurado para usar ${googleOwnerEmail}.`,
      })

      return NextResponse.redirect(`${appUrl}/google-calendar?${params.toString()}`)
    }

    const { data: tokenExistente, error: tokenExistenteError } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .eq("user_email", googleRealEmail)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (tokenExistenteError) {
      return NextResponse.json(
        {
          error: "No se pudo leer el token existente de Google Calendar",
          detalle: tokenExistenteError.message,
        },
        { status: 500 }
      )
    }

    const payload = {
      user_email: googleRealEmail,
      access_token: tokens.access_token || tokenExistente?.access_token || "",
      refresh_token: tokens.refresh_token || tokenExistente?.refresh_token || "",
      scope: tokens.scope || tokenExistente?.scope || "",
      token_type: tokens.token_type || tokenExistente?.token_type || "",
      expiry_date: tokens.expiry_date
        ? String(tokens.expiry_date)
        : tokenExistente?.expiry_date || "",
    }

    if (tokenExistente?.id) {
      const { error } = await supabase
        .from("google_calendar_tokens")
        .update(payload)
        .eq("id", tokenExistente.id)

      if (error) {
        return NextResponse.json(
          { error: "No se pudieron actualizar los tokens", detalle: error.message },
          { status: 500 }
        )
      }
    } else {
      const { error } = await supabase
        .from("google_calendar_tokens")
        .insert(payload)

      if (error) {
        return NextResponse.json(
          { error: "No se pudieron guardar los tokens", detalle: error.message },
          { status: 500 }
        )
      }
    }

    const params = new URLSearchParams({
      google_success: `Cuenta conectada correctamente: ${googleRealEmail}.`,
    })

    return NextResponse.redirect(`${appUrl}/google-calendar?${params.toString()}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error en callback Google"
    const appUrl = obtenerAppUrl(req)
    const params = new URLSearchParams({
      google_error: message,
    })

    return NextResponse.redirect(`${appUrl}/google-calendar?${params.toString()}`)
  }
}
