"use client"

import { useEffect, useState } from "react"
import { useDeteccionInstalacion } from "@/hooks/useDeteccionInstalacion"

const STORAGE_OCULTO = "entusiasmo_instalar_app_oculto"

export default function InstalarApp() {
  const { mounted, instalado, plataforma, puedeInstalarNativo, instalar } =
    useDeteccionInstalacion()
  const esiOS = plataforma === "ios"
  const [oculto, setOculto] = useState(false)
  const [instruccionesAbiertas, setInstruccionesAbiertas] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setOculto(window.localStorage.getItem(STORAGE_OCULTO) === "1")
      } catch {
        // Sin acceso a localStorage (ej. modo privado estricto): no rompe
        // nada, simplemente no recuerda el descarte entre sesiones.
      }
    })

    return () => window.cancelAnimationFrame(frame)
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

  if (!mounted || instalado || oculto) return null

  // Tres casos: prompt nativo disponible (Android/Chrome, cuando el
  // navegador decide ofrecerlo), iOS (nunca tiene prompt nativo, siempre
  // son pasos manuales), o ningún de los dos — el caso más común en la
  // práctica sin service worker, donde beforeinstallprompt no dispara. Acá
  // también se puede instalar (todo navegador moderno con manifest lo
  // permite desde su propio menú), solo que no hay forma de saber el
  // nombre exacto de la opción de memoria, así que se da la instrucción
  // genérica del menú del navegador en vez de ocultar la banda entera.
  const textoBoton = puedeInstalarNativo ? "Instalar" : "Cómo instalar"

  const manejarClickBoton = () => {
    if (puedeInstalarNativo) {
      void instalar()
      return
    }
    setInstruccionesAbiertas((v) => !v)
  }

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
            onClick={manejarClickBoton}
            className="workspace-button-secondary px-3 py-1.5 text-xs"
          >
            {textoBoton}
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

      {!puedeInstalarNativo && instruccionesAbiertas && (
        <p className="text-gray-700">
          {esiOS ? (
            <>
              Tocá <strong>Compartir</strong> (el ícono con la flecha hacia
              arriba) y después <strong>Agregar a inicio</strong>.
            </>
          ) : (
            <>
              Abrí el menú del navegador (⋮) y elegí{" "}
              <strong>«Instalar app»</strong> o{" "}
              <strong>«Agregar a pantalla principal»</strong>.
            </>
          )}
        </p>
      )}
    </div>
  )
}
