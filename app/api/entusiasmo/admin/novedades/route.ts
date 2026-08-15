import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { listarParticipantesActividad } from "@/lib/espacios"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

// Una edición de coordenadas solo cuenta como "actividad nueva" si pasó un
// rato desde que se creó la fila (evita marcar como actividad la creación
// automática y vacía de un proyecto, ej. al recibir un aporte o al crear
// una producción antes de tener coordenadas propias).
const TOLERANCIA_CREACION_MS = 2000

export async function GET() {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return auth.response
    }

    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")

    if (!esAdmin) {
      return NextResponse.json(
        { error: "No tenés permisos para ver esto." },
        { status: 403 }
      )
    }

    const participantes = await listarParticipantesActividad("casatalentos")
    const emails = participantes
      .map((p) => p.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email))

    if (emails.length === 0) {
      return NextResponse.json({ ok: true, novedades: {} })
    }

    const supabase = createAdminSupabaseClient()

    const [{ data: proyectos }, { data: lecturas }] = await Promise.all([
      supabase
        .from("entusiasmo_proyectos")
        .select("id, participante_email, created_at, updated_at")
        .in("participante_email", emails),
      supabase
        .from("entusiasmo_lecturas")
        .select("participante_email, leido_at")
        .eq("lector_email", auth.actor.email)
        .in("participante_email", emails),
    ])

    const proyectosPorEmail = new Map(
      (proyectos || []).map((p) => [p.participante_email as string, p])
    )
    const proyectoIds = (proyectos || []).map((p) => p.id as number)

    const [{ data: producciones }, { data: tareas }] = await Promise.all([
      proyectoIds.length > 0
        ? supabase
            .from("entusiasmo_producciones")
            .select("proyecto_id, created_at")
            .in("proyecto_id", proyectoIds)
        : Promise.resolve({ data: [] as { proyecto_id: number; created_at: string }[] }),
      proyectoIds.length > 0
        ? supabase
            .from("entusiasmo_tareas")
            .select("proyecto_id, created_at")
            .in("proyecto_id", proyectoIds)
        : Promise.resolve({ data: [] as { proyecto_id: number; created_at: string }[] }),
    ])

    const ultimaFechaPorProyectoId = new Map<number, number>()
    const registrar = (proyectoId: number, fecha: string) => {
      const ts = new Date(fecha).getTime()
      const actual = ultimaFechaPorProyectoId.get(proyectoId)
      if (!actual || ts > actual) {
        ultimaFechaPorProyectoId.set(proyectoId, ts)
      }
    }

    for (const item of producciones || []) {
      registrar(item.proyecto_id as number, item.created_at as string)
    }
    for (const item of tareas || []) {
      registrar(item.proyecto_id as number, item.created_at as string)
    }

    const leidoAtPorEmail = new Map(
      (lecturas || []).map((l) => [
        l.participante_email as string,
        new Date(l.leido_at as string).getTime(),
      ])
    )

    const novedades: Record<string, boolean> = {}

    for (const email of emails) {
      const proyecto = proyectosPorEmail.get(email)
      let ultimaActividad: number | null = ultimaFechaPorProyectoId.get(proyecto?.id as number) || null

      if (proyecto?.updated_at && proyecto?.created_at) {
        const editado =
          new Date(proyecto.updated_at as string).getTime() -
            new Date(proyecto.created_at as string).getTime() >
          TOLERANCIA_CREACION_MS

        if (editado) {
          const ts = new Date(proyecto.updated_at as string).getTime()
          if (!ultimaActividad || ts > ultimaActividad) {
            ultimaActividad = ts
          }
        }
      }

      if (!ultimaActividad) {
        novedades[email] = false
        continue
      }

      const leidoAt = leidoAtPorEmail.get(email)
      novedades[email] = !leidoAt || ultimaActividad > leidoAt
    }

    return NextResponse.json({ ok: true, novedades })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno calculando novedades.", detalle: String(error) },
      { status: 500 }
    )
  }
}
