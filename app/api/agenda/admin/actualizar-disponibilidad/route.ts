import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { ESTADOS_DISPONIBILIDAD_ACTIVA } from "@/lib/disponibilidades"
import { normalizarDocumentosNotas } from "@/lib/documentos-notas"
import { normalizarMeetLink } from "@/lib/meet-links"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  disponibilidadId?: number
  titulo?: string
  fecha?: string
  hora?: string
  duracion?: string
  notas_documentos?: unknown
  meet_link?: string
  modoActualizacion?: "editar" | "meet_manual" | "cancelar"
  alcance?: "solo_este" | "serie_futura"
}

type DisponibilidadAgenda = {
  id: number
  titulo?: string | null
  actividad_slug?: string | null
  modo?: string | null
  fecha?: string | null
  hora?: string | null
  duracion?: string | null
  meet_link?: string | null
  estado?: string | null
  serie_id?: string | null
  participante_email?: string | null
}

function meetLinkReal(meetLink?: string | null) {
  return normalizarMeetLink(meetLink)
}

function esErrorMigracionSerie(error: unknown) {
  const err = error as { code?: string; message?: string }
  const mensaje = String(err?.message || "").toLowerCase()

  return (
    err?.code === "42703" ||
    mensaje.includes("serie_id") ||
    mensaje.includes("schema cache")
  )
}

function parseFechaLocal(fecha: string) {
  const [anio, mes, dia] = fecha.split("-").map(Number)
  return new Date(anio, (mes || 1) - 1, dia || 1)
}

function formatearFechaIso(fecha: Date) {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, "0")
  const dia = String(fecha.getDate()).padStart(2, "0")
  return `${anio}-${mes}-${dia}`
}

function sumarDias(fechaIso: string, dias: number) {
  const fecha = parseFechaLocal(fechaIso)
  fecha.setDate(fecha.getDate() + dias)
  return formatearFechaIso(fecha)
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("agenda.manage")

    if ("response" in auth) {
      return auth.response
    }

    const body = (await req.json()) as Body
    const disponibilidadId = Number(body.disponibilidadId)
    const modoActualizacion = body.modoActualizacion || "editar"
    const alcance = body.alcance || "solo_este"

    if (!disponibilidadId) {
      return NextResponse.json(
        { error: "Falta disponibilidadId." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: disponibilidad, error: disponibilidadError } = await supabase
      .from("disponibilidades")
      .select("*")
      .eq("id", disponibilidadId)
      .single()

    if (disponibilidadError || !disponibilidad) {
      if (disponibilidadError && esErrorMigracionSerie(disponibilidadError)) {
        return NextResponse.json(
          {
            error:
              "Falta aplicar la migración de serie_id en disponibilidades.",
            detalle: disponibilidadError.message,
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: "No se encontró el encuentro." },
        { status: 404 }
      )
    }

    const disponibilidadBase = disponibilidad as DisponibilidadAgenda
    let disponibilidadesObjetivo: DisponibilidadAgenda[] = [disponibilidadBase]

    if (alcance === "serie_futura") {
      if (!disponibilidadBase.serie_id) {
        return NextResponse.json(
          {
            error:
              "Esta programación no tiene identificador de serie. Sólo se puede modificar este encuentro.",
          },
          { status: 409 }
        )
      }

      const hoyIso = formatearFechaIso(new Date())
      const fechaInicioSerie =
        String(disponibilidadBase.fecha || "") < hoyIso
          ? hoyIso
          : disponibilidadBase.fecha || hoyIso

      const { data: serie, error: serieError } = await supabase
        .from("disponibilidades")
        .select("*")
        .eq("serie_id", disponibilidadBase.serie_id)
        .gte("fecha", fechaInicioSerie)
        .in("estado", ESTADOS_DISPONIBILIDAD_ACTIVA)
        .order("fecha", { ascending: true })
        .order("hora", { ascending: true })

      if (serieError) {
        if (esErrorMigracionSerie(serieError)) {
          return NextResponse.json(
            {
              error:
                "Falta aplicar la migración de serie_id en disponibilidades.",
              detalle: serieError.message,
            },
            { status: 409 }
          )
        }

        return NextResponse.json(
          {
            error: "No se pudo cargar la serie futura.",
            detalle: serieError,
          },
          { status: 500 }
        )
      }

      disponibilidadesObjetivo = (serie || []) as DisponibilidadAgenda[]

      if (disponibilidadesObjetivo.length === 0) {
        return NextResponse.json(
          { error: "No hay encuentros futuros activos en esta serie." },
          { status: 404 }
        )
      }
    }

    const idsObjetivo = disponibilidadesObjetivo.map((item) => item.id)

    const { data: reservas, error: reservasError } = await supabase
      .from("reservas")
      .select("id")
      .in("disponibilidad_id", idsObjetivo)
      .limit(1)

    if (reservasError) {
      return NextResponse.json(
        {
          error: "No se pudo validar si el encuentro tiene reservas.",
          detalle: reservasError,
        },
        { status: 500 }
      )
    }

    const tieneReservas = (reservas || []).length > 0

    if (modoActualizacion === "cancelar") {
      if (tieneReservas) {
        return NextResponse.json(
          {
            error:
              "No se puede cancelar desde Agenda un encuentro con reservas asociadas.",
          },
          { status: 409 }
        )
      }

      const { data, error } = await supabase
        .from("disponibilidades")
        .update({
          estado: "cancelada",
          sync_status: "pendiente",
        })
        .in("id", idsObjetivo)
        .select("*")

      if (error || !data) {
        return NextResponse.json(
          {
            error: "No se pudo cancelar el encuentro.",
            detalle: error,
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ok: true,
        disponibilidad: data[0] || null,
        disponibilidades: data,
        afectados: data.length,
      })
    } else if (modoActualizacion === "meet_manual") {
      const meetLink = meetLinkReal(body.meet_link)

      if (!meetLink) {
        return NextResponse.json(
          { error: "Pegá un Meet real. No se acepta https://meet.google.com/new." },
          { status: 400 }
        )
      }

      const { data, error } = await supabase
        .from("disponibilidades")
        .update({
          meet_link: meetLink,
          sync_status: "manual",
          last_synced_at: new Date().toISOString(),
        })
        .in("id", idsObjetivo)
        .select("*")

      if (error || !data) {
        return NextResponse.json(
          {
            error: "No se pudo guardar el Meet manual.",
            detalle: error,
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ok: true,
        disponibilidad: data[0] || null,
        disponibilidades: data,
        afectados: data.length,
      })
    }

    const titulo = String(body.titulo ?? disponibilidadBase.titulo ?? "").trim()
    const fecha = String(body.fecha ?? disponibilidadBase.fecha ?? "").trim()
    const hora = String(body.hora ?? disponibilidadBase.hora ?? "").trim()
    const duracion = String(body.duracion ?? disponibilidadBase.duracion ?? "").trim()
    const meetLinkEditado = body.meet_link?.trim()
      ? meetLinkReal(body.meet_link)
      : null

    if (body.meet_link?.trim() && !meetLinkEditado) {
      return NextResponse.json(
        { error: "Pegá un Meet real. No se acepta https://meet.google.com/new." },
        { status: 400 }
      )
    }

    if (!titulo || !fecha || !hora || !duracion) {
      return NextResponse.json(
        { error: "Título, fecha, hora y duración son obligatorios." },
        { status: 400 }
      )
    }

    const fechaBase = disponibilidadBase.fecha || fecha
    const diferenciaDias = Math.round(
      (parseFechaLocal(fecha).getTime() - parseFechaLocal(fechaBase).getTime()) /
        86400000
    )

    const actualizaciones = disponibilidadesObjetivo.map((item) => {
      const fechaDestino =
        alcance === "serie_futura" && diferenciaDias !== 0 && item.fecha
          ? sumarDias(item.fecha, diferenciaDias)
          : item.id === disponibilidadBase.id
            ? fecha
            : item.fecha || fecha

      const cambiaEncuentro =
        titulo !== (item.titulo || "") ||
        fechaDestino !== item.fecha ||
        hora !== item.hora ||
        duracion !== item.duracion
      const cambiaMeetManual =
        Boolean(meetLinkEditado) && meetLinkEditado !== meetLinkReal(item.meet_link)

      const update: Record<string, unknown> = {
        titulo,
        fecha: fechaDestino,
        hora,
        duracion,
      }

      if (body.notas_documentos !== undefined) {
        update.notas_documentos = normalizarDocumentosNotas(body.notas_documentos)
      }

      if (cambiaMeetManual && meetLinkEditado) {
        update.meet_link = meetLinkEditado
        update.sync_status = "manual"
        update.last_synced_at = new Date().toISOString()
      } else if (cambiaEncuentro) {
        update.sync_status = "pendiente"
      }

      return {
        item,
        update,
        fechaDestino,
      }
    })

    for (const actualizacion of actualizaciones) {
      let consultaDuplicado = supabase
        .from("disponibilidades")
        .select("id")
        .eq("actividad_slug", actualizacion.item.actividad_slug)
        .eq("modo", actualizacion.item.modo)
        .eq("fecha", actualizacion.fechaDestino)
        .eq("hora", hora)
        .not("id", "in", `(${idsObjetivo.join(",")})`)
        .in("estado", ESTADOS_DISPONIBILIDAD_ACTIVA)
        .limit(1)

      if (actualizacion.item.participante_email) {
        consultaDuplicado = consultaDuplicado.eq(
          "participante_email",
          actualizacion.item.participante_email
        )
      }

      const { data: duplicados, error: duplicadoError } = await consultaDuplicado

      if (duplicadoError) {
        return NextResponse.json(
          {
            error: "No se pudo validar si el cambio genera duplicados.",
            detalle: duplicadoError,
          },
          { status: 500 }
        )
      }

      if ((duplicados || []).length > 0) {
        return NextResponse.json(
          {
            error:
              "Ya existe otro encuentro con la misma actividad, fecha, hora y participante.",
          },
          { status: 409 }
        )
      }
    }

    const resultados: unknown[] = []

    for (const actualizacion of actualizaciones) {
      const { data, error } = await supabase
        .from("disponibilidades")
        .update(actualizacion.update)
        .eq("id", actualizacion.item.id)
        .select("*")
        .single()

      if (error || !data) {
        return NextResponse.json(
          {
            error: "No se pudo actualizar el encuentro.",
            detalle: error,
          },
          { status: 500 }
        )
      }

      resultados.push(data)
    }

    return NextResponse.json({
      ok: true,
      disponibilidad: resultados[0] || null,
      disponibilidades: resultados,
      afectados: resultados.length,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno actualizando encuentro.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
