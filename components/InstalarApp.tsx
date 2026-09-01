"use client"

import { useEffect, useState } from "react"

const STORAGE_OCULTO = "entusiasmo_instalar_app_oculto"

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

export default function InstalarApp() {
  const [mounted, setMounted] = useState(false)
  const [instalado, setInstalado] = useState(false)
  const [esiOS, setEsiOS] = useState(false)
  const [promptDiferido, setPromptDiferido] = useState<BeforeInstallPromptEvent | null>(null)
  const [oculto, setOculto] = useState(false)
  const [instruccionesAbiertas, setInstruccionesAbiertas] = useState(false)

  useEffect(() => {
    // setState no se llama de forma síncrona en el cuerpo del efecto (dispara
    // el lint react-hooks/set-state-in-effect) — se difiere un frame, mismo
    // patrón ya usado en AppNav para su propio flag "mounted".
    const frame = window.requestAnimationFrame(() => {
      setMounted(true)
      setInstalado(estaStandalone())
      setEsiOS(esIOS())

      try {
        setOculto(window.localStorage.getItem(STORAGE_OCULTO) === "1")
      } catch {
        // Sin acceso a localStorage (ej. modo privado estricto): no rompe nada,
        // simplemente no recuerda el descarte entre sesiones.
      }
    })

    const manejarPrompt = (evento: Event) => {
      evento.preventDefault()
      setPromptDiferido(evento as BeforeInstallPromptEvent)
    }

    window.addEventListener("beforeinstallprompt", manejarPrompt)
    window.addEventListener("appinstalled", () => setInstalado(true))

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("beforeinstallprompt", manejarPrompt)
    }
  }, [])

  const descartar = () => {
    setOculto(true)
    setInstruccionesAbiertas(false)
    try {
      window.localStorage.setItem(STORAGE_OCULTO, "1")
    } catch {
      // Igual que arriba: si no hay localStorage disponible, se descarta
      // solo para esta sesión.
    }
  }

  const instalar = async () => {
    if (!promptDiferido) return

    await promptDiferido.prompt()
    await promptDiferido.userChoice
    setPromptDiferido(null)
  }

  if (!mounted || instalado || oculto) return null

  const puedeInstalarNativo = Boolean(promptDiferido)

  if (!puedeInstalarNativo && !esiOS) return null

  // Banda compacta, en el flujo normal del documento (no "fixed") — a
  // propósito: un widget flotante sobre una página larga y con contenido a
  // todo lo ancho (probado en vivo) termina tapando algo real en algún
  // punto del scroll pase lo que pase la esquina que se elija. En el flujo
  // normal nunca tapa nada; solo agrega su propia altura chica una vez,
  // arriba de todo, que es lo esperado al montarse ahí.
  return (
    <div className="workspace-panel-soft mb-4 space-y-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span aria-hidden className="text-lg">
            📲
          </span>
          Instalá ENTHEOS en tu celular para acceder más rápido.
        </span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (esiOS ? setInstruccionesAbiertas((v) => !v) : void instalar())}
            className="workspace-button-secondary px-3 py-1.5 text-xs"
          >
            {esiOS ? "Cómo instalar" : "Instalar"}
          </button>
          <button
            type="button"
            onClick={descartar}
            aria-label="Cerrar"
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </span>
      </div>

      {esiOS && instruccionesAbiertas && (
        <p className="text-gray-700">
          Tocá <strong>Compartir</strong> (el ícono con la flecha hacia
          arriba) y después <strong>Agregar a inicio</strong>.
        </p>
      )}
    </div>
  )
}
