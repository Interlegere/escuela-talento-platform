import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { normalizarDocumentosNotas } from "@/lib/documentos-notas"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type DisponibilidadInsert = {
  titulo: string
  tipo: string
  actividad_slug?: string | null
  modo: "disponibilidad" | "actividad_fija" | "bloqueo"
  fecha: string
  hora: string
  duracion: string
  meet_link: string
  requiere_pago: boolean
  precio: string
  estado: "disponible" | "pendiente_pago" | "confirmada"
  reservado_por?: string | null
  es_recurrente: boolean
  dia_semana?: string | null
  excepcion_fechas?: string | null
  google_event_id?: string | null
  google_calendar_id?: string | null
  sync_status?: string | null
  last_synced_at?: string | null
  participante_email?: string | null
  participante_nombre?: string | null
  notas_documentos?: unknown
}

type Body = {
  items: DisponibilidadInsert[]
}

class ValidationError extends Error {}

function esEncuentroIndividualFijo(item: DisponibilidadInsert) {
  return (
    item.modo === "actividad_fija" &&
    (item.actividad_slug === "mentorias" || item.actividad_slug === "terapia")
  )
}

function esGrupoConectandoFijo(item: DisponibilidadInsert) {
  return (
    item.modo === "actividad_fija" &&
    item.actividad_slug === "conectando-sentidos"
  )
}

function esErrorMigracionAgenda(error: unknown) {
  const err = error as { code?: string; message?: string }
  const mensaje = String(err?.message || "").toLowerCase()

  return (
    err?.code === "42703" ||
    mensaje.includes("could not find") ||
    mensaje.includes("schema cache") ||
    mensaje.includes("participante_email") ||
    mensaje.includes("participante_nombre") ||
    mensaje.includes("notas_documentos") ||
    mensaje.includes("sync_status")
  )
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("agenda.manage")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const items = Array.isArray(body.items) ? body.items : []

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No hay disponibilidades para crear." },
        { status: 400 }
      )
    }

    const clavesNuevas = new Set<string>()

    const itemsNormalizados = items.map((item) => {
      const participanteEmail = item.participante_email?.trim().toLowerCase() || null
      const participanteNombre = item.participante_nombre?.trim() || null
      const fecha = item.fecha?.trim() || ""
      const hora = item.hora?.trim() || ""
      const duracion = item.duracion?.trim() || ""
      const esEncuentroUnoAUno = esEncuentroIndividualFijo(item)
      const esConectandoGrupal = esGrupoConectandoFijo(item)

      if (esEncuentroUnoAUno && !participanteEmail) {
        throw new ValidationError(
          "Debes seleccionar un participante para crear una reunión o sesión fija de Mentoría/Terapia."
        )
      }

      if (esEncuentroUnoAUno && (!fecha || !hora || !duracion)) {
        throw new ValidationError(
          "Fecha, hora y duración son obligatorias para crear el encuentro individual."
        )
      }

      if (esConectandoGrupal && (!fecha || !hora)) {
        throw new ValidationError(
          "Fecha y hora son obligatorias para crear la sesión grupal de Conectando Sentidos."
        )
      }

      if (esEncuentroUnoAUno || esConectandoGrupal) {
        const clave = [
          item.actividad_slug,
          esEncuentroUnoAUno ? participanteEmail : "grupo",
          fecha,
          hora,
          item.modo,
        ].join("|")

        if (clavesNuevas.has(clave)) {
          throw new ValidationError(
            esConectandoGrupal
              ? "Ya hay una sesión grupal de Conectando Sentidos igual en esta solicitud. Revisá fecha y hora antes de crear."
              : "Ya hay un encuentro igual en esta solicitud. Revisá fecha y hora antes de crear."
          )
        }

        clavesNuevas.add(clave)
      }

      return {
        ...item,
        fecha,
        hora,
        duracion,
        meet_link: item.meet_link?.trim() || "",
        participante_email: esEncuentroUnoAUno ? participanteEmail : null,
        participante_nombre: esEncuentroUnoAUno ? participanteNombre : null,
        sync_status: esEncuentroUnoAUno
          ? item.sync_status?.trim() || "pendiente"
          : item.sync_status,
        notas_documentos: normalizarDocumentosNotas(item.notas_documentos),
      }
    })

    const supabase = createAdminSupabaseClient()

    for (const item of itemsNormalizados) {
      if (!esEncuentroIndividualFijo(item) && !esGrupoConectandoFijo(item)) {
        continue
      }

      let consultaExistente = supabase
        .from("disponibilidades")
        .select("id")
        .eq("actividad_slug", item.actividad_slug)
        .eq("fecha", item.fecha)
        .eq("hora", item.hora)
        .eq("modo", item.modo)

      if (esEncuentroIndividualFijo(item)) {
        consultaExistente = consultaExistente.eq(
          "participante_email",
          item.participante_email
        )
      }

      const { data: existente, error: existenteError } =
        await consultaExistente.maybeSingle()

      if (existenteError) {
        if (esErrorMigracionAgenda(existenteError)) {
          return NextResponse.json(
            {
              error:
                "Falta aplicar la migración de agenda para encuentros individuales.",
              detalle: existenteError.message,
            },
            { status: 409 }
          )
        }

        return NextResponse.json(
          {
            error: "No se pudo validar si el encuentro ya existe.",
            detalle: existenteError.message,
          },
          { status: 500 }
        )
      }

      if (existente) {
        return NextResponse.json(
          {
            error: esGrupoConectandoFijo(item)
              ? "Ya existe una sesión grupal de Conectando Sentidos para esa fecha y hora."
              : "Ya existe un encuentro individual para esa actividad, participante, fecha y hora.",
          },
          { status: 409 }
        )
      }
    }

    const { data, error } = await supabase
      .from("disponibilidades")
      .insert(itemsNormalizados)
      .select("*")

    if (error || !data) {
      if (error && esErrorMigracionAgenda(error)) {
        return NextResponse.json(
          {
            error:
              "Falta aplicar la migración de agenda para encuentros individuales.",
            detalle: error.message,
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        {
          error: "No se pudieron crear las disponibilidades.",
          detalle: error,
        },
        { status: 500 }
      )
    }

    if (data.length !== itemsNormalizados.length) {
      return NextResponse.json(
        {
          error:
            "La agenda no confirmó la creación de todos los encuentros solicitados.",
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      items: data,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      {
        error: "Error interno creando disponibilidades",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
