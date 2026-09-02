"use client"

import Link from "next/link"
import { useDeteccionInstalacion } from "@/hooks/useDeteccionInstalacion"

// Página pública, pensada para abrirse desde un link de WhatsApp en un
// celular — una sola pantalla, sin sesión, sin AppNav ni AppFooter (ver
// esRutaPublicaSinNav en components/AppNav.tsx). Reutiliza la detección de
// plataforma/instalación de hooks/useDeteccionInstalacion.ts, la misma que
// usa components/InstalarApp.tsx, en vez de duplicarla acá.

function IconoCompartir() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-9 w-9">
      <path
        d="M12 3v12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M7.5 7.5 12 3l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 11v7.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconoAgregarPantalla() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-9 w-9">
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 8.5v7M8.5 12h7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconoMenuPuntos() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-9 w-9">
      <circle cx="12" cy="5.5" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.4" fill="currentColor" />
    </svg>
  )
}

function IconoDescargar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-9 w-9">
      <path
        d="M12 4v11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M7.5 11 12 15.5 16.5 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 18.5h14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconoTelefono() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-10 w-10">
      <rect
        x="6.5"
        y="2.5"
        width="11"
        height="19"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M11 18.3h2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconoListo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-10 w-10">
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 12.5 10.8 15.3 16.3 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Paso({
  numero,
  icono,
  titulo,
  detalle,
}: {
  numero: number
  icono: React.ReactNode
  titulo: string
  detalle: string
}) {
  return (
    <div className="flex items-start gap-4 rounded-[1.4rem] border border-[rgba(207,145,48,0.28)] bg-white/60 p-5">
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[#cf9130] text-lg font-bold text-[#cf9130]"
      >
        {numero}
      </span>
      <div className="flex-1 space-y-1.5">
        <p className="text-lg font-semibold text-[#202529]">{titulo}</p>
        <p className="text-sm leading-6 text-[rgba(32,37,41,0.72)]">{detalle}</p>
      </div>
      <span aria-hidden className="shrink-0 text-[#cf9130]">
        {icono}
      </span>
    </div>
  )
}

export default function InstalarAppPage() {
  const { mounted, instalado, plataforma, puedeInstalarNativo, instalar } =
    useDeteccionInstalacion()

  if (!mounted) {
    return <main className="min-h-screen bg-[#f4ecde]" />
  }

  return (
    <main className="flex min-h-screen justify-center bg-[#f4ecde] px-5 py-14">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon.png"
          alt="ENTHEOS"
          className="mx-auto h-28 w-28 rounded-[1.6rem] shadow-[0_18px_40px_rgba(154,98,24,0.22)]"
        />

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-[#202529]">
            Instalá ENTHEOS
          </h1>
          <p className="text-base leading-7 text-[rgba(32,37,41,0.72)]">
            La app de Entusiasmento para tu día a día — accedé más rápido,
            sin buscar el navegador cada vez.
          </p>
        </div>

        {instalado ? (
          <div className="space-y-5 rounded-[1.4rem] border border-[rgba(207,145,48,0.28)] bg-white/60 p-6">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#cf9130] text-[#cf9130]">
              <IconoListo />
            </span>
            <p className="text-lg font-semibold text-[#202529]">
              Ya la tenés instalada.
            </p>
            {/* globals.css tiene un reset "a { color: inherit }" fuera de
                cualquier @layer, que le gana a workspace-button-primary (sí
                está en una @layer) sin importar la especificidad — color
                inline puntual acá en vez de tocar ese reset compartido. */}
            <Link
              href="/casatalentos"
              className="workspace-button-primary"
              style={{ color: "#fff" }}
            >
              Abrir Entusiasmento
            </Link>
          </div>
        ) : plataforma === "ios" ? (
          <div className="space-y-3 text-left">
            <Paso
              numero={1}
              icono={<IconoCompartir />}
              titulo="Tocá Compartir"
              detalle="El ícono con la flecha hacia arriba, en la barra de Safari."
            />
            <Paso
              numero={2}
              icono={<IconoAgregarPantalla />}
              titulo="Elegí «Agregar a inicio»"
              detalle="Va a quedar con su propio ícono en tu pantalla principal."
            />
          </div>
        ) : plataforma === "android" ? (
          puedeInstalarNativo ? (
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-4 rounded-[1.4rem] border border-[rgba(207,145,48,0.28)] bg-white/60 p-5">
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[#cf9130] text-lg font-bold text-[#cf9130]"
                >
                  1
                </span>
                <div className="flex-1 space-y-1.5">
                  <p className="text-lg font-semibold text-[#202529]">
                    Tocá para instalar
                  </p>
                  <p className="text-sm leading-6 text-[rgba(32,37,41,0.72)]">
                    Tu navegador ya puede instalarla directo.
                  </p>
                </div>
                <span aria-hidden className="shrink-0 text-[#cf9130]">
                  <IconoDescargar />
                </span>
              </div>
              <button
                type="button"
                onClick={() => void instalar()}
                className="workspace-button-primary w-full"
              >
                Instalar ahora
              </button>
            </div>
          ) : (
            <div className="space-y-3 text-left">
              <Paso
                numero={1}
                icono={<IconoMenuPuntos />}
                titulo="Abrí el menú de tu navegador"
                detalle="El ícono de los tres puntos, arriba a la derecha."
              />
              <Paso
                numero={2}
                icono={<IconoDescargar />}
                titulo="Elegí «Instalar app»"
                detalle="O «Agregar a pantalla principal», según tu navegador."
              />
            </div>
          )
        ) : (
          <div className="space-y-4 rounded-[1.4rem] border border-[rgba(207,145,48,0.28)] bg-white/60 p-6">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#cf9130] text-[#cf9130]">
              <IconoTelefono />
            </span>
            <p className="text-lg font-semibold text-[#202529]">
              Abrí este link desde tu celular
            </p>
            <p className="text-sm leading-6 text-[rgba(32,37,41,0.72)]">
              La instalación es para el teléfono — desde la computadora no
              hace falta, ya usás la plataforma directo en el navegador.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
