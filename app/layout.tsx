import type { Metadata } from "next"
import { Fraunces, Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import Providers from "./providers"
import AppNav from "@/components/AppNav"
import Link from "next/link"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Entheos",
  description: "Escuela de trabajo, proceso y creación compartida",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col ux-atelier">
        <Providers>
          <div className="relative flex min-h-full flex-col">
            <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
              <div className="absolute left-[-9rem] top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-[rgba(205,147,58,0.2)] blur-3xl" />
              <div className="absolute right-[-10rem] top-12 h-[30rem] w-[30rem] rounded-full bg-[rgba(47,109,115,0.16)] blur-3xl" />
              <div className="absolute bottom-[-12rem] left-1/4 h-[28rem] w-[28rem] rounded-full bg-[rgba(85,108,97,0.16)] blur-3xl" />
              <div className="absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,rgba(255,253,247,0.74),transparent)]" />
            </div>

            <AppNav />
            <div className="flex-1">{children}</div>
            <footer className="border-t border-[var(--line)] bg-[rgba(253,247,236,0.78)] px-6 py-5 text-sm text-[var(--muted)] backdrop-blur-xl">
              <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Entheos · Escuela de trabajo, proceso y creación compartida.
                </p>
                <Link
                  href="/terminos-y-condiciones"
                  className="font-medium underline underline-offset-4"
                >
                  Términos y Condiciones
                </Link>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  )
}
