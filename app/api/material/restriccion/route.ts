import { NextResponse } from "next/server"
import { requireAuthenticatedActor } from "@/lib/authz"
import { TERMINOS_VERSION } from "@/lib/consentimientos"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  accion?: string
}

export async function GET() {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const supabase = createAdminSupabaseClient()

    // Tabla append-only: el estado vigente es la fila más reciente. Sin
    // ninguna fila para este email, el default es "comparte" (no
    // restringido).
    const { data, error } = await supabase
      .from("material_restricciones")
      .select("accion, created_at")
      .eq("user_email", auth.actor.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw error
    }

    const restringido = data?.accion === "restringe"

    return NextResponse.json({
      ok: true,
      restringido,
      desde: restringido ? data?.created_at || null : null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo consultar el estado de tu material.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const body = (await req.json()) as Body
    const accion = body.accion

    if (accion !== "restringe" && accion !== "levanta") {
      return NextResponse.json({ error: "Acción inválida." }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()

    // Siempre una fila nueva, nunca update: mismo criterio que
    // "consentimientos" — nunca se pisa el historial, el estado vigente es
    // la fila más reciente.
    const { data, error } = await supabase
      .from("material_restricciones")
      .insert({
        user_email: auth.actor.email,
        accion,
        terminos_version: TERMINOS_VERSION,
      })
      .select("accion, created_at")
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      ok: true,
      restringido: data.accion === "restringe",
      desde: data.accion === "restringe" ? data.created_at : null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo guardar tu preferencia.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
