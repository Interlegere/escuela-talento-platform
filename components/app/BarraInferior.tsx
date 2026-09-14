"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { IconoCanasto, IconoMaceta } from "@/components/app/iconos"

// Mismo criterio que la familia de components/app/iconos.tsx, pero se
// queda acá — no hace falta en ningún otro lugar de la página.
function IconoPerfil({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6" />
    </svg>
  )
}

const DESTINOS = [
  {
    key: "mi-espacio",
    // Con ?destino=mi-espacio explícito (no solo /casatalentos a secas):
    // sin esto, volver desde CoFruto tocando este botón no alcanzaba a
    // pisar lo persistido (que seguía en "cofruto"), y el contenido no
    // cambiaba aunque el botón sí se marcara activo.
    href: "/casatalentos?destino=mi-espacio",
    label: "Mi espacio",
    icono: IconoMaceta,
    activo: (pathname: string, destino: string | null) =>
      pathname === "/casatalentos" && destino !== "cofruto",
  },
  {
    key: "cofruto",
    href: "/casatalentos?destino=cofruto",
    label: "CoFruto",
    icono: IconoCanasto,
    activo: (pathname: string, destino: string | null) =>
      pathname === "/casatalentos" && destino === "cofruto",
  },
  {
    key: "perfil",
    href: "/perfil",
    label: "Perfil",
    icono: IconoPerfil,
    activo: (pathname: string) => pathname === "/perfil",
  },
] as const

// Mismas rutas públicas que AppNav/AppFooter (ver esos dos componentes) —
// antes de iniciar sesión esta barra no le sirve a nadie.
function esRutaPublicaSinNav(pathname: string | null) {
  return (
    pathname === "/landing" ||
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/app" ||
    (pathname?.startsWith("/proyecto-inposible") ?? false)
  )
}

// El resaltado de "Mi espacio" vs. "CoFruto" se basa en el ?destino de la
// URL — cubre bien el caso real (tocar esta barra) sin acoplarse a la
// clave de localStorage que persiste /casatalentos (que además resuelve
// en un momento distinto, ligado a cuándo carga la sesión ahí). Límite
// conocido, aceptado para esta primera tanda: si alguien cambia de
// destino con el selector de adentro de la página sin volver a tocar
// esta barra, el resaltado no se entera hasta la próxima navegación.
function BarraInferiorContenido() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const destinoParam = searchParams.get("destino")
  const [hayNovedadEntusiasmo, setHayNovedadEntusiasmo] = useState(false)
  const oculta = esRutaPublicaSinNav(pathname)

  // Mismo endpoint y mismo evento que ya usa AppNav para el puntito rojo
  // de Entusiasmento — acá se refleja sobre "Mi espacio", que es adonde
  // ese aviso lleva en este nivel de navegación.
  useEffect(() => {
    if (oculta) return

    let cancelado = false

    const cargar = async () => {
      try {
        const res = await fetch("/api/entusiasmo/nav-resumen", { cache: "no-store" })
        if (!res.ok || cancelado) return
        const data = (await res.json()) as { hayAlgoQueRevisar?: boolean }
        if (!cancelado) setHayNovedadEntusiasmo(Boolean(data.hayAlgoQueRevisar))
      } catch {
        if (!cancelado) setHayNovedadEntusiasmo(false)
      }
    }

    void cargar()
    window.addEventListener("entusiasmo-lectura-actualizada", cargar)

    return () => {
      cancelado = true
      window.removeEventListener("entusiasmo-lectura-actualizada", cargar)
    }
  }, [oculta, pathname])

  if (oculta) return null

  return (
    <nav
      className="app-bottom-bar fixed inset-x-0 bottom-0 z-40 justify-around border-t border-[var(--line)] bg-[var(--surface-strong)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegación de la app"
    >
      {DESTINOS.map((destino) => {
        const Icono = destino.icono
        const activo = destino.activo(pathname || "", destinoParam)

        return (
          <Link
            key={destino.key}
            href={destino.href}
            // Sin esto, cada toque agrega una entrada al historial y el
            // gesto de volver del celular desanda solapas en vez de salir
            // de verdad de la app instalada.
            replace
            className="relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[0.68rem] font-semibold"
            style={{ color: activo ? "var(--accent)" : "var(--muted)" }}
          >
            <Icono className="h-5 w-5" />
            {destino.label}
            {destino.key === "mi-espacio" && hayNovedadEntusiasmo && (
              <span
                aria-label="Hay novedades en Entusiasmento"
                className="absolute right-[30%] top-1 h-2 w-2 rounded-full bg-rose-500"
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}

// useSearchParams() pide un límite de Suspense — se lo da acá mismo, a
// nivel de componente, para no arrastrar esa exigencia a todo el layout
// raíz (que se monta en cada página, incluidas las que hoy se sirven
// estáticas). El fallback es null: mientras se resuelve, simplemente no
// hay barra todavía, un instante que en la práctica no se nota.
export default function BarraInferior() {
  return (
    <Suspense fallback={null}>
      <BarraInferiorContenido />
    </Suspense>
  )
}
