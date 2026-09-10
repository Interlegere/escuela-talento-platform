"use client"

import { useRef, useState } from "react"

// preload="none": no se baja nada del archivo (6MB) hasta que alguien lo
// toca — ni con la página recién cargada, ni con el poster a la vista.
// Mientras no arrancó, se tapa el player nativo con un botón propio
// (dorado sobre tinta, mismo halo que el resto de los botones sobre fondo
// oscuro) en vez de mostrar los controles nativos sobre el poster — así no
// compiten dos botones de play distintos por la misma esquina. Una vez que
// arranca, los controles nativos quedan visibles para siempre (pausar,
// volver a reproducir, etc. ya los maneja el navegador).
export default function VideoInvitacion() {
  const [iniciado, setIniciado] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const reproducir = () => {
    setIniciado(true)
    videoRef.current?.play()
  }

  return (
    <div className="relative mx-auto w-full max-w-[380px] overflow-hidden rounded-3xl bg-[var(--tinta)] shadow-[0_18px_40px_rgba(36,31,28,0.15)]">
      <video
        ref={videoRef}
        src="/video/invitacion-web.mp4"
        poster="/video/poster-invitacion.jpg"
        preload="none"
        playsInline
        controls={iniciado}
        onPlay={() => setIniciado(true)}
        className="block aspect-[9/16] w-full"
      >
        Tu navegador no puede reproducir este video.
      </video>

      {!iniciado && (
        <button
          type="button"
          onClick={reproducir}
          aria-label="Reproducir el video de invitación"
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--dorado)] text-[var(--tinta)] shadow-[0_0_20px_rgba(249,195,62,0.60),0_0_44px_rgba(249,195,62,0.30)] transition hover:scale-105 hover:shadow-[0_0_28px_rgba(249,195,62,0.84),0_0_62px_rgba(249,195,62,0.42)]">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="ml-1 h-9 w-9">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  )
}
