type ContenidoRecurso = {
  descripcion?: string | null
  url?: string | null
  tieneArchivo?: boolean
}

function htmlATextoPlano(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function tieneContenidoRecurso({
  descripcion,
  url,
  tieneArchivo = false,
}: ContenidoRecurso) {
  if (tieneArchivo || String(url || "").trim()) return true

  const html = String(descripcion || "").trim()

  if (!html) return false

  const contieneContenidoEmbebido = /<(img|a|video|audio|iframe)\b/i.test(html)

  return contieneContenidoEmbebido || Boolean(htmlATextoPlano(html))
}
