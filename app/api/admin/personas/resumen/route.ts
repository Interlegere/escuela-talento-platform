import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { buildAdminPersonSummaries } from "@/lib/admin-person-summary"

export async function GET() {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const personas = await buildAdminPersonSummaries()

    return NextResponse.json({
      ok: true,
      personas,
      meta: {
        total: personas.length,
        generadaEn: new Date().toISOString(),
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo construir el resumen integral de personas.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
