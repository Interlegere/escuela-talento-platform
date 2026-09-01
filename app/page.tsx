import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"
import LandingPublicNav from "@/components/landing/LandingPublicNav"
import {
  acronimo,
  aperturaParrafos,
  comunidadParrafo,
  empezarParrafos,
  espacios,
  etimologia,
  nicolasParrafos,
  paraQueSirveParrafos,
  porQueExisteParrafos,
  problemaParrafos,
  puertas,
  resultados,
} from "@/lib/institucional-content"

export const metadata: Metadata = {
  title: "ENTHEOS | Escuela de talento, entusiasmo y orden de los sentidos",
  description:
    "Una escuela donde deportistas, artistas, emprendedores, empresarios y profesionales construyen un rumbo propio, lo hacen crecer y lo conectan con un propósito que le dé entusiasmo a la vida.",
}

function Seccion({
  children,
  className = "",
  id,
}: {
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={`px-5 py-20 sm:px-8 sm:py-28 ${className}`}>
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </section>
  )
}

function Parrafo({ children }: { children: ReactNode }) {
  return (
    <p className="text-[1.05rem] leading-[1.7] text-[rgba(32,37,41,0.82)] sm:text-[1.12rem]">
      {children}
    </p>
  )
}

function Titulo({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-[family-name:var(--font-display)] text-[1.75rem] font-normal leading-[1.2] tracking-[-0.01em] text-[#202529] sm:text-[2.15rem]">
      {children}
    </h2>
  )
}

export default function WebInstitucional() {
  return (
    <main className="relative bg-[#f4ecde] text-[#202529]">
      <LandingPublicNav />

      {/* Apertura */}
      <section className="relative overflow-hidden px-5 pb-20 pt-36 sm:px-8 sm:pb-28 sm:pt-44">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="font-[family-name:var(--font-display)] text-[2.6rem] font-normal leading-[1.02] tracking-[-0.02em] text-[#202529] sm:text-[4rem]">
            ENTHEOS
          </h1>
          <p className="mt-4 max-w-xl text-[0.95rem] leading-[1.55] text-[var(--accent-strong)] sm:text-[1.02rem]">
            {acronimo}
          </p>

          <div className="mt-10 space-y-5 border-l-2 border-[rgba(207,145,48,0.35)] pl-5 sm:pl-7">
            {aperturaParrafos.map((texto) => (
              <p
                key={texto.slice(0, 24)}
                className="text-[1.12rem] leading-[1.65] text-[rgba(32,37,41,0.88)] sm:text-[1.25rem]"
              >
                {texto}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Qué problema resuelve */}
      <Seccion className="bg-[linear-gradient(180deg,#f4ecde,#efe4d0)]">
        <div className="space-y-5">
          <Titulo>{problemaParrafos[0]}</Titulo>
          {problemaParrafos.slice(1).map((texto) => (
            <Parrafo key={texto.slice(0, 24)}>{texto}</Parrafo>
          ))}
        </div>
      </Seccion>

      {/* Qué hacemos */}
      <Seccion className="bg-[#efe4d0]">
        <Titulo>Qué hacemos</Titulo>
        <div className="mt-10 space-y-9">
          {espacios.map((espacio) => (
            <div
              key={espacio.titulo}
              className="border-t border-[rgba(96,77,49,0.16)] pt-6"
            >
              <h3 className="font-[family-name:var(--font-display)] text-[1.22rem] font-medium text-[#202529] sm:text-[1.35rem]">
                {espacio.titulo}
              </h3>
              <p className="mt-2.5 text-[1rem] leading-[1.65] text-[rgba(32,37,41,0.78)]">
                {espacio.texto}
              </p>
            </div>
          ))}
        </div>
      </Seccion>

      {/* Para qué sirve */}
      <Seccion className="bg-[linear-gradient(180deg,#efe4d0,#f6efe2)]">
        <div className="space-y-5">
          <Titulo>{paraQueSirveParrafos[0]}</Titulo>
          {paraQueSirveParrafos.slice(1).map((texto) => (
            <Parrafo key={texto.slice(0, 24)}>{texto}</Parrafo>
          ))}
        </div>
      </Seccion>

      {/* Resultados — solo se renderiza cuando hay material real */}
      {resultados.length > 0 && (
        <Seccion className="bg-[#f6efe2]">
          <Titulo>Lo que fue pasando</Titulo>
          <div className="mt-10 space-y-7">
            {resultados.map((resultado) => (
              <div
                key={resultado.hecho.slice(0, 24)}
                className="border-l-2 border-[rgba(207,145,48,0.4)] pl-5"
              >
                <p className="text-[1.05rem] leading-[1.6] text-[rgba(32,37,41,0.85)]">
                  {resultado.hecho}
                </p>
                {resultado.quien && (
                  <p className="mt-1.5 text-[0.85rem] uppercase tracking-[0.12em] text-[var(--muted)]">
                    {resultado.quien}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Seccion>
      )}

      {/* Quiénes lo integran */}
      <Seccion className="bg-[linear-gradient(180deg,#f6efe2,#fdf8ef)]">
        <Titulo>Quiénes lo integramos</Titulo>
        <div className="mt-9 space-y-5">
          {nicolasParrafos.map((texto) => (
            <Parrafo key={texto.slice(0, 24)}>{texto}</Parrafo>
          ))}
        </div>
        <p className="mt-9 border-t border-[rgba(96,77,49,0.16)] pt-7 text-[1.05rem] leading-[1.7] text-[rgba(32,37,41,0.82)]">
          <span className="font-medium text-[#202529]">
            Y los que venimos cada semana.{" "}
          </span>
          {comunidadParrafo}
        </p>
      </Seccion>

      {/* Por qué existe */}
      <Seccion className="bg-[#fdf8ef]">
        <div className="space-y-5">
          <Titulo>Por qué existe</Titulo>
          {porQueExisteParrafos.map((texto) => (
            <Parrafo key={texto.slice(0, 24)}>{texto}</Parrafo>
          ))}
        </div>
        <p className="mt-9 border-t border-[rgba(207,145,48,0.3)] pt-7 font-[family-name:var(--font-display)] text-[1.05rem] italic leading-[1.65] text-[rgba(32,37,41,0.72)]">
          {etimologia}
        </p>
      </Seccion>

      {/* Cómo empezar */}
      <Seccion
        id="conversemos"
        className="bg-[linear-gradient(180deg,#fdf8ef,#fffaf1)]"
      >
        <Titulo>Cómo empezar</Titulo>
        <div className="mt-8 space-y-5">
          {empezarParrafos.map((texto) => (
            <Parrafo key={texto.slice(0, 24)}>{texto}</Parrafo>
          ))}
        </div>

        <div className="mt-12 space-y-4">
          {puertas.map((puerta) => (
            <Link
              key={puerta.label}
              href={puerta.href}
              className={`group flex min-h-[4.5rem] items-center justify-between gap-5 rounded-[1.4rem] border px-6 py-5 transition hover:-translate-y-0.5 motion-reduce:transition-none ${
                puerta.principal
                  ? "border-[rgba(201,142,45,0.28)] bg-[linear-gradient(135deg,#ffd778,#e8a642)] text-[#3e2a0e] shadow-[0_18px_44px_rgba(201,142,45,0.2)]"
                  : "border-[rgba(96,77,49,0.18)] bg-[rgba(255,252,246,0.8)] text-[#202529] shadow-[0_12px_30px_rgba(55,42,28,0.07)]"
              }`}
            >
              <span>
                <span className="block text-[1.02rem] font-semibold">
                  {puerta.label}
                </span>
                <span
                  className={`mt-0.5 block text-[0.88rem] ${
                    puerta.principal
                      ? "text-[rgba(62,42,14,0.75)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {puerta.detalle}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="text-lg transition group-hover:translate-x-0.5 motion-reduce:transition-none"
              >
                →
              </span>
            </Link>
          ))}
        </div>
      </Seccion>

      <footer className="border-t border-[rgba(96,77,49,0.16)] bg-[#fffaf1] px-5 py-8 text-[0.88rem] text-[var(--muted)] sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>ENTHEOS · Escuela de talento, entusiasmo y orden de los sentidos.</p>
          <div className="flex gap-5">
            <Link href="/landing" className="underline underline-offset-4">
              Empezar
            </Link>
            <Link href="/login" className="underline underline-offset-4">
              Ingresar
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
