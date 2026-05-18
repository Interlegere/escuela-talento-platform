import { NextResponse } from "next/server"
import {
  esErrorConfiguracionEspacios,
  resolverContextoEspacio,
} from "@/lib/espacios"
import { obtenerRangoDiaArgentinaUTC } from "@/lib/fechas"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  actividadSlug?: string
  participanteEmail?: string
  asunto?: string
  contenidoTexto?: string
  contenidoHtml?: string
  parentId?: number | null
  mensajeId?: number
}

function faltaColumnaActivo(error: unknown) {
  const err = error as { code?: string; message?: string }
  return err?.code === "42703" || String(err?.message || "").includes("activo")
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body

    if (!body.actividadSlug) {
      return NextResponse.json(
        { error: "Falta actividadSlug." },
        { status: 400 }
      )
    }

    const contexto = await resolverContextoEspacio({
      actividadSlug: body.actividadSlug,
      participanteEmail: body.participanteEmail,
    })

    if ("response" in contexto) {
      return contexto.response
    }

    const contenidoTexto = body.contenidoTexto?.trim() || ""
    const contenidoHtml = body.contenidoHtml?.trim() || ""
    const asunto = body.asunto?.trim() || ""
    const parentId = body.parentId ? Number(body.parentId) : null

    if (!contenidoTexto && !contenidoHtml) {
      return NextResponse.json(
        { error: "Escribí un mensaje antes de enviar." },
        { status: 400 }
      )
    }

    if (!parentId && !asunto) {
      return NextResponse.json(
        { error: "Escribí un asunto antes de enviar." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const espacio = contexto.espacio

    if (!espacio) {
      return NextResponse.json(
        { error: "No se encontró el espacio configurado." },
        { status: 404 }
      )
    }

    if (parentId) {
      let { data: parent, error: parentError } = await supabase
        .from("espacios_mensajes")
        .select("id")
        .eq("id", parentId)
        .eq("espacio_id", espacio.id)
        .eq("activo", true)
        .single()

      if (parentError && faltaColumnaActivo(parentError)) {
        const retry = await supabase
          .from("espacios_mensajes")
          .select("id")
          .eq("id", parentId)
          .eq("espacio_id", espacio.id)
          .single()

        parent = retry.data
        parentError = retry.error
      }

      if (parentError || !parent) {
        return NextResponse.json(
          { error: "No se encontró el mensaje que querés responder." },
          { status: 404 }
        )
      }
    }

    if (!contexto.esAdmin) {
      if (!parentId) {
        const { inicioUtc, finUtc } = obtenerRangoDiaArgentinaUTC()

        let { data: mensajesHoy, error: mensajesHoyError } = await supabase
          .from("espacios_mensajes")
          .select("id")
          .eq("espacio_id", espacio.id)
          .eq("autor_email", contexto.actor.email)
          .eq("activo", true)
          .gte("created_at", inicioUtc)
          .lte("created_at", finUtc)

        if (mensajesHoyError && faltaColumnaActivo(mensajesHoyError)) {
          const retry = await supabase
            .from("espacios_mensajes")
            .select("id")
            .eq("espacio_id", espacio.id)
            .eq("autor_email", contexto.actor.email)
            .gte("created_at", inicioUtc)
            .lte("created_at", finUtc)

          mensajesHoy = retry.data
          mensajesHoyError = retry.error
        }

        if (mensajesHoyError) {
          throw mensajesHoyError
        }

        if ((mensajesHoy || []).length > 0) {
          return NextResponse.json(
            { error: "Ya enviaste tu mensaje de hoy. Mañana podrás enviar otro." },
            { status: 400 }
          )
        }
      }
    }

    const { data, error } = await supabase
      .from("espacios_mensajes")
      .insert({
        espacio_id: espacio.id,
        parent_id: parentId,
        asunto: parentId ? null : asunto,
        autor_email: contexto.actor.email,
        autor_nombre: contexto.actor.name,
        autor_rol: contexto.actor.role,
        contenido_texto: contenidoTexto || null,
        contenido_html: contexto.esAdmin ? contenidoHtml || null : null,
      })
      .select("*")
      .single()

    if (error) {
      if (faltaColumnaActivo(error)) {
        return NextResponse.json(
          {
            error:
              "Falta aplicar la migración de soft delete de mensajes antes de eliminar.",
          },
          { status: 409 }
        )
      }

      throw error
    }

    return NextResponse.json({
      ok: true,
      mensaje: data,
    })
  } catch (error) {
    if (esErrorConfiguracionEspacios(error)) {
      return NextResponse.json(
        { error: "Falta configurar las tablas de espacios." },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: "No se pudo guardar el mensaje.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as Body

    if (!body.actividadSlug) {
      return NextResponse.json(
        { error: "Falta actividadSlug." },
        { status: 400 }
      )
    }

    const contexto = await resolverContextoEspacio({
      actividadSlug: body.actividadSlug,
      participanteEmail: body.participanteEmail,
    })

    if ("response" in contexto) {
      return contexto.response
    }

    if (!contexto.esAdmin) {
      return NextResponse.json(
        { error: "Solo admin puede eliminar mensajes." },
        { status: 403 }
      )
    }

    const mensajeId = Number(body.mensajeId)

    if (!mensajeId) {
      return NextResponse.json(
        { error: "Falta el mensaje a eliminar." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const espacio = contexto.espacio

    if (!espacio) {
      return NextResponse.json(
        { error: "No se encontró el espacio configurado." },
        { status: 404 }
      )
    }

    const { data, error } = await supabase
      .from("espacios_mensajes")
      .update({
        activo: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", mensajeId)
      .eq("espacio_id", espacio.id)
      .select("id")
      .maybeSingle()

    if (error) {
      if (faltaColumnaActivo(error)) {
        return NextResponse.json(
          {
            error:
              "Falta aplicar la migración de soft delete de mensajes antes de eliminar.",
          },
          { status: 409 }
        )
      }

      throw error
    }

    if (!data) {
      return NextResponse.json(
        { error: "No se encontró el mensaje a eliminar." },
        { status: 404 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (esErrorConfiguracionEspacios(error)) {
      return NextResponse.json(
        { error: "Falta configurar las tablas de espacios." },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: "No se pudo eliminar el mensaje.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
