"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type Props = {
  onVideoListo: (file: File | null) => void
  disabled?: boolean
  maxSegundos?: number
}

function obtenerMimeTypeSoportado() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return ""
  }

  const candidatos = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ]

  for (const tipo of candidatos) {
    if (MediaRecorder.isTypeSupported(tipo)) {
      return tipo
    }
  }

  return ""
}

function extensionPorMimeType(mimeType: string) {
  if (mimeType.includes("mp4")) return "mp4"
  return "webm"
}

export default function GrabadorVideo({
  onVideoListo,
  disabled = false,
  maxSegundos = 65,
}: Props) {
  const [modoSeleccionado, setModoSeleccionado] = useState<"ninguno" | "grabar" | "archivo">(
    "ninguno"
  )
  const [puedeUsarGrabacionDirecta, setPuedeUsarGrabacionDirecta] = useState(false)
  const [preparandoCamara, setPreparandoCamara] = useState(false)
  const [grabando, setGrabando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [error, setError] = useState("")
  const [previewGrabacionUrl, setPreviewGrabacionUrl] = useState("")
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null)
  const [usaFallbackCaptura, setUsaFallbackCaptura] = useState(false)
  const [motivoFallbackCaptura, setMotivoFallbackCaptura] = useState("")

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraCaptureInputRef = useRef<HTMLInputElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const intervaloRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutAutoStopRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const soportaMediaApi =
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      !!navigator.mediaDevices.getUserMedia &&
      typeof MediaRecorder !== "undefined"

    const entornoSeguro =
      typeof window !== "undefined" && window.isSecureContext

    const soporta = soportaMediaApi && entornoSeguro

    setPuedeUsarGrabacionDirecta(soporta)
    setUsaFallbackCaptura(!soporta)

    if (!soporta) {
      if (!soportaMediaApi) {
        setMotivoFallbackCaptura(
          "En este navegador la grabación integrada no está disponible todavía."
        )
      } else if (!entornoSeguro) {
        setMotivoFallbackCaptura(
          "En celular, la cámara integrada suele requerir HTTPS o acceso local seguro. Podés abrir la cámara del dispositivo y volver con el video listo."
        )
      } else {
        setMotivoFallbackCaptura(
          "Podés abrir la cámara del dispositivo y volver con el video listo."
        )
      }
    } else {
      setMotivoFallbackCaptura("")
    }
  }, [])

  useEffect(() => {
    return () => {
      cerrarCamara()
      limpiarTimers()
      if (previewGrabacionUrl) {
        URL.revokeObjectURL(previewGrabacionUrl)
      }
    }
  }, [previewGrabacionUrl])

  const textoTiempo = useMemo(() => {
    const mins = Math.floor(segundos / 60)
    const secs = segundos % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }, [segundos])

  const limpiarTimers = () => {
    if (intervaloRef.current) {
      clearInterval(intervaloRef.current)
      intervaloRef.current = null
    }

    if (timeoutAutoStopRef.current) {
      clearTimeout(timeoutAutoStopRef.current)
      timeoutAutoStopRef.current = null
    }
  }

  const cerrarCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const abrirCamara = async () => {
    setError("")

    if (!puedeUsarGrabacionDirecta) {
      setUsaFallbackCaptura(true)
      setError(motivoFallbackCaptura || "Podés abrir la cámara del dispositivo y volver con el video listo.")
      return
    }

    try {
      setPreparandoCamara(true)

      cerrarCamara()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
        },
        audio: true,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
    } catch (err) {
      console.error("Error abriendo cámara:", err)
      setUsaFallbackCaptura(true)
      setError(
        "No se pudo acceder a la cámara integrada. Podés abrir la cámara del dispositivo y volver con el video listo."
      )
    } finally {
      setPreparandoCamara(false)
    }
  }

  const iniciarGrabacion = async () => {
    setError("")

    if (!streamRef.current) {
      setError("Primero abrí la cámara.")
      return
    }

    try {
      const mimeType = obtenerMimeTypeSoportado()
      const recorder = mimeType
        ? new MediaRecorder(streamRef.current, { mimeType })
        : new MediaRecorder(streamRef.current)

      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        try {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "video/webm",
          })

          const extension = extensionPorMimeType(recorder.mimeType || "video/webm")
          const file = new File(
            [blob],
            `casatalentos-${Date.now()}.${extension}`,
            {
              type: recorder.mimeType || "video/webm",
            }
          )

          if (previewGrabacionUrl) {
            URL.revokeObjectURL(previewGrabacionUrl)
          }

          const nuevaUrl = URL.createObjectURL(blob)
          setPreviewGrabacionUrl(nuevaUrl)
          setArchivoSeleccionado(file)
          onVideoListo(file)
        } catch (err) {
          console.error("Error procesando grabación:", err)
          setError("No se pudo procesar la grabación.")
        } finally {
          setGrabando(false)
          limpiarTimers()
          cerrarCamara()
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start(250)

      setSegundos(0)
      setGrabando(true)

      intervaloRef.current = setInterval(() => {
        setSegundos((prev) => prev + 1)
      }, 1000)

      timeoutAutoStopRef.current = setTimeout(() => {
        detenerGrabacion()
      }, maxSegundos * 1000)
    } catch (err) {
      console.error("Error iniciando grabación:", err)
      setError("No se pudo iniciar la grabación.")
      setGrabando(false)
      limpiarTimers()
    }
  }

  const detenerGrabacion = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
      }
    } catch (err) {
      console.error("Error deteniendo grabación:", err)
      setError("No se pudo detener la grabación.")
      setGrabando(false)
      limpiarTimers()
      cerrarCamara()
    }
  }

  const limpiarVideoActual = () => {
    setError("")
    setArchivoSeleccionado(null)
    onVideoListo(null)

    if (previewGrabacionUrl) {
      URL.revokeObjectURL(previewGrabacionUrl)
      setPreviewGrabacionUrl("")
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    if (cameraCaptureInputRef.current) {
      cameraCaptureInputRef.current.value = ""
    }
  }

  const cambiarModo = (modo: "grabar" | "archivo") => {
    setError("")
    setModoSeleccionado(modo)

    if (modo === "archivo") {
      cerrarCamara()
      setPreparandoCamara(false)
      if (grabando) {
        detenerGrabacion()
      }
    }

    if (modo === "grabar") {
      setUsaFallbackCaptura(!puedeUsarGrabacionDirecta)
    }
  }

  const seleccionarArchivo = (file: File | null) => {
    setError("")

    if (!file) return

    if (!file.type.startsWith("video/")) {
      setError("El archivo debe ser un video.")
      return
    }

    if (previewGrabacionUrl) {
      URL.revokeObjectURL(previewGrabacionUrl)
    }

    const nuevaUrl = URL.createObjectURL(file)
    setPreviewGrabacionUrl(nuevaUrl)
    setArchivoSeleccionado(file)
    onVideoListo(file)
  }

  return (
    <div className="workspace-panel-soft space-y-4">
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="workspace-eyebrow">Preparación</p>
          <p className="text-lg font-semibold">Elegí cómo preparar tu video</p>
          <p className="workspace-inline-note">
            Elegí una opción para continuar.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => cambiarModo("grabar")}
            disabled={disabled}
            className={`rounded-xl border p-4 text-left transition ${
              modoSeleccionado === "grabar"
                ? "border-[var(--line-strong)] bg-[rgba(203,138,36,0.12)]"
                : "bg-[rgba(255,251,244,0.88)] hover:bg-[rgba(255,246,233,0.92)]"
            } disabled:opacity-60`}
          >
            <p className="workspace-eyebrow !text-[0.64rem]">Opción 1</p>
            <p className="mt-1 font-medium">
              {puedeUsarGrabacionDirecta ? "Grabar ahora" : "Grabar con la cámara del dispositivo"}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {puedeUsarGrabacionDirecta
                ? "Abrí la cámara, grabá tu video y dejalo listo para subir."
                : "Abrí la cámara del dispositivo, grabá tu video y volvé con el archivo listo."}
            </p>
          </button>

          <button
            type="button"
            onClick={() => cambiarModo("archivo")}
            disabled={disabled}
            className={`rounded-xl border p-4 text-left transition ${
              modoSeleccionado === "archivo"
                ? "border-[var(--line-strong)] bg-[rgba(47,109,115,0.1)]"
                : "bg-[rgba(255,251,244,0.88)] hover:bg-[rgba(255,246,233,0.92)]"
            } disabled:opacity-60`}
          >
            <p className="workspace-eyebrow !text-[0.64rem]">Opción 2</p>
            <p className="mt-1 font-medium">Elegir archivo</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Seleccioná un video que ya tengas guardado en este dispositivo.
            </p>
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700 font-medium">{error}</p>
      )}

      {modoSeleccionado !== "ninguno" && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setModoSeleccionado("ninguno")}
            disabled={disabled || grabando}
            className="text-sm text-[var(--muted)] underline disabled:opacity-60"
          >
            Cambiar opción
          </button>
        </div>
      )}

      {modoSeleccionado === "grabar" && puedeUsarGrabacionDirecta && (
        <div className="space-y-3">
          <div className="rounded-xl border overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={!grabando}
              controls={false}
              className="w-full max-h-[360px] object-contain"
            />
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              onClick={abrirCamara}
              disabled={disabled || preparandoCamara || grabando}
              className="workspace-button-secondary disabled:opacity-60"
            >
              {preparandoCamara ? "Abriendo cámara..." : "Abrir cámara"}
            </button>

            <button
              type="button"
              onClick={iniciarGrabacion}
              disabled={disabled || grabando || !streamRef.current}
              className="workspace-button-primary disabled:opacity-60"
            >
              Grabar video
            </button>

            <button
              type="button"
              onClick={detenerGrabacion}
              disabled={disabled || !grabando}
              className="workspace-button-secondary disabled:opacity-60"
            >
              Finalizar grabación
            </button>

            <button
              type="button"
              onClick={cerrarCamara}
              disabled={disabled || grabando}
              className="workspace-button-secondary disabled:opacity-60"
            >
              Cerrar cámara
            </button>
          </div>

          <div className="workspace-inline-note">
            {grabando
              ? `Grabando... ${textoTiempo} / ${String(maxSegundos).padStart(2, "0")} seg máx.`
              : "La cámara está lista para grabar cuando quieras."}
          </div>
        </div>
      )}

      {modoSeleccionado === "grabar" && usaFallbackCaptura && (
        <div className="workspace-divider pt-4 space-y-3">
          <p className="font-medium">Abrir cámara del dispositivo</p>
          <p className="workspace-inline-note">
            {motivoFallbackCaptura ||
              "Si estás en el celular o en una red local, es posible que la cámara no se abra dentro de la plataforma. Desde acá podés grabar con la cámara del dispositivo y volver con el video listo."}
          </p>

          <input
            ref={cameraCaptureInputRef}
            type="file"
            accept="video/*"
            capture="user"
            className="hidden"
            onChange={(e) => seleccionarArchivo(e.target.files?.[0] || null)}
          />

          <button
            type="button"
            onClick={() => cameraCaptureInputRef.current?.click()}
            disabled={disabled}
            className="workspace-button-secondary disabled:opacity-60"
          >
            Abrir cámara del dispositivo
          </button>
        </div>
      )}

      {modoSeleccionado === "archivo" && (
        <div className="workspace-divider pt-4 space-y-3">
          <p className="font-medium">Elegir archivo de video</p>
          <p className="workspace-inline-note">
            Esta opción no necesita abrir la cámara.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            capture="user"
            className="hidden"
            onChange={(e) => seleccionarArchivo(e.target.files?.[0] || null)}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="workspace-button-secondary disabled:opacity-60"
          >
            Elegir archivo de video
          </button>
        </div>
      )}

      <div className="workspace-divider pt-4 space-y-3">
        <p className="font-medium">Vista previa</p>

        {!archivoSeleccionado && (
          <p className="workspace-inline-note">
            Todavía no hay un video listo para subir.
          </p>
        )}

        {archivoSeleccionado && (
          <div className="space-y-3">
            <p className="text-sm text-green-700">
              Archivo listo: <strong>{archivoSeleccionado.name}</strong>
            </p>

            {previewGrabacionUrl && (
              <video
                controls
                playsInline
                src={previewGrabacionUrl}
                className="w-full rounded border"
              />
            )}

            <button
              type="button"
              onClick={limpiarVideoActual}
              disabled={disabled}
              className="workspace-button-secondary disabled:opacity-60"
            >
              Descartar video
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
