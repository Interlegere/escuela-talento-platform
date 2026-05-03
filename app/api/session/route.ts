import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({
        authenticated: false,
        session: null,
      })
    }

    return NextResponse.json({
      authenticated: true,
      session,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        authenticated: false,
        session: null,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo obtener la sesión",
      },
      { status: 500 }
    )
  }
}
