import { NextResponse } from "next/server"
import { google } from "googleapis"
import { requirePermission } from "@/lib/authz"

export async function GET() {
  const auth = await requirePermission("agenda.manage")

  if ("response" in auth) {
    return auth.response
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      {
        error: "Faltan variables de Google en .env.local",
      },
      { status: 500 }
    )
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  )

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar"],
  })

  return NextResponse.redirect(url)
}
