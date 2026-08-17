import { listarParticipantesActividad } from "@/lib/espacios"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type SupabaseAdminClient = ReturnType<typeof createAdminSupabaseClient>

// Una edición de coordenadas solo cuenta como "actividad nueva" si pasó un
// rato desde que se creó la fila (evita marcar como actividad la creación
// automática y vacía de un proyecto, ej. al recibir un aporte o al crear
// una producción antes de tener coordenadas propias).
const TOLERANCIA_CREACION_MS = 2000

// Por cada participante activo de Entusiasmento, si avanzó algo (Coordenadas,
// Producciones o Tareas) desde la última vez que ese admin le vio el espacio.
export async function calcularNovedadesPorParticipante(
  supabase: SupabaseAdminClient,
  adminEmail: string
): Promise<Record<string, boolean>> {
  const participantes = await listarParticipantesActividad("casatalentos")
  const adminEmailNormalizado = adminEmail.trim().toLowerCase()
  const emails = participantes
    .map((p) => p.email?.trim().toLowerCase())
    // El admin nunca aparece como solapa de sí mismo (ve su propio espacio
    // en "Yo", no como participante a revisar) — si además está inscripto
    // como participante, excluirlo acá evita que quede un "hay novedades"
    // fantasma que nunca se puede apagar porque no hay ninguna solapa
    // donde marcarlo como leído.
    .filter(
      (email): email is string => Boolean(email) && email !== adminEmailNormalizado
    )

  if (emails.length === 0) {
    return {}
  }

  const [{ data: proyectos }, { data: lecturas }] = await Promise.all([
    supabase
      .from("entusiasmo_proyectos")
      .select("id, participante_email, created_at, updated_at")
      .in("participante_email", emails),
    supabase
      .from("entusiasmo_lecturas")
      .select("participante_email, leido_at")
      .eq("lector_email", adminEmail)
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
    let ultimaActividad: number | null =
      ultimaFechaPorProyectoId.get(proyecto?.id as number) || null

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

  return novedades
}

// Si la propia persona tiene aportes recibidos más nuevos que su última
// lectura registrada de su propio espacio.
export async function calcularHayAportesNuevos(
  supabase: SupabaseAdminClient,
  email: string
): Promise<boolean> {
  const { data: proyecto } = await supabase
    .from("entusiasmo_proyectos")
    .select("id")
    .eq("participante_email", email)
    .maybeSingle()

  if (!proyecto) {
    return false
  }

  const [{ data: aportes }, { data: lectura }] = await Promise.all([
    supabase
      .from("entusiasmo_aportes")
      .select("created_at")
      .eq("proyecto_id", proyecto.id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("entusiasmo_lecturas")
      .select("leido_at")
      .eq("lector_email", email)
      .eq("participante_email", email)
      .maybeSingle(),
  ])

  if (!aportes || aportes.length === 0) {
    return false
  }

  const leidoAt = lectura?.leido_at ? new Date(lectura.leido_at as string).getTime() : null
  const ultimoAporte = new Date(aportes[0].created_at as string).getTime()

  return !leidoAt || ultimoAporte > leidoAt
}
