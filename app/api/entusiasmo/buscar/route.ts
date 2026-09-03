import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { generarTextoIA } from "@/lib/ai"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

// Mismas 10 columnas que CAMPOS_COORDENADAS en app/casatalentos/page.tsx.
// Duplicado a propósito acá (un lookup chico, sin ninguna lógica) — este
// route handler corre en el servidor y no puede importar nada de esa
// página de cliente.
const CAMPOS_COORDENADAS: Array<{ campo: string; columna: string; etiqueta: string }> = [
  { campo: "nombre", columna: "nombre", etiqueta: "Nombre del proyecto" },
  { campo: "que", columna: "que", etiqueta: "¿Qué es? Definición." },
  { campo: "paraQue", columna: "para_que", etiqueta: "¿Para qué sirve?" },
  { campo: "problemaSolucion", columna: "problema_solucion", etiqueta: "Problema y solución" },
  {
    campo: "habilidadADesarrollar",
    columna: "habilidad_a_desarrollar",
    etiqueta: "Talento a desarrollar",
  },
  { campo: "queTeEntusiasma", columna: "que_te_entusiasma", etiqueta: "¿Qué te entusiasma?" },
  { campo: "queTeFrena", columna: "que_te_frena", etiqueta: "¿Qué te frena?" },
  { campo: "resultadoMensual", columna: "resultado_mensual", etiqueta: "Resultado mensual" },
  { campo: "resultadoTrimestral", columna: "resultado_trimestral", etiqueta: "Resultado trimestral" },
  { campo: "resultadoAnual", columna: "resultado_anual", etiqueta: "Resultado anual" },
]

type TipoCita = "coordenada" | "tarea" | "produccion" | "aporte"

type Cita = {
  tipo: TipoCita
  id: number | null
  campo: string | null
  etiqueta: string
  fragmento: string
}

type RespuestaIA = {
  respuesta: string
  citas: Cita[]
}

type Body = {
  pregunta?: string
  participanteEmail?: string
}

// generarTextoIA devuelve texto libre, no garantiza JSON válido (a
// diferencia de generarConHerramientaIA) — el system prompt pide JSON
// puro, pero igual se limpian bloques de código markdown por si el
// modelo los agrega, y se intenta extraer el primer objeto {...} como
// último recurso.
function extraerJson(texto: string): unknown {
  const limpio = texto
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim()

  try {
    return JSON.parse(limpio)
  } catch {
    const match = limpio.match(/\{[\s\S]*\}/)
    if (!match) return null

    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const pregunta = String(body.pregunta || "").trim()

    if (!pregunta) {
      return NextResponse.json({ error: "Falta la pregunta." }, { status: 400 })
    }

    const emailConsultado = body.participanteEmail?.trim().toLowerCase()
    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")

    // Mismo chequeo que /api/entusiasmo/aportes, tal cual: nunca los datos
    // de otra persona salvo que quien pregunta sea admin.
    if (emailConsultado && emailConsultado !== auth.actor.email && !esAdmin) {
      return NextResponse.json(
        { error: "No podés buscar en los datos de otra persona." },
        { status: 403 }
      )
    }

    const emailObjetivo = emailConsultado || auth.actor.email
    const supabase = createAdminSupabaseClient()

    const { data: proyecto } = await supabase
      .from("entusiasmo_proyectos")
      .select(
        "id, nombre, que, para_que, problema_solucion, habilidad_a_desarrollar, que_te_entusiasma, que_te_frena, resultado_mensual, resultado_trimestral, resultado_anual"
      )
      .eq("participante_email", emailObjetivo)
      .maybeSingle<Record<string, string | number | null>>()

    const proyectoId = proyecto?.id as number | undefined

    let versiones: Array<{ campo: string; contenido: string }> = []
    let tareas: Array<{
      id: number
      contenido: string
      fecha: string | null
      hora: string | null
      completada: boolean
    }> = []
    let producciones: Array<{
      id: number
      titulo: string | null
      contenido: string | null
      categoria: string | null
      tipo: string
    }> = []
    let aportes: Array<{
      id: number
      contenido: string
      campo: string | null
      autor_nombre: string | null
      autor_email: string | null
      created_at: string
    }> = []

    // Las 4 consultas son independientes entre sí — corren en simultáneo.
    // Solo se disparan si la persona ya tiene proyecto (si no, todo queda
    // vacío y el modelo va a decir que no encontró nada, correctamente).
    if (proyectoId) {
      const [versionesRes, tareasRes, produccionesRes, aportesRes] = await Promise.all([
        supabase
          .from("entusiasmo_coordenadas_versiones")
          .select("campo, contenido, created_at")
          .eq("proyecto_id", proyectoId)
          .order("created_at", { ascending: false }),
        supabase
          .from("entusiasmo_tareas")
          .select("id, contenido, fecha, hora, completada")
          .eq("proyecto_id", proyectoId),
        supabase
          .from("entusiasmo_producciones")
          .select("id, titulo, contenido, categoria, tipo")
          .eq("proyecto_id", proyectoId),
        supabase
          .from("entusiasmo_aportes")
          .select("id, contenido, campo, autor_nombre, autor_email, created_at")
          .eq("proyecto_id", proyectoId),
      ])

      versiones = (versionesRes.data as typeof versiones) || []
      tareas = (tareasRes.data as typeof tareas) || []
      producciones = (produccionesRes.data as typeof producciones) || []
      aportes = (aportesRes.data as typeof aportes) || []
    }

    // --- Armado del bloque de datos que se le pasa al modelo ---
    const bloqueCoordenadas = CAMPOS_COORDENADAS.map(({ campo, columna, etiqueta }) => {
      const valorActual = proyecto ? (proyecto[columna] as string | null) : null
      const versionesDelCampo = versiones.filter((v) => v.campo === columna)
      let texto = `[coordenada campo="${campo}"] ${etiqueta}\nTexto vigente: ${
        valorActual && valorActual.trim() ? valorActual : "(vacío)"
      }`

      if (versionesDelCampo.length > 0) {
        texto += `\nVersiones anteriores de este mismo campo:\n${versionesDelCampo
          .map((v, i) => `  (${i + 1}) ${v.contenido}`)
          .join("\n")}`
      }

      return texto
    }).join("\n\n")

    const bloqueTareas =
      tareas.length === 0
        ? "(sin tareas cargadas)"
        : tareas
            .map(
              (t) =>
                `[tarea id=${t.id}] fecha=${t.fecha || "sin fecha"} hora=${
                  t.hora || "sin hora"
                } completada=${t.completada}\n${t.contenido}`
            )
            .join("\n\n")

    const bloqueProducciones =
      producciones.length === 0
        ? "(sin producciones)"
        : producciones
            .map(
              (p) =>
                `[produccion id=${p.id}] tipo=${p.tipo} categoria=${
                  p.categoria || "sin categoría"
                } titulo="${p.titulo || "sin título"}"\n${
                  p.contenido || "(sin contenido de texto)"
                }`
            )
            .join("\n\n")

    const bloqueAportes =
      aportes.length === 0
        ? "(sin aportes recibidos)"
        : aportes
            .map(
              (a) =>
                `[aporte id=${a.id}] de ${
                  a.autor_nombre || a.autor_email || "alguien"
                } el ${a.created_at.slice(0, 10)}${
                  a.campo ? ` (sobre campo="${a.campo}")` : ""
                }\n${a.contenido}`
            )
            .join("\n\n")

    const datosTexto = [
      `=== COORDENADAS DEL PROYECTO ===\n${bloqueCoordenadas}`,
      `=== TAREAS ===\n${bloqueTareas}`,
      `=== PRODUCCIONES ===\n${bloqueProducciones}`,
      `=== APORTES RECIBIDOS (comentarios que le dejaron) ===\n${bloqueAportes}`,
    ].join("\n\n")

    const system = `Sos un buscador interno de Entusiasmento (ENTHEOS). Tu única función es encontrar y mostrar información que YA existe en los datos de esta persona — nunca inventás, interpretás ni aconsejás.

Reglas, sin excepción:
1. Respondé ÚNICAMENTE con información que aparece textualmente en los datos entregados más abajo. Si no encontrás nada relacionado con la pregunta, respondé exactamente: "No encontré nada sobre eso en tu espacio." y dejá "citas" como un array vacío.
2. No interpretás el proceso de la persona, no aconsejás sobre su proyecto, no opinás sobre su trabajo. Solo ordenás y encontrás lo que ya escribió.
3. Si la pregunta pide una decisión o una interpretación (por ejemplo "¿debería...?", "¿qué pienso de...?", "¿está bien que...?"), respondé que eso lo tiene que conversar con Nicolás — no lo resolvés vos.
4. Siempre citás de dónde sacaste cada cosa que mencionás, usando exactamente los identificadores ([coordenada campo="..."], [tarea id=...], [produccion id=...], [aporte id=...]) tal como aparecen en los datos — nunca inventes un id o un campo que no esté ahí.
5. Respondé SIEMPRE con un único objeto JSON válido, sin texto antes ni después, sin bloques de código markdown, con esta forma exacta:
{"respuesta": "texto breve en español, tono simple y directo", "citas": [{"tipo": "coordenada" | "tarea" | "produccion" | "aporte", "id": number o null (null solo para coordenada), "campo": string o null (solo para coordenada, si no null), "etiqueta": "texto corto para mostrar en una tarjetita", "fragmento": "cita textual exacta, copiada literal de los datos, no parafraseada"}]}

Datos de esta persona (nunca hay datos de nadie más acá):
${datosTexto}`

    let resultado: RespuestaIA

    try {
      const textoIA = await generarTextoIA({
        system,
        prompt: pregunta,
        maxTokens: 1200,
      })

      const parseado = extraerJson(textoIA) as Partial<RespuestaIA> | null

      if (!parseado || typeof parseado.respuesta !== "string") {
        throw new Error("Respuesta del modelo no tiene el formato esperado.")
      }

      // Nunca confiar ciegamente en que el modelo citó un id/campo real —
      // se descarta cualquier cita que no corresponda a algo que
      // efectivamente se le pasó como dato de esta persona.
      const idsValidos = {
        tarea: new Set(tareas.map((t) => t.id)),
        produccion: new Set(producciones.map((p) => p.id)),
        aporte: new Set(aportes.map((a) => a.id)),
      }
      const camposValidos = new Set(CAMPOS_COORDENADAS.map((c) => c.campo))

      const citas = Array.isArray(parseado.citas)
        ? parseado.citas.filter((cita): cita is Cita => {
            if (!cita || typeof cita !== "object") return false
            const c = cita as Cita

            if (c.tipo === "coordenada") return Boolean(c.campo && camposValidos.has(c.campo))
            if (c.tipo === "tarea") return typeof c.id === "number" && idsValidos.tarea.has(c.id)
            if (c.tipo === "produccion")
              return typeof c.id === "number" && idsValidos.produccion.has(c.id)
            if (c.tipo === "aporte")
              return typeof c.id === "number" && idsValidos.aporte.has(c.id)

            return false
          })
        : []

      resultado = { respuesta: parseado.respuesta, citas }
    } catch (errorIA) {
      console.warn("No se pudo generar/parsear la respuesta del buscador:", errorIA)
      resultado = {
        respuesta: "No pude buscar en este momento. Probá de nuevo en un rato.",
        citas: [],
      }
    }

    // Se guarda siempre (incluso si falló la IA) para poder ver después
    // si se usa y para qué — nunca debe tumbar la respuesta al usuario.
    const { error: errorRegistro } = await supabase.from("entusiasmo_busquedas").insert({
      participante_email: emailObjetivo,
      pregunta,
      respuesta: resultado.respuesta,
    })

    if (errorRegistro) {
      console.warn("No se pudo registrar la búsqueda:", errorRegistro)
    }

    return NextResponse.json({ ok: true, ...resultado })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno en el buscador.", detalle: String(error) },
      { status: 500 }
    )
  }
}
