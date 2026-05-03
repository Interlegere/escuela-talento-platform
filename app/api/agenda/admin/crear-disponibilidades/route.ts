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

    const itemsNormalizados = items.map((item) => {
      const participanteEmail = item.participante_email?.trim().toLowerCase() || null
      const participanteNombre = item.participante_nombre?.trim() || null
      const esEncuentroUnoAUno =
        item.modo === "actividad_fija" &&
        (item.actividad_slug === "mentorias" || item.actividad_slug === "terapia")

      if (esEncuentroUnoAUno && !participanteEmail) {
        throw new Error(
          "Debes seleccionar un participante para crear una reunión o sesión fija de Mentoría/Terapia."
        )
      }

      return {
        ...item,
        participante_email: esEncuentroUnoAUno ? participanteEmail : null,
        participante_nombre: esEncuentroUnoAUno ? participanteNombre : null,
        notas_documentos: normalizarDocumentosNotas(item.notas_documentos),
      }
    })

    const supabase = createAdminSupabaseClient()

    const { data, error } = await supabase
      .from("disponibilidades")
      .insert(itemsNormalizados)
      .select("*")

    if (error || !data) {
      return NextResponse.json(
        {
          error: "No se pudieron crear las disponibilidades.",
          detalle: error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      items: data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno creando disponibilidades",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
