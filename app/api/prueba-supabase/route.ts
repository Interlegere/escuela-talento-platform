import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isInternalDebugToolsEnabled } from "@/lib/dev-flags"

export async function GET() {
  if (!isInternalDebugToolsEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Ruta de diagnóstico deshabilitada." },
      { status: 404 }
    )
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

    if (!supabaseUrl) {
      return NextResponse.json(
        { ok: false, error: "Falta NEXT_PUBLIC_SUPABASE_URL" },
        { status: 500 }
      )
    }

    if (!supabaseAnonKey) {
      return NextResponse.json(
        { ok: false, error: "Falta NEXT_PUBLIC_SUPABASE_ANON_KEY" },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase
      .from("disponibilidades")
      .select("*")
      .limit(5)

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Error de Supabase",
          detalle: error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      urlUsada: supabaseUrl,
      filas: data || [],
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error inesperado",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
