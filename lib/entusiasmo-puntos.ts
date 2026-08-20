import { obtenerFechaISOArgentina } from "@/lib/fechas"
import { enviarComunicacionIndividual } from "@/lib/comunicaciones"
import { listarParticipantesActividad } from "@/lib/espacios"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type SupabaseAdminClient = ReturnType<typeof createAdminSupabaseClient>

export const PUNTOS_POR_CATEGORIA: Record<string, number> = {
  coordenadas: 1,
  tareas: 1,
  pitch: 1.5,
  produccion: 1,
  produccion_compartida: 0.5,
}

// Acumulativo desde el día 1 del mes, sin resetear entre checkpoints.
export const UMBRALES_REUNION_EXTRA = [20, 40]

const ADMIN_EMAIL = process.env.MAIL_REPLY_TO || "nicolasbusico@entheosescuela.com"

function esViolacionUnicidad(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
  )
}

// Inserta un evento de puntos si no rompe el tope correspondiente (1 por
// día para las categorías con tope diario, 1 por producción para el bonus
// de CoFruto). Si ya existía, no hace nada — no tira error, es el
// comportamiento esperado ("ya lo ganó hoy").
export async function otorgarPuntoSiCorresponde(
  supabase: SupabaseAdminClient,
  params: {
    participanteEmail: string
    categoria: string
    produccionId?: number
    fecha?: string
  }
) {
  const fecha = params.fecha || obtenerFechaISOArgentina()
  const puntos = PUNTOS_POR_CATEGORIA[params.categoria] ?? 0

  const { error } = await supabase.from("entusiasmo_puntos_eventos").insert({
    participante_email: params.participanteEmail,
    categoria: params.categoria,
    puntos,
    fecha,
    produccion_id: params.produccionId ?? null,
  })

  if (error && !esViolacionUnicidad(error)) {
    // No queremos que un fallo al puntuar tumbe la acción real (guardar
    // coordenadas, completar una tarea, etc.) — se ignora en silencio,
    // en el peor caso no suma el punto esta vez.
    console.warn("No se pudo otorgar punto de Entusiasmento:", error)
  }

  await verificarYNotificarUmbrales(supabase)
}

// Señal cruda (0 puntos) de que se completó una tarea hoy — sin tope
// diario, para poder contar cuántas se completaron. Devuelve cuántas
// señales hay hoy para ese participante (incluida la recién insertada).
async function registrarSenalTareaCompletada(
  supabase: SupabaseAdminClient,
  participanteEmail: string,
  fecha: string
) {
  await supabase.from("entusiasmo_puntos_eventos").insert({
    participante_email: participanteEmail,
    categoria: "tarea_completada_senal",
    puntos: 0,
    fecha,
  })

  const { count } = await supabase
    .from("entusiasmo_puntos_eventos")
    .select("id", { count: "exact", head: true })
    .eq("participante_email", participanteEmail)
    .eq("categoria", "tarea_completada_senal")
    .eq("fecha", fecha)

  return count || 0
}

// Regla de "tareas": crear una tarea, o editar fecha/hora/prioridad, o
// completar 2 o más en el día — cualquiera de esas otorga el único punto
// diario de esta categoría (evita que un solo tilde accidental cuente).
export async function otorgarPuntoTareaSiCorresponde(
  supabase: SupabaseAdminClient,
  participanteEmail: string,
  motivo: "creada" | "editada" | "completada"
) {
  const fecha = obtenerFechaISOArgentina()

  if (motivo === "completada") {
    const completadasHoy = await registrarSenalTareaCompletada(
      supabase,
      participanteEmail,
      fecha
    )

    if (completadasHoy < 2) {
      return
    }
  }

  await otorgarPuntoSiCorresponde(supabase, {
    participanteEmail,
    categoria: "tareas",
    fecha,
  })
}

export async function calcularPuntosDelMes(supabase: SupabaseAdminClient) {
  const hoy = obtenerFechaISOArgentina()
  const inicioMes = `${hoy.slice(0, 7)}-01`

  const { data, error } = await supabase
    .from("entusiasmo_puntos_eventos")
    .select("participante_email, puntos")
    .gte("fecha", inicioMes)
    .lte("fecha", hoy)
    .gt("puntos", 0)

  if (error) {
    throw error
  }

  const porParticipante = new Map<string, number>()
  let total = 0

  for (const fila of data || []) {
    const puntos = Number(fila.puntos) || 0
    total += puntos
    porParticipante.set(
      fila.participante_email,
      (porParticipante.get(fila.participante_email) || 0) + puntos
    )
  }

  const participantes = await listarParticipantesActividad("casatalentos")
  const nombresPorEmail = new Map(
    participantes.map((p) => [p.email?.trim().toLowerCase(), p.nombre])
  )

  const desglose = Array.from(porParticipante.entries())
    .map(([email, puntos]) => ({
      email,
      nombre: nombresPorEmail.get(email) || email,
      puntos: Math.round(puntos * 10) / 10,
    }))
    .sort((a, b) => b.puntos - a.puntos)

  const umbrales = UMBRALES_REUNION_EXTRA.map((umbral) => ({
    umbral,
    alcanzado: total >= umbral,
  }))

  const proximoUmbral = umbrales.find((u) => !u.alcanzado)?.umbral || null

  return {
    total: Math.round(total * 10) / 10,
    mes: hoy.slice(0, 7),
    umbrales,
    proximoUmbral,
    porcentajeHaciaProximo: proximoUmbral
      ? Math.min(100, Math.round((total / proximoUmbral) * 100))
      : 100,
    desglose,
  }
}

async function verificarYNotificarUmbrales(supabase: SupabaseAdminClient) {
  try {
    const { total, mes } = await calcularPuntosDelMes(supabase)

    for (const umbral of UMBRALES_REUNION_EXTRA) {
      if (total < umbral) continue

      const { error } = await supabase
        .from("entusiasmo_puntos_notificaciones")
        .insert({ mes, umbral })

      if (error) {
        // Ya notificado (choque de unicidad) u otro error — en cualquier
        // caso no se manda mail de nuevo.
        continue
      }

      await enviarComunicacionIndividual({
        destinatarioEmail: ADMIN_EMAIL,
        asunto: `Entusiasmento: se desbloqueó una reunión extra (${umbral} pts)`,
        texto: `El grupo de Entusiasmento llegó a ${umbral} puntos este mes — ya se puede agendar la reunión extra correspondiente desde /agenda.`,
        tipo: "entusiasmo_reunion_desbloqueada",
      })
    }
  } catch (error) {
    console.warn("No se pudo verificar/notificar umbrales de Entusiasmento:", error)
  }
}
