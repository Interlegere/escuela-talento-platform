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

  useEffect(() => {
    const editor = editorRef.current

    if (!editor) return

    if (editor.innerHTML !== value) {
      editor.innerHTML = value || ""
    }
  }, [value])

  const enfocarEditor = () => {
    const editor = editorRef.current
    if (!editor) return

    editor.focus()
  }

  const actualizarValor = () => {
    const editor = editorRef.current
    if (!editor) return

    onChange(normalizarHtml(editor.innerHTML))
  }

  const ejecutarComando = (command: string, commandValue?: string) => {
    enfocarEditor()
    document.execCommand("styleWithCSS", false, "true")
    document.execCommand(command, false, commandValue)
    actualizarValor()
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

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <button
          type="button"
          className="border px-3 py-1 rounded"
          onClick={() => ejecutarComando("bold")}
        >
          Negrita
        </button>

        <button
          type="button"
          className="border px-3 py-1 rounded italic"
          onClick={() => ejecutarComando("italic")}
        >
          Cursiva
        </button>

        <button
          type="button"
          className="border px-3 py-1 rounded"
          onClick={() => ejecutarComando("foreColor", "#b91c1c")}
        >
          Rojo
        </button>

        <button
          type="button"
          className="border px-3 py-1 rounded"
          onClick={() => ejecutarComando("foreColor", "#1d4ed8")}
        >
          Azul
        </button>

        <button
          type="button"
          className="border px-3 py-1 rounded"
          onClick={() => ejecutarComando("foreColor", "#166534")}
        >
          Verde
        </button>

        <button
          type="button"
          className="border px-3 py-1 rounded"
          onClick={() => ejecutarComando("formatBlock", "h3")}
        >
          Título
        </button>

        <select
          className="border px-3 py-1 rounded bg-white"
          defaultValue=""
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
          className="min-h-[180px] w-full border rounded-xl p-4 bg-white text-left outline-none focus:ring-2 focus:ring-blue-500 whitespace-pre-wrap"
          style={{
            direction: "ltr",
          }}
        />
      </div>
    </div>
  )
}
