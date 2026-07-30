import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { enviarRespuestaEntheos } from "@/lib/comunicaciones"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Accion = "marcar_leido" | "responder"

type Body = {
  id?: number
  accion?: Accion
  cuerpo?: string
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const id = Number(body.id)
    const accion = body.accion

    if (!id || !accion) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios (id o accion)." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    if (accion === "marcar_leido") {
      const { error } = await supabase
        .from("comunicacion_recibidos")
        .update({ leido: true })
        .eq("id", id)

      if (error) {
        return NextResponse.json(
          { error: "No se pudo marcar como leído.", detalle: error },
          { status: 500 }
        )
      }

      return NextResponse.json({ ok: true, id, accion })
    }

    if (accion === "responder") {
      const cuerpo = String(body.cuerpo || "").trim()

      if (!cuerpo) {
        return NextResponse.json(
          { error: "Falta el contenido de la respuesta." },
          { status: 400 }
        )
      }

      const { data: recibido, error: fetchError } = await supabase
        .from("comunicacion_recibidos")
        .select("remitente_email, remitente_nombre, asunto")
        .eq("id", id)
        .single()

      if (fetchError || !recibido?.remitente_email) {
        return NextResponse.json(
          { error: "No se encontró el email recibido.", detalle: fetchError },
          { status: 404 }
        )
      }

      const asuntoOriginal = String(recibido.asunto || "").trim()
      const asuntoRespuesta = asuntoOriginal.toLowerCase().startsWith("re:")
        ? asuntoOriginal
        : `Re: ${asuntoOriginal || "tu mensaje"}`

      const envio = await enviarRespuestaEntheos({
        destinatarioEmail: recibido.remitente_email,
        destinatarioNombre: recibido.remitente_nombre,
        asunto: asuntoRespuesta,
        cuerpo,
      })

      if (!envio.resultado.enviado) {
        return NextResponse.json(
          { error: envio.resultado.motivo || "No se pudo enviar la respuesta." },
          { status: 502 }
        )
      }

      const { error: updateError } = await supabase
        .from("comunicacion_recibidos")
        .update({ respondido: true, leido: true })
        .eq("id", id)

      if (updateError) {
        return NextResponse.json(
          {
            error:
              "La respuesta se envió, pero no se pudo actualizar el estado.",
            detalle: updateError,
          },
          { status: 500 }
        )
      }

      return NextResponse.json({ ok: true, id, accion })
    }

    return NextResponse.json({ error: "Acción inválida." }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno ejecutando la acción sobre el email recibido.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
