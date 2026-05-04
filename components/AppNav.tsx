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

  const links = esAdmin
    ? [
        { href: "/agenda", label: "Agenda" },
        { href: "/admin/consentimientos", label: "Admin Consentimientos" },
        { href: "/admin/pagos", label: "Admin Pagos" },
        { href: "/admin/usuarios", label: "Admin Usuarios" },
        { href: "/admin/casatalentos", label: "CasaTalentos" },
        { href: "/admin/conectando-sentidos", label: "Conectando Sentidos" },
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
        { href: "/casatalentos", label: "CasaTalentos" },
        { href: "/conectando-sentidos", label: "Conectando Sentidos" },
        { href: "/mentorias", label: "Mentorías" },
        { href: "/terapia", label: "Terapia" },
        { href: "/pagos", label: "Pagos" },
        { href: "/perfil", label: "Perfil" },
        { href: "/login", label: "Login" },
      ]

  return (
    <nav className="app-main-nav relative z-40 px-3 pt-3 sm:px-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 rounded-[1.6rem] border border-[var(--line)] bg-[rgba(253,247,236,0.78)] px-3 py-3 shadow-[0_18px_40px_rgba(55,42,28,0.08)] backdrop-blur-2xl sm:px-4 lg:flex-row lg:items-center lg:justify-between">
        <Link
          href="/landing"
          className="group flex items-center gap-3 rounded-[1.2rem] px-1 py-1"
        >
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.15rem] border border-[rgba(205,147,58,0.28)] bg-[rgba(255,252,245,0.72)] shadow-[0_12px_28px_rgba(55,42,28,0.1)] transition group-hover:-translate-y-0.5">
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
            <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--sea)]">
              Escuela
            </span>
            <span className="font-display block truncate text-[1.72rem] font-normal leading-none tracking-[-0.03em] text-[var(--foreground)]">
              Entheos
            </span>
          </span>
        </Link>

        <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:justify-end lg:overflow-visible lg:pb-0">
          {links.map((link) => {
            const activo =
              mounted &&
              (pathname === link.href ||
                (link.href !== "/" && pathname?.startsWith(link.href)))

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activo
                    ? "border border-[rgba(255,255,255,0.82)] bg-[rgba(255,255,255,0.58)] text-[var(--foreground)] shadow-[0_14px_28px_rgba(55,42,28,0.12)] backdrop-blur-md"
                    : "border border-[rgba(102,86,62,0.14)] bg-[rgba(255,250,242,0.62)] text-[rgba(29,35,40,0.82)] hover:border-[var(--line-strong)] hover:bg-[rgba(255,247,235,0.94)]"
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
