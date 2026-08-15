import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  participanteEmail?: string
}

export async function POST(req: Request) {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json().catch(() => ({}) as Body)
    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")
    const emailSolicitado = body.participanteEmail?.trim().toLowerCase()

    if (emailSolicitado && emailSolicitado !== auth.actor.email && !esAdmin) {
      return NextResponse.json(
        { error: "No podés marcar como leído el espacio de otra persona." },
        { status: 403 }
      )
    }

    const emailObjetivo = emailSolicitado || auth.actor.email
    const supabase = createAdminSupabaseClient()

    const { error } = await supabase.from("entusiasmo_lecturas").upsert(
      {
        lector_email: auth.actor.email,
        participante_email: emailObjetivo,
        leido_at: new Date().toISOString(),
      },
      { onConflict: "lector_email,participante_email" }
    )

    if (error) {
      return NextResponse.json(
        { error: "No se pudo registrar la lectura.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno registrando la lectura.", detalle: String(error) },
      { status: 500 }
    )
  }
}
