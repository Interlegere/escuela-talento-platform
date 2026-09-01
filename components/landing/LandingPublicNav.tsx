"use client"

import Image from "next/image"
import Link from "next/link"
import { Alef } from "next/font/google"

const alef = Alef({
  subsets: ["latin"],
  weight: ["400", "700"],
})

export default function LandingPublicNav() {
  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-[1.125rem] transition hover:-translate-y-0.5 motion-reduce:transition-none"
          aria-label="Ir al inicio de ENTHEOS"
        >
          <span className="flex h-16 w-16 items-center justify-center overflow-hidden sm:h-[4.75rem] sm:w-[4.75rem]">
            <Image
              src="/interlegere-icono-transparente.png"
              alt="Logo ENTHEOS"
              width={96}
              height={96}
              unoptimized
              className="h-full w-full object-contain"
              priority
            />
          </span>
          <span className={`${alef.className} block min-w-0 text-xl font-bold tracking-[0.16em] text-[#071a2f] sm:text-[1.35rem]`}>
            ENTHEOS
          </span>
        </Link>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[rgba(54,48,39,0.1)] bg-[rgba(255,252,246,0.82)] px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#1d2328] shadow-[0_14px_34px_rgba(50,37,20,0.08)] transition hover:-translate-y-0.5 motion-reduce:transition-none sm:px-5"
          >
            Ingresar
          </Link>
        </div>
      </div>
    </header>
  )
}
