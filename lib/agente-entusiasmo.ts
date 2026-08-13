import { generarConHerramientaIA } from "@/lib/ai"
import { enviarComunicacionIndividual } from "@/lib/comunicaciones"
import { esDiaDeEnvioHoy } from "@/lib/agente-entusiasmo-calendario"
import { tieneAccesoEntusiasmento } from "@/lib/entusiasmo-acceso"
import { obtenerFechaISOArgentina } from "@/lib/fechas"
import { listarParticipantesActividad } from "@/lib/espacios"
import { obtenerFraseOraculoDelDia } from "@/lib/oraculo"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const DIAS_SEMANA_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

// Cuentas de prueba/staff — nunca son destinatarios reales del agente,
// sin importar qué diga su inscripción en la base.
const EMAILS_EXCLUIDOS_SIEMPRE = [
  "admin@escuela.com",
  "colaborador@escuela.com",
  "participante@escuela.com",
  "interlegerensa@gmail.com",
]

const INFORME_DESTINATARIO_EMAIL = "nicolasbusico@entheosescuela.com"
const INFORME_DESTINATARIO_NOMBRE = "Nicolás"

type ProyectoRow = {
  id: number
  que_te_entusiasma: string | null
  para_que: string | null
}

type TareaRow = {
  id: number
  contenido: string
  completada: boolean
  fecha: string | null
  hora: string | null
}

type TipoCaso = "con_fecha" | "sin_fecha" | "sin_tareas" | "decision"

type ResultadoParticipante = {
  email: string
  nombre: string
  estado: "enviado" | "omitido"
  tipoCaso: TipoCaso | null
  textoGenerado: string | null
  motivoOmision: string | null
}

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "")
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function textoAHtml(texto: string) {
  return escapeHtml(texto)
    .split("\n")
    .filter((linea) => linea.trim())
    .map((linea) => `<p style="margin:0 0 12px;">${linea}</p>`)
    .join("")
}

function formatearFechaHoraTarea(fecha: string | null, hora: string | null) {
  if (!fecha) return hora ? hora.slice(0, 5) : ""

  const [anio, mes, dia] = fecha.split("-").map(Number)
  const fechaUTC = new Date(Date.UTC(anio, mes - 1, dia))
  const diaSemana = DIAS_SEMANA_CORTO[fechaUTC.getUTCDay()]
  const fechaTexto = `${diaSemana} ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`

  return hora ? `${fechaTexto} · ${hora.slice(0, 5)}` : fechaTexto
}

// system prompt de tono — diseñado y aprobado por Nicolás. No modificar sin
// su ok explícito; ver CLAUDE.md para el historial de por qué llegó a esta
// versión (2 intentos previos descartados por sonar "de policía").
const SYSTEM_PROMPT = `Sos la voz de acompañamiento de Entusiasmento, el espacio de entrenamiento y producción de la escuela ENTHEOS. Escribís una sola frase o pregunta breve por semana para cada participante.

No sos un asistente, un coach ni un profesor. Sonás como alguien del lugar que pasa, ve en qué anda la persona y le tira una línea al pasar.

=== FORMATO ===
- Una sola frase. Dos como máximo, y sólo si la segunda es muy corta.
- Español rioplatense, voseo siempre (avanzá, decís, tenés, podrías).
- Podés usar signos de exclamación. El tono es cálido y directo, nunca solemne ni místico.

=== LAS CINCO REGLAS DE TONO ===

1. El "no" tiene que ser una respuesta válida.
   Nunca escribas una pregunta cuyas respuestas posibles sean todas "sí, ya empiezo". Si la persona puede contestar "esta semana no", la frase está bien.
   SÍ: "¿Sigue siendo tu prioridad?"
   NO: "¿Por cuál arrancás hoy?"

2. Mirá la tarea, no la agenda de la persona.
   Preguntá por la tarea (cuánto lleva, qué implica, qué la acerca al objetivo), nunca por el momento en que la persona se va a sentar a hacerla. Pedir un horario es pedir cuentas.
   SÍ: "¿Cuánto tiempo podría llevarte?"
   NO: "¿Cuándo te sentás a hacerlo?"

3. No enumeres ni repitas datos.
   Nunca listes las tareas pendientes, ni las cuentes, ni menciones fechas límite. El sistema ya se las muestra aparte. Repetirlas suena a vigilancia.
   NO: "Tenés dos cosas esta semana: X y los 2 reels para el viernes."

4. Anclá en lo que la persona quiere, no en lo que debe.
   Remití a su objetivo, su proyecto, lo que dijo querer. Nunca uses "tenés pendiente", "te falta", "todavía no".

5. Nunca digas cómo hacerlo.
   Prohibido cualquier consejo de método, técnica u organización ("bloqueate un rato", "empezá por lo más fácil", "dividilo en pasos"). La persona resuelve el cómo; vos solo acompañás.

6. No repitas.
   Vas a recibir las últimas 3-4 frases enviadas a esta misma persona. No repitas su estructura, ni su forma de arrancar, ni la idea central. Si las anteriores fueron preguntas, probá una afirmación. Variá.

=== CASO ESPECIAL: DECISIONES ===
Si lo pendiente no es una tarea de avance sino una decisión real (cambiar de rumbo, elegir entre caminos, algo que la persona viene trabando), no empujes a avanzar. Sugerí que lo hable con Nicolás o que lo lleve a su próximo encuentro. No opines sobre la decisión.

=== VOCABULARIO ===
Usá: talento, entusiasmo, momento, transitar, proceso, vuelta, espiral, mejor versión, Lugar Propio, decisiones, apropiación, entrenamiento, producción, crecimiento, escucha, desafío, espacio, comunidad.

Evitá: nivel, etapa, graduarse, "pasar al siguiente nivel", "desbloquear tu potencial", "reencontrar tu verdadero yo", el éxito como cima, y todo lenguaje de jerarquía entre personas.

=== LÍMITES ===
- Nunca te presentes como IA ni menciones que sos un sistema.
- Nunca inventes datos, tareas, fechas ni logros.
- Nunca reemplaces el vínculo con Nicolás: cuando hay una duda real de contenido, derivá.

=== NOTA SOBRE LOS DATOS QUE RECIBÍS ===
Si te pasan información de tareas, usala sólo para elegir el tipo de frase (con fecha / sin fecha / sin tareas / decisión). No la repitas en el texto.

=== SALIDA ===
Llamá a la herramienta "generar_recordatorio" con:
- es_decision_real: true solo si lo pendiente es una decisión real (ver caso especial arriba), false si es una tarea de avance normal o si no hay tareas cargadas.
- texto: el texto final siguiendo todas las reglas de arriba.`

function armarPromptUsuario(params: {
  nombre: string
  queTeEntusiasma: string | null
  paraQue: string | null
  tareasPendientes: TareaRow[]
  fraseUltimas: string[]
}) {
  const lineas = [
    `Nombre: ${params.nombre}`,
    `Qué le entusiasma (si lo cargó): ${params.queTeEntusiasma || "no lo cargó todavía"}`,
    `Para qué trabaja en esto (si lo cargó): ${params.paraQue || "no lo cargó todavía"}`,
  ]

  if (params.tareasPendientes.length > 0) {
    lineas.push(
      "Tareas pendientes esta semana (uso interno, no las repitas ni las cuentes):",
      ...params.tareasPendientes.map(
        (t) =>
          `- ${t.contenido}${t.fecha ? ` (${formatearFechaHoraTarea(t.fecha, t.hora)})` : ""}`
      )
    )
  } else {
    lineas.push("Tareas pendientes esta semana: no cargó ninguna todavía.")
  }

  if (params.fraseUltimas.length > 0) {
    lineas.push(
      "",
      "Últimas frases ya enviadas a esta persona (no repitas estructura, arranque ni idea central):",
      ...params.fraseUltimas.map((f) => `- "${f}"`)
    )
  }

  lineas.push(
    "",
    "Generá el recordatorio de esta semana llamando a la herramienta generar_recordatorio."
  )

  return lineas.join("\n")
}

const HERRAMIENTA_SCHEMA = {
  es_decision_real: {
    type: "boolean",
    description:
      "true si lo pendiente es una decisión real que no debe empujarse a avanzar, false en cualquier otro caso.",
  },
  texto: {
    type: "string",
    description: "El texto final del recordatorio, siguiendo todas las reglas del system prompt.",
  },
}

function crearHtmlRecordatorioEntusiasmo(params: {
  nombre: string
  fraseOraculo: string
  reflexion: string
}) {
  return `
    <div style="margin:0;padding:32px 16px;background:#f6efe2;font-family:Arial,sans-serif;color:#1f2933;">
      <div style="max-width:640px;margin:0 auto;background:#fffdf8;border:1px solid #eadfc9;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(77,54,18,0.08);">
        <div style="padding:30px 32px 20px;background:linear-gradient(135deg, rgba(250,244,229,1) 0%, rgba(255,250,240,1) 55%, rgba(248,237,210,1) 100%);">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#8a6a2f;font-weight:700;">ENTHEOS · Entusiasmento</p>
          <h1 style="margin:0 0 10px;font-size:28px;line-height:1.15;color:#18202a;">Tu semana en Entusiasmento</h1>
          <p style="margin:0;color:#6b7280;font-size:16px;">Hola ${escapeHtml(params.nombre)},</p>
        </div>
        <div style="padding:28px 32px 32px;line-height:1.7;">
          <p style="margin:0 0 16px;font-style:italic;color:#8a6a2f;">✦ ${escapeHtml(params.fraseOraculo)}</p>
          ${textoAHtml(params.reflexion)}
          <p style="text-align:center;margin:24px 0 0;">
            <a href="${appUrl()}/casatalentos" style="display:inline-block;padding:12px 28px;background:#cf9130;color:#fffdf8;border-radius:999px;text-decoration:none;font-weight:700;">Ir a Entusiasmento</a>
          </p>
          <p style="margin:20px 0 0;font-size:14px;color:#6b7280;">Si tenés una duda real, mejor hablarlo directo con Nicolás — este mensaje es solo para acompañarte.</p>
          <p style="margin:18px 0 0;">Equipo Entheos</p>
        </div>
      </div>
    </div>
  `
}

async function procesarParticipante(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  participante: { email: string; nombre: string }
): Promise<ResultadoParticipante> {
  const base = { email: participante.email, nombre: participante.nombre }

  if (!tieneAccesoEntusiasmento(participante.email, false)) {
    return {
      ...base,
      estado: "omitido",
      tipoCaso: null,
      textoGenerado: null,
      motivoOmision: "sin_acceso_habilitado",
    }
  }

  const { data: proyecto } = await supabase
    .from("entusiasmo_proyectos")
    .select("id, que_te_entusiasma, para_que")
    .eq("participante_email", participante.email)
    .maybeSingle<ProyectoRow>()

  const { data: tareas } = proyecto
    ? await supabase
        .from("entusiasmo_tareas")
        .select("id, contenido, completada, fecha, hora")
        .eq("proyecto_id", proyecto.id)
    : { data: [] as TareaRow[] }

  const tareasPendientes = ((tareas as TareaRow[]) || []).filter((t) => !t.completada)

  const casoBase: TipoCaso =
    tareasPendientes.length === 0
      ? "sin_tareas"
      : tareasPendientes.some((t) => t.fecha)
        ? "con_fecha"
        : "sin_fecha"

  const { data: enviosPrevios } = await supabase
    .from("entusiasmo_agente_mensajes")
    .select("texto_generado")
    .eq("participante_email", participante.email)
    .eq("estado", "enviado")
    .order("fecha", { ascending: false })
    .limit(4)

  const fraseUltimas = ((enviosPrevios as Array<{ texto_generado: string }> | null) || [])
    .map((item) => item.texto_generado)
    .filter(Boolean)

  const fraseOraculo = obtenerFraseOraculoDelDia(participante.email)

  let salida: { es_decision_real: boolean; texto: string }

  try {
    salida = await generarConHerramientaIA<{ es_decision_real: boolean; texto: string }>({
      system: SYSTEM_PROMPT,
      prompt: armarPromptUsuario({
        nombre: participante.nombre,
        queTeEntusiasma: proyecto?.que_te_entusiasma || null,
        paraQue: proyecto?.para_que || null,
        tareasPendientes,
        fraseUltimas,
      }),
      herramientaNombre: "generar_recordatorio",
      herramientaDescripcion: "Genera el recordatorio semanal para el participante.",
      inputSchema: HERRAMIENTA_SCHEMA,
      maxTokens: 300,
    })
  } catch (error) {
    return {
      ...base,
      estado: "omitido",
      tipoCaso: null,
      textoGenerado: null,
      motivoOmision: `error_generando_texto: ${String(error)}`,
    }
  }

  const tipoCaso: TipoCaso = salida.es_decision_real ? "decision" : casoBase

  if (proyecto) {
    await supabase
      .from("entusiasmo_proyectos")
      .update({
        agente_recordatorio_texto: salida.texto,
        agente_recordatorio_generado_at: new Date().toISOString(),
      })
      .eq("id", proyecto.id)
  }

  const html = crearHtmlRecordatorioEntusiasmo({
    nombre: participante.nombre,
    fraseOraculo,
    reflexion: salida.texto,
  })

  try {
    const { resultado } = await enviarComunicacionIndividual({
      destinatarioEmail: participante.email,
      destinatarioNombre: participante.nombre,
      asunto: "Tu semana en Entusiasmento",
      html,
      texto: salida.texto,
      tipo: "agente_recordatorio_semanal",
      actividadSlug: "casatalentos",
    })

    if (!resultado.enviado) {
      return {
        ...base,
        estado: "omitido",
        tipoCaso,
        textoGenerado: salida.texto,
        motivoOmision: `error_enviando_mail: ${resultado.motivo}`,
      }
    }

    return {
      ...base,
      estado: "enviado",
      tipoCaso,
      textoGenerado: salida.texto,
      motivoOmision: null,
    }
  } catch (error) {
    return {
      ...base,
      estado: "omitido",
      tipoCaso,
      textoGenerado: salida.texto,
      motivoOmision: `error_enviando_mail: ${String(error)}`,
    }
  }
}

function crearHtmlInformeDiario(params: {
  fecha: string
  esDiaDeEnvio: boolean
  resultados: ResultadoParticipante[]
  duracionMs: number
}) {
  if (!params.esDiaDeEnvio) {
    return `<p>Hoy (${params.fecha}) no correspondía enviar recordatorios de Entusiasmento — no es día de envío según el calendario alternado.</p>`
  }

  const enviados = params.resultados.filter((r) => r.estado === "enviado")
  const omitidos = params.resultados.filter((r) => r.estado === "omitido")

  const filasEnviados = enviados
    .map(
      (r) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.nombre)} (${escapeHtml(r.email)})</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.tipoCaso || "")}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.textoGenerado || "")}</td>
        </tr>`
    )
    .join("")

  const filasOmitidos = omitidos
    .map(
      (r) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.nombre)} (${escapeHtml(r.email)})</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.motivoOmision || "")}</td>
        </tr>`
    )
    .join("")

  return `
    <p>Corrida del ${params.fecha} — ${enviados.length} enviados, ${omitidos.length} omitidos (${Math.round(params.duracionMs / 1000)}s).</p>
    <h3>Enviados</h3>
    <table style="border-collapse:collapse;width:100%;">
      <tr><th style="text-align:left;padding:8px;">Participante</th><th style="text-align:left;padding:8px;">Tipo</th><th style="text-align:left;padding:8px;">Texto</th></tr>
      ${filasEnviados || '<tr><td style="padding:8px;">(ninguno)</td></tr>'}
    </table>
    <h3>Omitidos</h3>
    <table style="border-collapse:collapse;width:100%;">
      <tr><th style="text-align:left;padding:8px;">Participante</th><th style="text-align:left;padding:8px;">Motivo</th></tr>
      ${filasOmitidos || '<tr><td style="padding:8px;">(ninguno)</td></tr>'}
    </table>
  `
}

async function enviarInformeDiario(params: {
  fecha: string
  esDiaDeEnvio: boolean
  resultados: ResultadoParticipante[]
  duracionMs: number
}) {
  const html = crearHtmlInformeDiario(params)

  await enviarComunicacionIndividual({
    destinatarioEmail: INFORME_DESTINATARIO_EMAIL,
    destinatarioNombre: INFORME_DESTINATARIO_NOMBRE,
    asunto: params.esDiaDeEnvio
      ? `Agente Entusiasmento — ${params.fecha}: ${params.resultados.filter((r) => r.estado === "enviado").length} enviados`
      : `Agente Entusiasmento — ${params.fecha}: sin envíos hoy`,
    html,
    texto: html.replace(/<[^>]+>/g, " "),
    tipo: "agente_informe_diario",
  })
}

export async function ejecutarAgenteEntusiasmoDiario() {
  const inicio = Date.now()
  const fechaISO = obtenerFechaISOArgentina()
  const esDiaDeEnvio = esDiaDeEnvioHoy(fechaISO)

  if (!esDiaDeEnvio) {
    await enviarInformeDiario({ fecha: fechaISO, esDiaDeEnvio, resultados: [], duracionMs: Date.now() - inicio })
    return { fecha: fechaISO, esDiaDeEnvio, enviados: 0, omitidos: 0, resultados: [] }
  }

  const supabase = createAdminSupabaseClient()
  const participantesRoster = await listarParticipantesActividad("casatalentos")
  const participantes = participantesRoster.filter(
    (p) => !EMAILS_EXCLUIDOS_SIEMPRE.includes(p.email.toLowerCase())
  )

  const resultados: ResultadoParticipante[] = []

  for (const participante of participantes) {
    const resultado = await procesarParticipante(supabase, {
      email: participante.email,
      nombre: participante.nombre || participante.email,
    })
    resultados.push(resultado)

    await supabase.from("entusiasmo_agente_mensajes").insert({
      participante_email: resultado.email,
      fecha: fechaISO,
      tipo_caso: resultado.tipoCaso,
      texto_generado: resultado.textoGenerado,
      estado: resultado.estado,
      motivo_omision: resultado.motivoOmision,
    })
  }

  const duracionMs = Date.now() - inicio

  await enviarInformeDiario({ fecha: fechaISO, esDiaDeEnvio, resultados, duracionMs })

  return {
    fecha: fechaISO,
    esDiaDeEnvio,
    enviados: resultados.filter((r) => r.estado === "enviado").length,
    omitidos: resultados.filter((r) => r.estado === "omitido").length,
    duracionMs,
    resultados,
  }
}
