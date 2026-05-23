import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { enviarComunicacionIndividual } from "@/lib/comunicaciones"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  destinatarioEmail?: string
  asunto?: string
  html?: string
  texto?: string
  tipo?: string
  actividadSlug?: string
  plantillaClave?: string
}

function normalizarEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase()
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const body = (await req.json()) as Body
    const destinatarioEmail = normalizarEmail(body.destinatarioEmail)

    if (!destinatarioEmail) {
      return NextResponse.json(
        { error: "Falta destinatarioEmail." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const { data: usuario, error: usuarioError } = await supabase
      .from("usuarios_plataforma")
      .select("nombre, apellido, email")
      .eq("email", destinatarioEmail)
      .maybeSingle()

    if (usuarioError) {
      return NextResponse.json(
        { error: "No se pudo validar el destinatario.", detalle: usuarioError },
        { status: 500 }
      )
    }

    if (!usuario) {
      return NextResponse.json(
        { error: "No se encontró un usuario con ese email." },
        { status: 404 }
      )
    }

    const nombre = String(usuario.nombre || "").trim()
    const apellido = String(usuario.apellido || "").trim()
    const nombreCompleto = [nombre, apellido].filter(Boolean).join(" ")

    const envio = await enviarComunicacionIndividual({
      destinatarioEmail,
      destinatarioNombre: nombreCompleto || destinatarioEmail,
      asunto: String(body.asunto || "").trim(),
      html: body.html || null,
      texto: body.texto || null,
      tipo: body.tipo || "individual",
      actividadSlug: body.actividadSlug || null,
      plantillaClave: body.plantillaClave || null,
      variables: {
        nombre,
        apellido,
        nombre_completo: nombreCompleto,
        email: destinatarioEmail,
        actividad: body.actividadSlug || "",
      },
      metadata: {
        origen: "admin_comunicaciones_individual",
        enviadoPor: auth.actor.email,
      },
    })

    if (!envio.resultado.enviado) {
      return NextResponse.json(
        {
          ok: false,
          error: envio.resultado.motivo,
          registro: envio.registro,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      registro: envio.registro,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo enviar la comunicación.",
      },
      { status: 500 }
    )
  }
}
