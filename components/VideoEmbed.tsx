function obtenerYoutubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, "")

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v")
        return id ? `https://www.youtube.com/embed/${id}` : null
      }

      const parts = parsed.pathname.split("/").filter(Boolean)
      const embedIndex = parts.findIndex((part) => part === "embed")
      const shortsIndex = parts.findIndex((part) => part === "shorts")

      if (embedIndex >= 0 && parts[embedIndex + 1]) {
        return `https://www.youtube.com/embed/${parts[embedIndex + 1]}`
      }

      if (shortsIndex >= 0 && parts[shortsIndex + 1]) {
        return `https://www.youtube.com/embed/${parts[shortsIndex + 1]}`
      }
    }
  } catch {
    return null
  }

  return null
}

export default function VideoEmbed({
  src,
  title,
  className = "aspect-video w-full rounded-xl border",
}: {
  src: string
  title: string
  className?: string
}) {
  const youtubeEmbedUrl = obtenerYoutubeEmbedUrl(src)

  if (youtubeEmbedUrl) {
    return (
      <iframe
        className={className}
        src={youtubeEmbedUrl}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    )
  }

  return <video controls src={src} className={className} />
}
