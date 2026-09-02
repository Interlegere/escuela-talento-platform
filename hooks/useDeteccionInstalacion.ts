"use client"

import { useEffect, useState } from "react"

// Compartido entre components/InstalarApp.tsx (la banda dentro de
// Entusiasmento) y app/app/page.tsx (la página pública de instalación) —
// única fuente de verdad para "en qué está corriendo esto" y "se puede
// disparar el prompt nativo de instalación ahora mismo".

export type PlataformaInstalacion = "ios" | "android" | "escritorio"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function estaStandalone() {
  if (typeof window === "undefined") return false

  const navegadorConStandalone = window.navigator as Navigator & {
    standalone?: boolean
  }

  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    navegadorConStandalone.standalone === true
  )
}

function esIOS() {
  if (typeof window === "undefined") return false

  const ua = window.navigator.userAgent

  return (
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ se identifica como Mac, pero soporta touch.
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1)
  )
}

function esAndroid() {
  if (typeof window === "undefined") return false

  return /android/i.test(window.navigator.userAgent)
}

function detectarPlataforma(): PlataformaInstalacion {
  if (esIOS()) return "ios"
  if (esAndroid()) return "android"
  return "escritorio"
}

export function useDeteccionInstalacion() {
  const [mounted, setMounted] = useState(false)
  const [instalado, setInstalado] = useState(false)
  const [plataforma, setPlataforma] = useState<PlataformaInstalacion>("escritorio")
  const [promptDiferido, setPromptDiferido] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // setState no se llama de forma síncrona en el cuerpo del efecto (dispara
    // el lint react-hooks/set-state-in-effect) — se difiere un frame, mismo
    // patrón ya usado en AppNav para su propio flag "mounted".
    const frame = window.requestAnimationFrame(() => {
      setMounted(true)
      setInstalado(estaStandalone())
      setPlataforma(detectarPlataforma())
    })

    const manejarPrompt = (evento: Event) => {
      evento.preventDefault()
      setPromptDiferido(evento as BeforeInstallPromptEvent)
    }

    const manejarAppInstalada = () => setInstalado(true)

    window.addEventListener("beforeinstallprompt", manejarPrompt)
    window.addEventListener("appinstalled", manejarAppInstalada)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("beforeinstallprompt", manejarPrompt)
      window.removeEventListener("appinstalled", manejarAppInstalada)
    }
  }, [])

  const instalar = async () => {
    if (!promptDiferido) return

    await promptDiferido.prompt()
    await promptDiferido.userChoice
    setPromptDiferido(null)
  }

  return {
    mounted,
    instalado,
    plataforma,
    puedeInstalarNativo: Boolean(promptDiferido),
    instalar,
  }
}
