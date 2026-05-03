import { NextResponse } from "next/server"
import {
  esErrorConfiguracionEspacios,
  resolverContextoEspacio,
} from "@/lib/espacios"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  actividadSlug?: string
  participanteEmail?: string
  actividadDestinoSlug?: "casatalentos" | "conectando-sentidos"
  habilitado?: boolean
  nota?: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body

    if (
      (body.actividadSlug !== "mentorias" && body.actividadSlug !== "terapia") ||
      !body.actividadDestinoSlug
    ) {
      return NextResponse.json(
        { error: "Acción no válida para accesos extra." },
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
        { error: "No tenés permisos para modificar accesos." },
        { status: 403 }
      )
    }

    const espacio = contexto.espacio

    if (!espacio) {
      return NextResponse.json(
        { error: "No se encontró el espacio configurado." },
        { status: 404 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: existente } = await supabase
      .from("espacios_accesos_extra")
      .select("*")
      .eq("espacio_id", espacio.id)
      .eq("actividad_destino_slug", body.actividadDestinoSlug)
      .maybeSingle()

    if (existente) {
      const { data, error } = await supabase
        .from("espacios_accesos_extra")
        .update({
          habilitado: body.habilitado === true,
          nota: body.nota?.trim() || null,
        })
        .eq("id", existente.id)
        .select("*")
        .single()

      if (error) {
        throw error
      }

      return NextResponse.json({
        ok: true,
        acceso: data,
      })
    }

    const { data, error } = await supabase
      .from("espacios_accesos_extra")
      .insert({
        espacio_id: espacio.id,
        actividad_destino_slug: body.actividadDestinoSlug,
        habilitado: body.habilitado === true,
        nota: body.nota?.trim() || null,
      })
      .select("*")
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      ok: true,
      acceso: data,
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
        error: "No se pudo guardar el acceso.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
