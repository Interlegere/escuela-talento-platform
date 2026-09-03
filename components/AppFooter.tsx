"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export default function AppFooter() {
  const pathname = usePathname()

  // Igual que AppNav: las rutas públicas (raíz institucional, landing, y la
  // página de instalación pensada para abrirse desde WhatsApp) traen su
  // propio pie de página o directamente no llevan ninguno.
  if (
    pathname === "/landing" ||
    pathname === "/" ||
    pathname === "/app" ||
    pathname.startsWith("/proyecto-inposible")
  ) {
    return null
  }

  return (
    <footer className="border-t border-[var(--line)] bg-[rgba(253,247,236,0.78)] px-6 py-5 text-sm text-[var(--muted)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>ENTHEOS · Escuela de trabajo, proceso y creación compartida.</p>
        <Link
          href="/terminos-y-condiciones"
          className="font-medium underline underline-offset-4"
        >
          Términos y Condiciones
        </Link>
      </div>
    </footer>
  )
}
