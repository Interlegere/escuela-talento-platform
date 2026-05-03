import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
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

    const supabase = createAdminSupabaseClient()

    const { error } = await supabase.from("google_calendar_tokens").insert({
      user_email: auth.actor.email,
      access_token: tokens.access_token || "",
      refresh_token: tokens.refresh_token || "",
      scope: tokens.scope || "",
      token_type: tokens.token_type || "",
      expiry_date: tokens.expiry_date ? String(tokens.expiry_date) : "",
    })

    if (error) {
      return NextResponse.json(
        { error: "No se pudieron guardar los tokens", detalle: error.message },
        { status: 500 }
      )
    }

    return NextResponse.redirect(`${appUrl}/agenda`)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error en callback Google"

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
