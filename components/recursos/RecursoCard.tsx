"use client"

import type { ReactNode } from "react"
import VideoEmbed from "@/components/VideoEmbed"

type Props = {
  titulo: string
  descripcion?: string | null
  recursoTipo?: string | null
  url: string
  footer?: ReactNode
}

function normalizarTipo(recursoTipo?: string | null, url?: string) {
  const tipo = String(recursoTipo || "")
    .trim()
    .toLowerCase()

  if (tipo) {
    return tipo
  }

  if (esUrlImagen(url)) return "imagen"
  if (esUrlVideo(url)) return "video"
  return "enlace"
}

function esUrlImagen(url?: string | null) {
  return /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(String(url || ""))
}

function esUrlVideo(url?: string | null) {
  const value = String(url || "")
  return (
    /youtu\.?be/i.test(value) ||
    /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(value)
  )
}

function etiquetaTipo(recursoTipo?: string | null, url?: string) {
  switch (normalizarTipo(recursoTipo, url)) {
    case "video":
      return "Video"
    case "imagen":
      return "Imagen"
    case "archivo":
      return "Archivo"
    case "grabacion":
      return "Grabación"
    case "guia":
      return "Guía"
    default:
      return "Enlace"
  }
}

export default function RecursoCard({
  titulo,
  descripcion,
  recursoTipo,
  url,
  footer,
}: Props) {
  const tipo = normalizarTipo(recursoTipo, url)

  return (
    <div className="workspace-card-link !rounded-[1.4rem] !p-4 space-y-3">
      <div className="space-y-2">
        <p className="font-medium">{titulo}</p>

        {descripcion && (
          <p className="workspace-inline-note">{descripcion}</p>
        )}

        <p className="workspace-inline-note text-xs uppercase tracking-[0.12em]">
          Tipo: {etiquetaTipo(tipo, url)}
        </p>
      </div>

      {tipo === "video" && (
        <VideoEmbed
          src={url}
          title={titulo}
          className="aspect-video w-full rounded-2xl border border-[var(--line)] bg-black/5"
        />
      )}

      {tipo === "imagen" && (
        <img
          src={url}
          alt={titulo}
          className="max-h-[26rem] w-full rounded-2xl border border-[var(--line)] object-contain bg-[rgba(255,250,242,0.82)]"
        />
      )}

      <div className="flex flex-wrap gap-3">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="workspace-button-secondary"
        >
          {tipo === "archivo" ? "Abrir archivo" : "Abrir recurso"}
        </a>
      </div>

      {footer}
    </div>
  )
}
