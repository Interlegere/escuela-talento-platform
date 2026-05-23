import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

function normalizarEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase()
}

export async function GET(req: Request) {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const { searchParams } = new URL(req.url)
    const email = normalizarEmail(searchParams.get("email"))
    const estado = String(searchParams.get("estado") || "").trim()
    const tipo = String(searchParams.get("tipo") || "").trim()
    const limite = Math.min(
      Math.max(Number(searchParams.get("limit") || 20), 1),
      100
    )

    const supabase = createAdminSupabaseClient()
    let query = supabase
      .from("comunicacion_envios")
      .select(
        "id, plantilla_id, destinatario_email, destinatario_nombre, actividad_slug, tipo, asunto, estado, proveedor, proveedor_id, error, metadata, created_at, sent_at"
      )
      .order("created_at", { ascending: false })
      .limit(limite)

    if (email) {
      query = query.eq("destinatario_email", email)
    }

    if (estado) {
      query = query.eq("estado", estado)
    }

    if (tipo) {
      query = query.eq("tipo", tipo)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        {
          error:
            "No se pudo cargar el historial de comunicaciones. Verificá que la migración de comunicaciones esté aplicada.",
          detalle: error.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      envios: data || [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el historial de comunicaciones.",
      },
      { status: 500 }
    )
  }
}
