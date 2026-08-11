"use client"

import { useEffect, useRef, useState } from "react"

type Props = {
  onAudioListo: (file: File | null) => void
  disabled?: boolean
  maxSegundos?: number
}

function obtenerMimeTypeSoportado() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return ""
  }

  const candidatos = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]

  for (const tipo of candidatos) {
    if (MediaRecorder.isTypeSupported(tipo)) {
      return tipo
    }
  }

  return ""
}

function extensionPorMimeType(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a"
  return "webm"
}

export default function GrabadorAudio({
  onAudioListo,
  disabled = false,
  maxSegundos = 300,
}: Props) {
  const [grabando, setGrabando] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [error, setError] = useState("")
  const [previewUrl, setPreviewUrl] = useState("")

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const intervaloRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutAutoStopRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (intervaloRef.current) clearInterval(intervaloRef.current)
      if (timeoutAutoStopRef.current) clearTimeout(timeoutAutoStopRef.current)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const detenerGrabacion = () => {
    mediaRecorderRef.current?.stop()
  }

  const iniciarGrabacion = async () => {
    setError("")
    onAudioListo(null)

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl("")
    }

    try {
      setPreparando(true)

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = obtenerMimeTypeSoportado()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const tipoFinal = recorder.mimeType || mimeType || "audio/webm"
        const blob = new Blob(chunksRef.current, { type: tipoFinal })
        const extension = extensionPorMimeType(tipoFinal)
        const file = new File([blob], `audio-${Date.now()}.${extension}`, { type: tipoFinal })

        setPreviewUrl(URL.createObjectURL(blob))
        onAudioListo(file)

        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setGrabando(false)

        if (intervaloRef.current) clearInterval(intervaloRef.current)
        if (timeoutAutoStopRef.current) clearTimeout(timeoutAutoStopRef.current)
      }

      recorder.start()
      setGrabando(true)
      setSegundos(0)

      intervaloRef.current = setInterval(() => {
        setSegundos((prev) => prev + 1)
      }, 1000)

      timeoutAutoStopRef.current = setTimeout(() => {
        detenerGrabacion()
      }, maxSegundos * 1000)
    } catch (err) {
      // Advertencia, no error: caso esperado cuando el navegador/SO deniega
      // el permiso de micrófono — ya queda manejado con el mensaje de abajo.
      console.warn("No se pudo abrir el micrófono:", err)
      setError(
        "No pudimos acceder al micrófono. Revisá los permisos del navegador para este sitio, o subí un archivo de audio ya grabado."
      )
    } finally {
      setPreparando(false)
    }
  }

  const formatearTiempo = (total: number) => {
    const minutos = Math.floor(total / 60)
    const segs = total % 60
    return `${minutos}:${String(segs).padStart(2, "0")}`
  }

  return (
    <div className="space-y-2">
      {!grabando ? (
        <button
          type="button"
          disabled={disabled || preparando}
          onClick={() => void iniciarGrabacion()}
          className="workspace-button-secondary"
        >
          {preparando ? "Preparando micrófono..." : "🎙️ Grabar audio"}
        </button>
      ) : (
        <button
          type="button"
          onClick={detenerGrabacion}
          className="workspace-button-primary"
        >
          ⏹️ Detener ({formatearTiempo(segundos)})
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {previewUrl && (
        <audio controls src={previewUrl} className="w-full">
          Tu navegador no soporta audio.
        </audio>
      )}
    </div>
  )
}
