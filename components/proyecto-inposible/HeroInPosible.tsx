import Image from "next/image"
import TiraLogos from "./TiraLogos"
import { ASSETS } from "@/lib/proyecto-inposible-assets"

// El collage a sangre, con un Ken Burns muy lento (20s, casi imperceptible)
// para que la pantalla respire en vez de ser un póster. Si ASSETS.heroVideo
// existe, el video reemplaza a la foto (con la foto de poster, así que un
// video lento para cargar nunca deja un hueco).
export default function HeroInPosible({
  logo,
  eyebrow,
  nombre,
  bajada,
  lineaInfo,
  boton,
}: {
  // null cuando public/logo-entheos.png todavía no existe — no deja un
  // hueco ni un ícono roto, el eyebrow de texto pasa a ser lo primero que
  // se ve, igual que antes de que hubiera logo.
  logo: React.ReactNode
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
            // Velo más oscuro (antes .62/.45/.72) — hace el trabajo que
            // antes hacía el text-shadow, sin que el texto se vea con
            // sombra. Medido con muestreo real de píxeles (no a ojo, y no
            // solo el promedio): con el primer intento (.68/.58/.76) el
            // eyebrow "ENTHEOS" y el rótulo de la tira de logos —los dos
            // textos más chicos del hero— tenían 3,6% y 30,6% de su área
            // por debajo de 4,5:1 sobre las zonas más claras de la foto.
            // Con estos valores, los dos dan 0% de área por debajo del
            // mínimo (peor píxel medido: 4,53:1 y 4,80:1).
            background:
              "linear-gradient(180deg, rgba(36,31,28,.82) 0%, rgba(36,31,28,.68) 45%, rgba(36,31,28,.84) 100%)",
          }}
        />
      </div>

      {/* Sin text-shadow: el respaldo de legibilidad ahora es 100% el velo
          de arriba, más oscuro que antes — un texto con sombra y un halo
          dorado al lado se leían como dos efectos superpuestos, se pidió
          sacar la sombra y dejar que el halo sea lo único que brilla. */}
      <div className="relative z-10 flex min-h-[92svh] flex-col items-center justify-center px-4 py-16 text-center text-[var(--crema)] sm:px-6">
        {logo}
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
