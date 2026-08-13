const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
const ANTHROPIC_VERSION = "2023-06-01"
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"

type GenerarTextoParams = {
  system: string
  prompt: string
  maxTokens?: number
}

export async function generarTextoIA(params: GenerarTextoParams) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no configurada.")
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: params.maxTokens || 500,
      system: params.system,
      messages: [{ role: "user", content: params.prompt }],
    }),
  })

  if (!res.ok) {
    const detalle = await res.text().catch(() => "")
    throw new Error(`Error llamando a la API de Anthropic (${res.status}): ${detalle}`)
  }

  const data = await res.json()
  const bloque = Array.isArray(data?.content)
    ? data.content.find((item: { type?: string }) => item?.type === "text")
    : null
  const texto = bloque?.text

  if (!texto || typeof texto !== "string") {
    throw new Error("La API de Anthropic no devolvió contenido de texto.")
  }

  return texto.trim()
}

type GenerarConHerramientaParams = {
  system: string
  prompt: string
  herramientaNombre: string
  herramientaDescripcion: string
  // JSON Schema de las properties del input de la herramienta.
  inputSchema: Record<string, unknown>
  maxTokens?: number
}

// Fuerza al modelo a responder con un objeto que cumple `inputSchema`, en
// vez de texto libre — más confiable que pedirle "respondé en JSON" y
// parsear a mano (evita que envuelva la respuesta en markdown, agregue
// comentarios, etc.).
export async function generarConHerramientaIA<T = Record<string, unknown>>(
  params: GenerarConHerramientaParams
): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no configurada.")
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: params.maxTokens || 500,
      system: params.system,
      messages: [{ role: "user", content: params.prompt }],
      tools: [
        {
          name: params.herramientaNombre,
          description: params.herramientaDescripcion,
          input_schema: {
            type: "object",
            properties: params.inputSchema,
            required: Object.keys(params.inputSchema),
          },
        },
      ],
      tool_choice: { type: "tool", name: params.herramientaNombre },
    }),
  })

  if (!res.ok) {
    const detalle = await res.text().catch(() => "")
    throw new Error(`Error llamando a la API de Anthropic (${res.status}): ${detalle}`)
  }

  const data = await res.json()
  const bloque = Array.isArray(data?.content)
    ? data.content.find((item: { type?: string }) => item?.type === "tool_use")
    : null

  if (!bloque?.input) {
    throw new Error("La API de Anthropic no devolvió una respuesta estructurada.")
  }

  return bloque.input as T
}
