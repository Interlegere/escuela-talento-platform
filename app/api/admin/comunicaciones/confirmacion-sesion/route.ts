import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { enviarConfirmacionSesionIndividual } from "@/lib/comunicaciones"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  disponibilidadId?: number
}

type DisponibilidadSesion = {
  id: number
  actividad_slug?: string | null
  fecha?: string | null
  hora?: string | null
  duracion?: string | number | null
  meet_link?: string | null
  participante_email?: string | null
  participante_nombre?: string | null
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("agenda.manage")

    if ("response" in auth) {
      return auth.response
    }

    const body = (await req.json()) as Body
    const disponibilidadId = Number(body.disponibilidadId)

    if (!disponibilidadId) {
      return NextResponse.json(
        { error: "Falta disponibilidadId." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from("disponibilidades")
      .select(
        "id, actividad_slug, fecha, hora, duracion, meet_link, participante_email, participante_nombre"
      )
      .eq("id", disponibilidadId)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: "No se encontró la sesión para confirmar por mail." },
        { status: 404 }
      )
    }

    const disponibilidad = data as DisponibilidadSesion
    const actividadSlug = disponibilidad.actividad_slug

    if (actividadSlug !== "mentorias" && actividadSlug !== "terapia") {
      return NextResponse.json(
        { error: "La confirmación de sesión sólo aplica a Mentorías y Terapia." },
        { status: 400 }
      )
    }

    if (!disponibilidad.participante_email) {
      return NextResponse.json(
        { error: "La sesión no tiene email de participante." },
        { status: 400 }
      )
    }

    if (!disponibilidad.fecha || !disponibilidad.hora) {
      return NextResponse.json(
        { error: "La sesión no tiene fecha u hora configurada." },
        { status: 400 }
      )
    }

    const envio = await enviarConfirmacionSesionIndividual({
      disponibilidadId: disponibilidad.id,
      destinatarioEmail: disponibilidad.participante_email,
      destinatarioNombre: disponibilidad.participante_nombre || null,
      actividadSlug,
      fecha: disponibilidad.fecha,
      hora: disponibilidad.hora,
      duracion: disponibilidad.duracion || "60",
      meetLink: disponibilidad.meet_link || null,
    })

    if (!envio.resultado.enviado) {
      return NextResponse.json(
        {
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
            : "No se pudo enviar la confirmación de sesión.",
      },
      { status: 500 }
    )
  }
}
