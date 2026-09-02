"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAppSession } from "@/components/auth/AppSessionProvider"

export default function AppNav() {
  const { data: session } = useAppSession()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [campusMode, setCampusMode] = useState<"default" | "charla-only">(
    "default"
  )
  const [hayNovedadEntusiasmo, setHayNovedadEntusiasmo] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMounted(true)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [])

  const role = session?.user?.role || "participante"
  const esAdmin = role === "admin"
  // Rutas públicas (sin sesión): la web institucional en la raíz, la landing,
  // el login, y la página de instalación de la app. Landing/raíz traen su
  // propio encabezado (LandingPublicNav); login y /app traen su propia marca
  // chica — en las cuatro, la fila completa de links de la plataforma no le
  // sirve a nadie que todavía no inició sesión, y en el celular solo empuja
  // el contenido real más abajo. /app en particular está pensada para abrirse
  // desde un link de WhatsApp en el celular, una sola pantalla sin nada más.
  const esRutaPublicaSinNav =
    pathname === "/landing" ||
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/app"

  useEffect(() => {
    if (!session) return

    let cancelado = false

    const cargarNovedadEntusiasmo = async () => {
      try {
        const res = await fetch("/api/entusiasmo/nav-resumen", { cache: "no-store" })
        if (!res.ok || cancelado) return
        const data = (await res.json()) as { hayAlgoQueRevisar?: boolean }
        if (!cancelado) setHayNovedadEntusiasmo(Boolean(data.hayAlgoQueRevisar))
      } catch {
        if (!cancelado) setHayNovedadEntusiasmo(false)
      }
    }

    // Se vuelve a pedir en cada cambio de ruta (además de al loguearse) —
    // AppNav vive en el layout raíz y no se remonta al navegar, así que sin
    // esto el punto quedaba pegado con el valor de la primera carga aunque
    // adentro de Entusiasmento ya se hubiera marcado todo como leído.
    void cargarNovedadEntusiasmo()
    window.addEventListener("entusiasmo-lectura-actualizada", cargarNovedadEntusiasmo)

    return () => {
      cancelado = true
      window.removeEventListener("entusiasmo-lectura-actualizada", cargarNovedadEntusiasmo)
    }
  }, [session, pathname])

  useEffect(() => {
    if (!session || esAdmin) {
      return
    }

    let cancelado = false

    const cargarResumen = async () => {
      try {
        const res = await fetch("/api/me/resumen-accesos", {
          cache: "no-store",
        })

        if (!res.ok) return

        const data = (await res.json()) as {
          usuario?: { charlaIntroHabilitada?: boolean }
          accesos?: Array<{ slug: string; acceso: boolean }>
        }

        if (cancelado) return

        const tieneActividades = (data.accesos || []).some(
          (item) => item.acceso === true
        )

        setCampusMode(
          data.usuario?.charlaIntroHabilitada === true && !tieneActividades
            ? "charla-only"
            : "default"
        )
      } catch {
        if (!cancelado) {
          setCampusMode("default")
        }
      }
    }

    void cargarResumen()

    return () => {
      cancelado = true
    }
  }, [esAdmin, session])

  const campusModeActivo =
    !session || esAdmin ? "default" : campusMode

  if (esRutaPublicaSinNav) {
    return null
  }

  const links = esAdmin
    ? [
        { href: "/agenda", label: "Agenda" },
        { href: "/admin/consentimientos", label: "Admin Consentimientos" },
        { href: "/admin/usuarios", label: "Admin Usuarios" },
        { href: "/admin/comunicaciones", label: "Comunicaciones" },
        { href: "/casatalentos", label: "Entusiasmento" },
        { href: "/conectando-sentidos", label: "Conectando Sentidos" },
        { href: "/mentorias", label: "Mentorías" },
        { href: "/terapia", label: "Terapia" },
        { href: "/perfil", label: "Perfil" },
        { href: "/login", label: "Login" },
      ]
    : campusModeActivo === "charla-only"
      ? [
          { href: "/campus", label: "Campus" },
          { href: "/perfil", label: "Perfil" },
          { href: "/login", label: "Login" },
        ]
    : [
        { href: "/campus", label: "Campus" },
        { href: "/casatalentos", label: "Entusiasmento" },
        { href: "/conectando-sentidos", label: "Conectando Sentidos" },
        { href: "/terapia", label: "Terapia" },
        { href: "/pagos", label: "Pagos" },
        { href: "/perfil", label: "Perfil" },
        { href: "/login", label: "Login" },
      ]

  const renderLink = (link: { href: string; label: string }, mobile: boolean) => {
    const activo =
      mounted &&
      (pathname === link.href ||
        (link.href !== "/" && pathname?.startsWith(link.href)))

    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={mobile ? () => setMenuAbierto(false) : undefined}
        className={`relative rounded-full px-4 py-2 text-sm font-semibold transition ${
          mobile ? "block w-full text-left" : "shrink-0"
        } ${
          activo
            ? "border border-[rgba(255,255,255,0.82)] bg-[rgba(255,255,255,0.58)] text-[var(--foreground)] shadow-[0_14px_28px_rgba(55,42,28,0.12)] backdrop-blur-md"
            : "border border-[rgba(102,86,62,0.14)] bg-[rgba(255,250,242,0.62)] text-[rgba(29,35,40,0.82)] hover:border-[var(--line-strong)] hover:bg-[rgba(255,247,235,0.94)]"
        }`}
      >
        {link.label}
        {link.href === "/casatalentos" && hayNovedadEntusiasmo && (
          <span
            aria-label="Hay novedades en Entusiasmento"
            title="Hay novedades en Entusiasmento"
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500"
          />
        )}
      </Link>
    )
  }

  return (
    <nav className="app-main-nav relative z-40 px-3 pt-3 sm:px-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 rounded-[1.6rem] border border-[var(--line)] bg-[rgba(253,247,236,0.78)] px-3 py-3 shadow-[0_18px_40px_rgba(55,42,28,0.08)] backdrop-blur-2xl sm:px-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/landing"
            className="group flex items-center gap-3 rounded-[1.2rem] px-1 py-1"
          >
            <span
              className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.15rem] border border-[rgba(205,147,58,0.28)] bg-[rgba(255,252,245,0.72)] shadow-[0_12px_28px_rgba(55,42,28,0.1)] transition group-hover:-translate-y-0.5"
            >
              <Image
                src="/interlegere-icono.png"
                alt="Logo"
                width={56}
                height={56}
                className="h-full w-full object-contain mix-blend-multiply"
                priority
              />
            </span>
            <span className="min-w-0">
              <span
                className="block text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--sea)]"
              >
                Escuela
              </span>
              <span
                className="font-display block truncate text-[1.72rem] font-normal leading-none tracking-[-0.03em] text-[var(--foreground)]"
              >
                ENTHEOS
              </span>
            </span>
          </Link>

          {/* Botón de menú, solo en pantallas angostas — en desktop la fila
              de links de abajo siempre está visible, no hace falta. */}
          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-expanded={menuAbierto}
            aria-controls="app-nav-links-mobile"
            aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(102,86,62,0.14)] bg-[rgba(255,250,242,0.62)] text-lg text-[var(--foreground)] transition hover:border-[var(--line-strong)] lg:hidden"
          >
            <span aria-hidden>{menuAbierto ? "✕" : "☰"}</span>
            {hayNovedadEntusiasmo && !menuAbierto && (
              <span
                aria-hidden
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500"
              />
            )}
          </button>
        </div>

        {/* Desktop (lg+): fila horizontal siempre visible, sin cambios de
            comportamiento respecto a como estaba antes. */}
        <div className="hidden lg:flex lg:flex-wrap lg:items-center lg:justify-end lg:gap-2">
          {links.map((link) => renderLink(link, false))}
        </div>

        {/* Celular/tablet angosta: lista vertical desplegable, en vez de la
            fila horizontal con scroll que escondía la mayoría de los links
            sin ningún aviso. */}
        {menuAbierto && (
          <div id="app-nav-links-mobile" className="flex flex-col gap-2 lg:hidden">
            {links.map((link) => renderLink(link, true))}
          </div>
        )}
      </div>
    </nav>
  )
}
