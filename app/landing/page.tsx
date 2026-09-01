import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import LandingPublicNav from "@/components/landing/LandingPublicNav"
import LandingScrollShell from "@/components/landing/LandingScrollShell"
import {
  changeMovements,
  conversationScene,
  conversationHref,
  earlyPositions,
  landingMoments,
} from "@/lib/landing-content"

export const metadata: Metadata = {
  title: "ENTHEOS | Primera conversación",
  description:
    "Una experiencia para reconocer qué lugar ocupa hoy tu talento y qué querés empezar a transformar.",
}

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p
      className={`text-xs font-semibold uppercase tracking-[0.22em] ${
        dark ? "text-[#fac339]" : "text-[#2d6f95]"
      }`}
    >
      {children}
    </p>
  )
}

function PrimaryCta({
  href = conversationHref,
  children = "Quiero conversar con Nicolás",
}: {
  href?: string
  children?: ReactNode
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[3.2rem] items-center justify-center rounded-full border border-[rgba(201,142,45,0.22)] bg-[linear-gradient(135deg,#ffd778,#e8a642)] px-6 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-[#3e2a0e] shadow-[0_18px_44px_rgba(201,142,45,0.18)] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6f95] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4ecde] motion-reduce:transition-none"
    >
      {children}
    </Link>
  )
}

function HumanImage({
  src,
  alt,
  priority = false,
  className = "",
}: {
  src: string
  alt: string
  priority?: boolean
  className?: string
}) {
  return (
    <div
      className={`relative overflow-hidden border border-[rgba(57,48,35,0.08)] bg-[rgba(255,252,246,0.72)] shadow-[0_24px_64px_rgba(88,66,28,0.1)] ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 42vw"
        priority={priority}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(244,236,222,0.02),rgba(18,28,36,0.12))]" />
    </div>
  )
}

function ThreadMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 180" className={className} aria-hidden="true">
      <path
        d="M26 120C94 48 162 44 226 86C278 120 326 142 388 96C420 72 452 60 494 74"
        fill="none"
        stroke="rgba(45,111,149,0.2)"
        strokeLinecap="round"
        strokeWidth="8"
      />
      <path
        d="M112 98C162 132 230 136 286 104C332 78 386 78 436 112"
        fill="none"
        stroke="rgba(31,96,93,0.16)"
        strokeLinecap="round"
        strokeWidth="5"
      />
      <circle cx="112" cy="98" r="8" fill="rgba(250,195,57,0.76)" />
      <circle cx="286" cy="104" r="7" fill="rgba(45,111,149,0.68)" />
      <circle cx="436" cy="112" r="8" fill="rgba(31,96,93,0.68)" />
    </svg>
  )
}

function QuoteCard({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div
      className={`w-full max-w-full break-words rounded-[1.35rem] border px-5 py-5 text-lg leading-8 ${
        dark
          ? "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] text-[#fff7ec]"
          : "border-[rgba(59,48,36,0.08)] bg-[rgba(255,252,246,0.7)] text-[#1f605d]"
      }`}
    >
      {children}
    </div>
  )
}

function InnerVoice({
  phrases,
}: {
  phrases: string[]
}) {
  return (
    <div className="ml-auto max-w-xl border-l border-[rgba(45,111,149,0.16)] pl-5 sm:pl-7">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2d6f95]">
        Lo que quizás te decís
      </p>
      <div className="mt-6 space-y-3">
        {phrases.map((phrase) => (
          <p
            key={phrase}
            className="text-base italic leading-7 text-[rgba(29,35,40,0.66)]"
          >
            “{phrase}”
          </p>
        ))}
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <LandingScrollShell>
      <main className="overflow-x-clip bg-[#f4ecde] text-[#1d2328]">
        <LandingPublicNav />

        <section
          id="inicio"
          data-landing-stage="latencia"
          className="relative min-h-screen overflow-hidden border-b border-[rgba(59,48,36,0.08)] bg-[#f4ecde]"
        >
          <style>{`
            @media (min-width: 1024px) and (max-height: 820px) {
              .entheos-hero-copy {
                transform: scale(0.9);
                transform-origin: left top;
              }
            }
          `}</style>
          <div className="absolute inset-y-0 right-0 w-full lg:w-[86%]">
            <Image
              src="/landing/hero-editorial-collage-v4.png"
              alt="Collage editorial de personas entrenando, pintando, interpretando música, trabajando y buscando dirección con un mapa."
              fill
              priority
              className="object-cover object-[78%_center] sm:object-[70%_center] lg:object-[62%_center]"
              sizes="(max-width: 1023px) 100vw, 86vw"
            />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(244,236,222,0.96)_0%,rgba(244,236,222,0.88)_58%,rgba(244,236,222,0.54)_100%)] lg:bg-[linear-gradient(90deg,rgba(244,236,222,0.98)_0%,rgba(244,236,222,0.95)_40%,rgba(244,236,222,0.3)_56%,rgba(244,236,222,0)_72%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_21%,rgba(250,195,57,0.16),transparent_27%),linear-gradient(180deg,rgba(255,252,246,0.16),rgba(244,236,222,0.03))]" />

          <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 pb-8 pt-24 sm:px-6 sm:pt-28 lg:px-8 lg:pb-[min(2.5rem,4vh)] lg:pt-[min(6rem,9vh)]">
            <div className="entheos-hero-copy w-full min-w-0 max-w-sm sm:max-w-xl lg:max-w-[38rem]">
              <h1 className="font-display text-[2.85rem] leading-none tracking-tight text-[#071a2f] sm:text-[3.5rem] lg:text-[min(4.5rem,8vh)] lg:leading-[0.96]">
                <span className="block">Algo valioso</span>
                <span className="block">dentro tuyo</span>
                <span className="block">precisa</span>
                <span className="block text-[#c98e2d]">encenderse.</span>
              </h1>
              <div className="font-sans mt-10 max-w-[31rem] text-[#182530] sm:mt-12 lg:mt-[min(3rem,5vh)]">
                <p className="text-[clamp(1.125rem,1.45vw,1.375rem)] font-normal leading-[1.55]">
                  Cuando lo mejor de vos no encuentra lugar,
                </p>
                <p className="mt-3 text-[clamp(1.125rem,1.5vw,1.375rem)] font-semibold leading-[1.5] sm:mt-4">
                  se apaga más de un área de tu vida.
                </p>
              </div>
              <div className="mt-12 max-w-lg py-2 sm:mt-14 lg:mt-[min(3.5rem,5.8vh)]">
                <p className="font-display text-[1.6rem] leading-tight tracking-tight text-[#071a2f] sm:text-[1.9375rem] lg:text-[min(2.0625rem,3.7vh)]">
                  ¿Y si el problema nunca fue la falta de talento?
                </p>
              </div>
              <div className="mt-11 max-w-lg sm:mt-12 lg:mt-[min(3rem,5vh)]">
                <p className="font-sans min-w-0 whitespace-normal break-words text-[clamp(1.1875rem,1.6vw,1.5rem)] font-medium leading-[1.5] tracking-normal text-[#182530]">
                  ¡Escuchá tus habilidades,
                  <br className="sm:hidden" /> diferenciales y pasiones!
                </p>
              </div>
              <div className="mt-13 sm:mt-14 lg:mt-[min(3.5rem,5.8vh)]">
                <Link
                  href="#tension"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#071a2f] px-7 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white shadow-[0_16px_34px_rgba(7,26,47,0.18)] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98e2d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4ecde] motion-reduce:transition-none"
                  style={{ color: "#ffffff" }}
                >
                  SEGUIR LEYENDO
                  <span className="ml-4 text-[#fac339]" aria-hidden="true">
                    ↓
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section
          data-landing-stage="reconocimiento"
          className="relative border-b border-[rgba(59,48,36,0.08)] bg-[rgba(255,252,246,0.72)]"
        >
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="grid gap-5 lg:grid-cols-3">
              {earlyPositions.map((position, index) => (
                <p
                  key={position}
                  className={`rounded-[1.4rem] border px-5 py-6 text-base leading-8 text-[rgba(29,35,40,0.76)] ${
                    index === 0
                      ? "border-[rgba(45,111,149,0.14)] bg-[rgba(240,246,250,0.62)]"
                      : index === 1
                        ? "border-[rgba(201,142,45,0.16)] bg-[rgba(255,248,237,0.74)]"
                        : "border-[rgba(31,96,93,0.14)] bg-[rgba(240,247,246,0.64)]"
                  }`}
                >
                  {position}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section
          id="tension"
          data-landing-stage="reconocimiento"
          className="relative overflow-hidden border-b border-[rgba(59,48,36,0.08)] bg-[#203840] text-[#f8f1e5]"
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0)),radial-gradient(circle_at_70%_20%,rgba(250,195,57,0.12),transparent_30%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-18 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:px-8 lg:py-28">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Eyebrow dark>Tensión y problema</Eyebrow>
              <h2 className="font-display mt-5 text-4xl leading-tight text-[#fff7ec] sm:text-5xl">
                A veces el problema no es tener o no tener talento.
              </h2>
              <p className="mt-6 text-lg leading-8 text-[rgba(248,241,229,0.74)]">
                El problema está en el lugar, o en el no lugar, que tu talento ocupa dentro de tu vida.
              </p>
            </div>

            <div className="space-y-8">
              <div className="grid gap-4 text-xl leading-9 text-[#fff7ec] sm:text-2xl">
                <p>
                  Sabés que hay algo que te gusta, algo que hacés bien o algo que otros reconocen en vos, y aun así lo tratás como una actividad secundaria.
                </p>
                <p>
                  Un hobby. Un escape. Algo para cuando sobra tiempo.
                </p>
              </div>

              <div className="space-y-5 text-base leading-8 text-[rgba(248,241,229,0.78)]">
                <p>
                  También ocurre que tener talento no significa haberle dado continuidad, haberlo expuesto, haberlo usado ni haber construido las condiciones para que crezca.
                </p>
                <p>
                  Y muchas veces pasa lo contrario: conseguiste resultados, reconocimiento o crecimiento económico y profesional, pero sostenés una vida que “funciona” y que, sin embargo, no te entusiasma.
                </p>
              </div>

              <p className="font-display py-10 text-3xl leading-tight text-[#fac339] sm:py-14 sm:text-4xl lg:text-[3.3rem]">
                Respondés. Cumplís. Producís. Tenés.
              </p>

              <div className="max-w-2xl space-y-5 border-l border-[rgba(250,195,57,0.28)] pl-5 text-base leading-8 text-[rgba(248,241,229,0.78)]">
                <p className="text-xl leading-9 text-[#fff7ec]">
                  Una vida puede seguir funcionando y, al mismo tiempo, dejar afuera el cuerpo, los vínculos, el disfrute, la salud, el presente y la dirección.
                </p>
                <p>
                  A veces creés que te falta voluntad, disciplina o claridad.
                </p>
                <p className="pt-5 text-xl leading-9 text-[#fff7ec]">
                  Pero ¿realmente te falta algo?
                </p>
                <p className="text-[#fff7ec]">
                  La pregunta es otra:
                </p>
                <p>
                  ¿Qué lugar ocupás frente a lo que tenés, frente a lo que postergás y frente a lo que ya construiste?
                </p>
              </div>

              <QuoteCard dark>
                El problema no siempre está en descubrir tu talento. También puede estar en la forma en que lo desarrollás o en cómo vivís aquello que lograste gracias a él.
              </QuoteCard>
            </div>
          </div>
        </section>

        <section
          id="momentos"
          data-landing-stage="desciframiento"
          className="relative overflow-hidden border-b border-[rgba(59,48,36,0.08)] bg-[linear-gradient(180deg,#fbf7ef_0%,#edf4f5_100%)]"
        >
          <div className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-28">
            <div className="max-w-4xl">
              <Eyebrow>Reconocimiento</Eyebrow>
              <h2 className="font-display mt-5 text-4xl leading-tight text-[#182024] sm:text-5xl lg:text-6xl">
                Existen tres situaciones que podés atravesar respecto de tu talento.
              </h2>
              <div className="mt-7 grid gap-4 text-base leading-8 text-[rgba(29,35,40,0.74)] sm:grid-cols-2">
                <div className="space-y-3">
                  <p>No son perfiles.</p>
                  <p>No son niveles.</p>
                  <p>No son categorías que te definen.</p>
                </div>
                <p>
                  Son lugares dinámicos desde los cuales podés reconocer qué está pasando con lo que tenés, con lo que hacés, con lo que intentás construir o con lo que ya lograste.
                </p>
              </div>
            </div>

            <div className="mt-14 space-y-16 lg:space-y-24">
              {landingMoments.map((moment, index) => (
                <article
                  key={moment.id}
                  className="grid gap-8 border-t border-[rgba(59,48,36,0.1)] pt-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14"
                >
                  <div className="lg:sticky lg:top-28 lg:self-start">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b6c30]">
                      Momento {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="font-display mt-4 text-3xl leading-tight text-[#182024] sm:text-4xl">
                      {moment.title}
                    </h3>
                    <HumanImage
                      src={moment.image.src}
                      alt={moment.image.alt}
                      className="mt-7 h-72 rounded-[2rem_1.2rem_2rem_1.4rem] sm:h-84 lg:h-[26rem]"
                    />
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-4 text-base leading-8 text-[rgba(29,35,40,0.76)]">
                      {moment.intro.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>

                    <InnerVoice phrases={moment.interpretation} />

                    <div className="space-y-4 text-base leading-8 text-[rgba(29,35,40,0.78)]">
                      {moment.reading.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>

                    <QuoteCard>{moment.highlight}</QuoteCard>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          data-landing-stage="desciframiento"
          className="relative overflow-hidden border-b border-[rgba(59,48,36,0.08)] bg-[linear-gradient(180deg,#eef4f5_0%,#fbf4e8_100%)]"
        >
          <ThreadMark className="absolute right-[-7rem] top-10 hidden h-44 w-[34rem] opacity-60 lg:block" />
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-18 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:px-8 lg:py-28">
            <div>
              <Eyebrow>Mirada ENTHEOS</Eyebrow>
              <h2 className="font-display mt-5 text-4xl leading-tight text-[#182024] sm:text-5xl">
                El talento no es solamente el don que tenés.
              </h2>
              <p className="mt-6 text-lg leading-8 text-[rgba(29,35,40,0.72)]">
                También es la decisión que tomás respecto de para qué usarlo.
              </p>
            </div>

            <div className="space-y-6 text-base leading-8 text-[rgba(29,35,40,0.76)]">
              <div className="grid gap-4 text-xl leading-9 text-[#182024] sm:grid-cols-3">
                <p>Podés tener una capacidad y no reconocer su valor.</p>
                <p>Podés reconocerla y no desarrollarla.</p>
                <p>Podés desarrollarla y no saber cómo vivir con aquello que abrió en tu vida.</p>
              </div>
              <p>El talento no es el final del recorrido.</p>
              <p>Es recién el comienzo.</p>
              <p>
                A través de lo que hacés, deseás construir o ya lograste, empiezan a aparecer tus decisiones, tus miedos, tus vínculos, tus exigencias, tu historia, tu cuerpo, tu disfrute, tu responsabilidad y tu dirección.
              </p>
              <QuoteCard>
                Podés producir mucho y estar perdiendo entusiasmo. Podés tener reconocimiento y no tener descanso. Podés saber qué querés hacer y seguir eligiendo la supervivencia.
              </QuoteCard>
              <p>
                ENTHEOS trabaja a partir del talento porque ahí la vida se vuelve concreta, sin necesidad de convertirla en teoría.
              </p>
              <p>
                El entusiasmo empieza a recuperarse cuando algo propio vuelve a tener lugar, dirección, uso y sentido.
              </p>
            </div>
          </div>
        </section>

        <section
          data-landing-stage="movimiento"
          className="relative overflow-hidden border-b border-[rgba(59,48,36,0.08)] bg-[linear-gradient(180deg,#fbf4e8_0%,#f4ecde_100%)]"
        >
          <div className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-28">
            <div className="max-w-3xl">
              <Eyebrow>Cuando algo propio encuentra lugar</Eyebrow>
              <h2 className="font-display mt-5 text-4xl leading-tight text-[#182024] sm:text-5xl">
                ¿Qué empieza a cambiar?
              </h2>
              <p className="mt-6 text-lg leading-8 text-[rgba(29,35,40,0.72)]">
                No cambia todo de repente. Primero cambia el lugar desde el que comprendés y decidís.
              </p>
            </div>

            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {changeMovements.map((movement, index) => (
                <article
                  key={movement.title}
                  className={`rounded-[1.45rem] border px-5 py-6 ${
                    index % 3 === 0
                      ? "border-[rgba(45,111,149,0.14)] bg-[rgba(240,246,250,0.72)]"
                      : index % 3 === 1
                        ? "border-[rgba(201,142,45,0.16)] bg-[rgba(255,248,237,0.76)]"
                        : "border-[rgba(31,96,93,0.14)] bg-[rgba(240,247,246,0.72)]"
                  }`}
                >
                  <h3 className="font-display text-2xl leading-tight text-[#182024]">
                    {movement.title}
                  </h3>
                  <p className="mt-4 text-base leading-8 text-[rgba(29,35,40,0.74)]">
                    {movement.text}
                  </p>
                  {movement.highlight ? (
                    <p className="mt-6 border-t border-[rgba(59,48,36,0.1)] pt-5 text-sm leading-7 text-[#1f605d]">
                      {movement.highlight}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="mt-16 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)] lg:items-end">
              <div className="max-w-2xl space-y-5 text-base leading-8 text-[rgba(29,35,40,0.76)]">
                <p>No todo cansancio es crecimiento.</p>
                <p>No toda exigencia merece ser sostenida.</p>
                <p>
                  No toda vida que “funciona” hacia afuera está ordenada por dentro.
                </p>
              </div>
              <QuoteCard>
                ENTHEOS te invita a ponerle un norte a tu talento, recuperar el entusiasmo y ordenar los sentidos más importantes de tu vida.
              </QuoteCard>
            </div>
          </div>
        </section>

        <section
          id="primera-conversacion"
          data-landing-stage="integracion"
          className="relative overflow-hidden border-b border-[rgba(59,48,36,0.08)] bg-[#21343b] text-[#f8f1e5]"
        >
          <div className="absolute inset-0 bg-[linear-gradient(130deg,rgba(250,195,57,0.1),transparent_38%,rgba(45,111,149,0.16))]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-18 sm:px-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-center lg:px-8 lg:py-28">
            <div>
              <Eyebrow dark>Primera conversación</Eyebrow>
              <h2 className="font-display mt-5 text-4xl leading-tight text-[#fff7ec] sm:text-5xl">
                Después de este recorrido, no necesitás saber exactamente qué actividad elegir.
              </h2>
              <p className="mt-6 text-lg leading-8 text-[rgba(248,241,229,0.76)]">
                En ENTHEOS no empezamos ofreciéndote una actividad desde un catálogo.
              </p>
            </div>

            <div className="rounded-[2rem] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] px-5 py-6 shadow-[0_30px_80px_rgba(9,18,24,0.22)] sm:px-7 sm:py-8">
              <div className="space-y-6 text-base leading-8 text-[rgba(248,241,229,0.78)]">
                {conversationScene.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <div className="mt-7">
                <QuoteCard dark>
                  No se trata de elegir rápido. Se trata de empezar desde una lectura que tenga sentido.
                </QuoteCard>
              </div>
              <div className="mt-7">
                <PrimaryCta />
              </div>
            </div>
          </div>
        </section>

        <section
          data-landing-stage="integracion"
          className="relative overflow-hidden border-b border-[rgba(59,48,36,0.08)] bg-[linear-gradient(180deg,#f5ecdd_0%,#eef4f6_100%)]"
        >
          <div className="mx-auto grid max-w-7xl gap-9 px-4 py-18 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:px-8 lg:py-28">
            <HumanImage
              src="/landing/director-placeholder.svg"
              alt="Nicolás Busico en un entorno de trabajo y conversación."
              className="h-80 rounded-[2rem_1.2rem_2rem_1.4rem] sm:h-[28rem]"
            />

            <div>
              <Eyebrow>Nicolás</Eyebrow>
              <h2 className="font-display mt-5 text-4xl leading-tight text-[#182024] sm:text-5xl">
                Tu primera conversación en ENTHEOS es con Nicolás Busico.
              </h2>
              <p className="mt-6 text-lg leading-8 text-[rgba(29,35,40,0.72)]">
                Fundador y conductor de la escuela.
              </p>
              <div className="mt-7 space-y-5 text-base leading-8 text-[rgba(29,35,40,0.76)]">
                <p>
                  Su trabajo reúne psicología, mentoría, enseñanza y experiencia en la conducción de procesos humanos concretos.
                </p>
                <p>
                  La conversación no busca convertir tu situación en una terapia ni darte una respuesta cerrada.
                </p>
                <p>
                  Busca comprender desde dónde llegás, mostrarte una lectura posible y orientarte hacia la actividad o el recorrido de ENTHEOS que mejor responda a tu momento.
                </p>
                <p>
                  Nicolás conduce la escuela, enseña a mirar, propone recorridos y sostiene la dirección de cada experiencia.
                </p>
              </div>
              <div className="mt-7">
                <QuoteCard>
                  No vas a conversar con una plataforma. Vas a conocer la escuela a través de quien la creó y la conduce.
                </QuoteCard>
              </div>
              <div className="mt-7">
                <PrimaryCta />
              </div>
            </div>
          </div>
        </section>

        <section
          data-landing-stage="apertura"
          className="relative overflow-hidden bg-[linear-gradient(180deg,#eef4f6_0%,#fdf8ef_100%)]"
        >
          <ThreadMark className="absolute left-1/2 top-8 hidden h-48 w-[36rem] -translate-x-1/2 opacity-70 md:block" />
          <div className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-30">
            <Eyebrow>Cierre</Eyebrow>
            <h2 className="font-display mt-5 text-4xl leading-tight text-[#182024] sm:text-6xl">
              Tal vez no necesitás sumar una actividad nueva.
            </h2>
            <p className="mx-auto mt-6 max-w-3xl text-xl leading-9 text-[rgba(29,35,40,0.76)]">
              Tal vez necesites mirar con más precisión qué está pasando con eso valioso que todavía no encontró su lugar.
            </p>
            <div className="mx-auto mt-10 max-w-2xl space-y-5 text-base leading-8 text-[rgba(29,35,40,0.76)]">
              <p>No hace falta que llegues con una respuesta cerrada.</p>
              <p>
                Podés empezar presentando tu situación, recibiendo una nueva lectura y descubriendo qué puerta de ENTHEOS tiene sentido para vos.
              </p>
            </div>
            <div className="mx-auto mt-9 max-w-3xl">
              <QuoteCard>
                Empezar no siempre es elegir una actividad. A veces es mirar de otra manera lo que ya está pasando.
              </QuoteCard>
            </div>
            <div className="mt-9">
              <PrimaryCta />
            </div>
          </div>
        </section>
      </main>
    </LandingScrollShell>
  )
}
