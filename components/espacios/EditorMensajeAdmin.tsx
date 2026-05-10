"use client"

import { useEffect, useRef } from "react"

type Props = {
  value: string
  onChange: (value: string) => void
}

const TIPOGRAFIAS = [
  {
    label: "Sans",
    value: "Arial, Helvetica, sans-serif",
  },
  {
    label: "Serif",
    value: "Georgia, 'Times New Roman', serif",
  },
  {
    label: "Mono",
    value: "'Courier New', Courier, monospace",
  },
  {
    label: "Manuscrita",
    value: "'Trebuchet MS', 'Lucida Handwriting', cursive",
  },
]

function normalizarHtml(html: string) {
  return html === "<br>" ? "" : html
}

export default function EditorMensajeAdmin({ value, onChange }: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const rangoRef = useRef<Range | null>(null)

  useEffect(() => {
    const editor = editorRef.current

    if (!editor) return

    if (editor.innerHTML !== value) {
      editor.innerHTML = value || ""
    }
  }, [value])

  useEffect(() => {
    const guardarSeleccion = () => {
      const editor = editorRef.current
      const selection = window.getSelection()

      if (!editor || !selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)

      if (!editor.contains(range.commonAncestorContainer)) return

      rangoRef.current = range.cloneRange()
    }

    document.addEventListener("selectionchange", guardarSeleccion)

    return () => {
      document.removeEventListener("selectionchange", guardarSeleccion)
    }
  }, [])

  const enfocarEditor = () => {
    const editor = editorRef.current
    if (!editor) return

    editor.focus()
  }

  const restaurarSeleccion = () => {
    const selection = window.getSelection()
    const rango = rangoRef.current

    if (!selection || !rango) return

    selection.removeAllRanges()
    selection.addRange(rango)
  }

  const actualizarValor = () => {
    const editor = editorRef.current
    if (!editor) return

    onChange(normalizarHtml(editor.innerHTML))
  }

  const actualizarValorDiferido = () => {
    window.requestAnimationFrame(() => {
      actualizarValor()
    })
  }

  const ejecutarComando = (command: string, commandValue?: string) => {
    enfocarEditor()
    restaurarSeleccion()
    document.execCommand("styleWithCSS", false, "true")
    document.execCommand(command, false, commandValue)
    actualizarValorDiferido()
  }

  const aplicarTipografia = (fontFamily: string) => {
    ejecutarComando("fontName", fontFamily)
  }

  const manejarKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const usaMod = event.metaKey || event.ctrlKey

    if (!usaMod) return

    const tecla = event.key.toLowerCase()

    if (tecla === "b") {
      event.preventDefault()
      ejecutarComando("bold")
      return
    }

    if (tecla === "i") {
      event.preventDefault()
      ejecutarComando("italic")
    }
  }

  const preservarFocoToolbar = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()
    enfocarEditor()
    restaurarSeleccion()
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <button
          type="button"
          className="border px-3 py-1 rounded"
          onMouseDown={preservarFocoToolbar}
          onClick={() => ejecutarComando("bold")}
        >
          Negrita
        </button>

        <button
          type="button"
          className="border px-3 py-1 rounded italic"
          onMouseDown={preservarFocoToolbar}
          onClick={() => ejecutarComando("italic")}
        >
          Cursiva
        </button>

        <button
          type="button"
          className="border px-3 py-1 rounded"
          onMouseDown={preservarFocoToolbar}
          onClick={() => ejecutarComando("foreColor", "#b91c1c")}
        >
          Rojo
        </button>

        <button
          type="button"
          className="border px-3 py-1 rounded"
          onMouseDown={preservarFocoToolbar}
          onClick={() => ejecutarComando("foreColor", "#1d4ed8")}
        >
          Azul
        </button>

        <button
          type="button"
          className="border px-3 py-1 rounded"
          onMouseDown={preservarFocoToolbar}
          onClick={() => ejecutarComando("foreColor", "#166534")}
        >
          Verde
        </button>

        <button
          type="button"
          className="border px-3 py-1 rounded"
          onMouseDown={preservarFocoToolbar}
          onClick={() => ejecutarComando("formatBlock", "h3")}
        >
          Título
        </button>

        <select
          className="border px-3 py-1 rounded bg-white"
          defaultValue=""
          onMouseDown={preservarFocoToolbar}
          onChange={(e) => {
            if (!e.target.value) return
            aplicarTipografia(e.target.value)
            e.target.value = ""
          }}
        >
          <option value="">Tipografía</option>
          {TIPOGRAFIAS.map((item) => (
            <option key={item.label} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-gray-500">
        Atajos: <strong>Ctrl/Cmd + B</strong> para negrita y{" "}
        <strong>Ctrl/Cmd + I</strong> para cursiva.
      </p>

      <div className="relative">
        {!value.trim() && (
          <div className="pointer-events-none absolute left-4 top-3 text-gray-400">
            Escribí el mensaje para el participante con el formato que necesites.
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          dir="ltr"
          onInput={actualizarValor}
          onKeyDown={manejarKeyDown}
          onMouseUp={actualizarValor}
          onKeyUp={actualizarValor}
          className="min-h-[180px] w-full border rounded-xl p-4 bg-white text-left outline-none focus:ring-2 focus:ring-blue-500 whitespace-pre-wrap"
          style={{
            direction: "ltr",
          }}
        />
      </div>
    </div>
  )
}
