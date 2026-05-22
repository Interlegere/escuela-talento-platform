const MEET_PLACEHOLDER_PATH = "/new"

export function normalizarMeetLink(meetLink?: string | null) {
  const raw = String(meetLink || "").trim()
  if (!raw) return null

  const match = raw.match(
    /(?:https?:\/\/)?(?:www\.)?meet\.google\.com\/[^\s"'<>]+/i
  )
  if (!match) return null

  const candidate = match[0].replace(/^http:\/\//i, "https://")
  const absolute = /^https:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate.replace(/^www\./i, "")}`

  try {
    const url = new URL(absolute)
    const host = url.hostname.toLowerCase().replace(/^www\./, "")

    if (host !== "meet.google.com") return null

    url.protocol = "https:"
    url.hostname = "meet.google.com"

    if (url.pathname.toLowerCase() === MEET_PLACEHOLDER_PATH) {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

export function esMeetPlaceholder(meetLink?: string | null) {
  const raw = String(meetLink || "").trim()
  if (!raw) return false

  const normalizado = normalizarMeetLink(raw)
  if (normalizado) return false

  return /(?:https?:\/\/)?(?:www\.)?meet\.google\.com\/new(?:[/?#]|$)/i.test(raw)
}
