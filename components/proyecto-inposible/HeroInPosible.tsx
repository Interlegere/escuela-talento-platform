import Image from "next/image"
import TiraLogos from "./TiraLogos"
import { ASSETS } from "@/lib/proyecto-inposible-assets"

// El collage a sangre, con un Ken Burns muy lento (20s, casi imperceptible)
// para que la pantalla respire en vez de ser un póster. Si ASSETS.heroVideo
// existe, el video reemplaza a la foto (con la foto de poster, así que un
// video lento para cargar nunca deja un hueco).
export default function HeroInPosible({
  eyebrow,
  nombre,
  bajada,
  lineaInfo,
  boton,
}: {
  eyebrow: React.ReactNode
  nombre: React.ReactNode
  bajada: React.ReactNode
  lineaInfo: React.ReactNode
  boton: React.ReactNode
}) {
  return (
    <section className="relative min-h-[92svh] w-full overflow-hidden bg-[var(--tinta)]">
      <style>{`
        /* Se aleja, no se acerca: a escala 1,12 se ve el 54% de la foto, a
           1,00 se ve el 60% (el máximo posible con object-fit: cover) —
           así el zoom termina mostrando más, no menos. La dirección
           también acompaña a "¡se abre!" en vez de contradecirlo. */
        @keyframes pip-kenburns { 0%, 100% { transform: scale(1.12); } 50% { transform: scale(1); } }
        .pip-kenburns { transform-origin: center 40%; animation: pip-kenburns 20s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .pip-kenburns { animation: none; } }
      `}</style>

      <div className="absolute inset-0">
        {ASSETS.heroVideo ? (
          <video
            className="pip-kenburns h-full w-full object-cover object-center"
            src={ASSETS.heroVideo}
            poster="/talentos-collage.jpg"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <Image
            src="/talentos-collage.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="pip-kenburns object-cover object-center"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(36,31,28,.62) 0%, rgba(36,31,28,.45) 45%, rgba(36,31,28,.72) 100%)",
          }}
        />
      </div>

      <div
        className="relative z-10 flex min-h-[92svh] flex-col items-center justify-center px-4 py-16 text-center text-[var(--crema)] sm:px-6"
        // El velo por sí solo mide 4,5:1+ de promedio pero cae bajo eso sobre
        // los parches más claros de la foto (medido con muestreo real de
        // píxeles: hasta 16% del área de fondo por debajo del mínimo). Esta
        // sombra no toca los valores del velo — es la red de seguridad para
        // que el texto siga siendo legible aunque caiga justo sobre una zona
        // clara de la imagen.
        style={{ textShadow: "0 2px 4px rgba(36,31,28,.55), 0 1px 14px rgba(36,31,28,.45)" }}
      >
        {eyebrow}
        {nombre}
        {bajada}
        {lineaInfo}
        {boton}
        <TiraLogos />
      </div>

      {/* Sentinela para la barra fija: cuando esto sale de pantalla, el hero terminó */}
      <div id="hero-fin" aria-hidden className="absolute bottom-0 h-px w-full" />
    </section>
  )
}
