import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  contenido: string
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("casatalentos.admin")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const contenido = (body.contenido || "").trim()

    const supabase = createAdminSupabaseClient()

    const { data: existentes, error: buscarError } = await supabase
      .from("casatalentos_referentes_generales")
      .select("*")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })

    if (buscarError) {
      return NextResponse.json(
        { error: "No se pudo consultar referentes generales", detalle: buscarError },
        { status: 500 }
      )
    }

    const existente = existentes?.[0]

    if (existente) {
      const { data, error } = await supabase
        .from("casatalentos_referentes_generales")
        .update({
          contenido,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existente.id)
        .select("*")
        .single()

      if (error) {
        return NextResponse.json(
          { error: "No se pudo actualizar referentes generales", detalle: error },
          { status: 500 }
        )
      }

      return NextResponse.json({ ok: true, item: data })
    }

    const { data, error } = await supabase
      .from("casatalentos_referentes_generales")
      .insert({
        contenido,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo crear referentes generales", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, item: data })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno guardando referentes generales",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
