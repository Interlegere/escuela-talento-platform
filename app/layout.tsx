import type { Metadata, Viewport } from "next"
import { Fraunces, Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import Providers from "./providers"
import AppFooter from "@/components/AppFooter"
import AppNav from "@/components/AppNav"
import BarraInferior from "@/components/app/BarraInferior"

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
  title: "ENTHEOS",
  description: "Escuela Norte para el Talento, el Entusiasmo y el Orden de los Sentidos",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
}

// viewportFit: "cover" deja que la página se dibuje hasta los bordes
// reales de la pantalla (debajo del notch/isla dinámica y de la barra de
// gestos) — sin esto, instalada como app, quedan franjas del color por
// defecto del sistema arriba y abajo en vez del fondo de marca. Solo tiene
// efecto real en modo standalone (en Safari normal, el propio navegador ya
// ocupa esas zonas), así que no cambia nada en el navegador.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
      <head>
        {/* Antes de que React hidrate nada: si la app corre instalada en
            iOS vía navigator.standalone (donde a veces
            @media (display-mode: standalone) no alcanza), marca el <html>
            ya mismo — nunca después del primer pintado, para que no haya
            parpadeo del menú viejo antes de esconderse. La media query en
            globals.css sigue siendo el mecanismo principal en todos lados;
            esto es solo el respaldo puntual de iOS. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(window.navigator.standalone===true){document.documentElement.classList.add("ios-standalone")}}catch(e){}',
          }}
        />
      </head>
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
            <AppFooter />
            <BarraInferior />
          </div>
        </Providers>
      </body>
    </html>
  )
}
