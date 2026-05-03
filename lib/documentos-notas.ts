export type DocumentoNota = {
  titulo: string
  url: string
}

function esUrlValida(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

export function normalizarDocumentosNotas(input: unknown): DocumentoNota[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null
      }

      const record = item as Record<string, unknown>
      const url = String(record.url || "").trim()

      if (!url || !esUrlValida(url)) {
        return null
      }

      const titulo =
        String(record.titulo || "").trim() || `Documento ${index + 1}`

      return { titulo, url }
    })
    .filter((item): item is DocumentoNota => Boolean(item))
}

export function parsearDocumentosNotasDesdeTexto(texto: string): DocumentoNota[] {
  return texto
    .split("\n")
    .map((linea, index) => {
      const limpia = linea.trim()

      if (!limpia) {
        return null
      }

      const separador = limpia.includes("|") ? "|" : limpia.includes(",") ? "," : null
      const [tituloRaw, urlRaw] = separador
        ? limpia.split(separador).map((parte) => parte.trim())
        : [`Documento ${index + 1}`, limpia]
      const url = urlRaw || tituloRaw
      const titulo = separador ? tituloRaw : `Documento ${index + 1}`

      if (!esUrlValida(url)) {
        return null
      }

      return {
        titulo: titulo || `Documento ${index + 1}`,
        url,
      }
    })
    .filter((item): item is DocumentoNota => Boolean(item))
}

export function serializarDocumentosNotas(documentos: unknown) {
  return normalizarDocumentosNotas(documentos)
    .map((documento) => `${documento.titulo} | ${documento.url}`)
    .join("\n")
}
