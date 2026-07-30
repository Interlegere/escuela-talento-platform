import { NextResponse } from "next/server"
import { verificarFirmaSvix } from "@/lib/webhooks"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

function normalizarEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase()
}

type EventoResendInbound = {
  type?: string
  data?: {
    email_id?: string
    from?: string
    to?: string[] | string
    subject?: string
  }
}

async function obtenerCuerpoCompleto(emailId: string, apiKey: string) {
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    throw new Error(`No se pudo obtener el email completo (status ${res.status})`)
  }

  const data = await res.json()

  return {
    texto: String(data.text || data.body_text || "") || null,
    html: String(data.html || data.body_html || "") || null,
  }
}

export async function POST(req: Request) {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET

    if (!webhookSecret) {
      return NextResponse.json(
        { error: "RESEND_WEBHOOK_SECRET no configurado" },
        { status: 500 }
      )
    }

    const payloadCrudo = await req.text()

    const firmaValida = verificarFirmaSvix(
      payloadCrudo,
      {
        svixId: req.headers.get("svix-id"),
        svixTimestamp: req.headers.get("svix-timestamp"),
        svixSignature: req.headers.get("svix-signature"),
      },
      webhookSecret
    )

    if (!firmaValida) {
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 })
    }

    const evento = JSON.parse(payloadCrudo) as EventoResendInbound

    if (evento.type !== "email.received" || !evento.data?.email_id) {
      return NextResponse.json({ ok: true, ignorado: true })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY no configurado" },
        { status: 500 }
      )
    }

    const emailId = evento.data.email_id
    const remitenteEmail = normalizarEmail(evento.data.from)
    const destinatarioEmail = Array.isArray(evento.data.to)
      ? normalizarEmail(evento.data.to[0])
      : normalizarEmail(evento.data.to)
    const asunto = evento.data.subject || null

    const { texto, html } = await obtenerCuerpoCompleto(emailId, apiKey)

    const supabase = createAdminSupabaseClient()

    let remitenteNombre: string | null = null
    let participanteEmailVinculado: string | null = null

    if (remitenteEmail) {
      const { data: usuario } = await supabase
        .from("usuarios_plataforma")
        .select("nombre, apellido, email")
        .eq("email", remitenteEmail)
        .maybeSingle()

      if (usuario) {
        remitenteNombre =
          [usuario.nombre, usuario.apellido].filter(Boolean).join(" ") || null
        participanteEmailVinculado = remitenteEmail
      } else {
        const { data: contacto, error: contactoError } = await supabase
          .from("comunicacion_contactos")
          .select("nombre, apellido, email")
          .eq("email", remitenteEmail)
          .maybeSingle()

        if (!contactoError && contacto) {
          remitenteNombre =
            [contacto.nombre, contacto.apellido].filter(Boolean).join(" ") ||
            null
          participanteEmailVinculado = remitenteEmail
        }
      }
    }

    // upsert por resend_email_id: Resend puede reintentar la entrega del
    // mismo webhook, y esto evita duplicar el email recibido si eso pasa.
    const { error: insertError } = await supabase
      .from("comunicacion_recibidos")
      .upsert(
        {
          resend_email_id: emailId,
          remitente_email: remitenteEmail || null,
          remitente_nombre: remitenteNombre,
          destinatario_email: destinatarioEmail || null,
          asunto,
          texto,
          html,
          participante_email_vinculado: participanteEmailVinculado,
          metadata: evento.data,
        },
        { onConflict: "resend_email_id" }
      )

    if (insertError) {
      return NextResponse.json(
        { error: "No se pudo guardar el email recibido", detalle: insertError },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno procesando el webhook de Resend",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
