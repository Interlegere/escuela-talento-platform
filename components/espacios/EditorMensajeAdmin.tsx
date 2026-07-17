"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { flushSync } from "react-dom"

type UploadedAsset = {
  url: string
  name: string
  mimeType?: string | null
}

type Props = {
  value: string
  onChange: (value: string) => void
  onUploadImage?: (file: File) => Promise<UploadedAsset>
  onUploadFile?: (file: File) => Promise<UploadedAsset>
}

export type EditorMensajeAdminHandle = {
  getHtml: () => string
  getText: () => string
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

function escaparHtml(valor: string) {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const EditorMensajeAdmin = forwardRef<EditorMensajeAdminHandle, Props>(
  function EditorMensajeAdmin({ value, onChange, onUploadImage, onUploadFile }, ref) {
    const editorRef = useRef<HTMLDivElement | null>(null)
    const rangoRef = useRef<Range | null>(null)
    const inputImagenRef = useRef<HTMLInputElement | null>(null)
    const inputArchivoRef = useRef<HTMLInputElement | null>(null)
    const [subiendo, setSubiendo] = useState<"imagen" | "archivo" | null>(null)
    const [uploadError, setUploadError] = useState("")

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

      const htmlActual = normalizarHtml(editor.innerHTML)

      flushSync(() => {
        onChange(htmlActual)
      })
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

    const insertarHtml = (html: string) => {
      enfocarEditor()
      restaurarSeleccion()
      document.execCommand("insertHTML", false, html)
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

    const manejarSeleccionImagen = async (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      const file = event.target.files?.[0]
      event.target.value = ""

      if (!file || !onUploadImage) return

      try {
        setUploadError("")
        setSubiendo("imagen")
        const asset = await onUploadImage(file)
        insertarHtml(
          `<figure style="margin: 1rem 0;"><img src="${escaparHtml(asset.url)}" alt="${escaparHtml(asset.name)}" style="max-width: 100%; height: auto; border-radius: 16px; display: block;" /></figure><p><br></p>`
        )
      } catch (error) {
        setUploadError(
          error instanceof Error
            ? error.message
            : "No se pudo subir la imagen."
        )
      } finally {
        setSubiendo(null)
      }
    }

    const manejarSeleccionArchivo = async (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      const file = event.target.files?.[0]
      event.target.value = ""

      if (!file || !onUploadFile) return

      try {
        setUploadError("")
        setSubiendo("archivo")
        const asset = await onUploadFile(file)
        insertarHtml(
          `<p><a href="${escaparHtml(asset.url)}" target="_blank" rel="noreferrer">${escaparHtml(asset.name)}</a></p><p><br></p>`
        )
      } catch (error) {
        setUploadError(
          error instanceof Error
            ? error.message
            : "No se pudo adjuntar el archivo."
        )
      } finally {
        setSubiendo(null)
      }
    }

    useImperativeHandle(
      ref,
      () => ({
        getHtml: () => {
          const editor = editorRef.current
          return editor ? normalizarHtml(editor.innerHTML) : ""
        },
        getText: () => {
          const editor = editorRef.current
          if (!editor) return ""
          return (editor.innerText || editor.textContent || "").trim()
        },
      }),
      []
    )

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

          {onUploadImage && (
            <>
              <input
                ref={inputImagenRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void manejarSeleccionImagen(event)}
              />
              <button
                type="button"
                className="border px-3 py-1 rounded"
                onMouseDown={preservarFocoToolbar}
                onClick={() => inputImagenRef.current?.click()}
                disabled={subiendo !== null}
              >
                {subiendo === "imagen" ? "Subiendo imagen..." : "Insertar imagen"}
              </button>
            </>
          )}

          {onUploadFile && (
            <>
              <input
                ref={inputArchivoRef}
                type="file"
                accept=".pdf,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,image/*"
                className="hidden"
                onChange={(event) => void manejarSeleccionArchivo(event)}
              />
              <button
                type="button"
                className="border px-3 py-1 rounded"
                onMouseDown={preservarFocoToolbar}
                onClick={() => inputArchivoRef.current?.click()}
                disabled={subiendo !== null}
              >
                {subiendo === "archivo" ? "Adjuntando..." : "Adjuntar archivo"}
              </button>
            </>
          )}
        </div>

      <p className="text-xs text-gray-500">
        Atajos: <strong>Ctrl/Cmd + B</strong> para negrita y{" "}
        <strong>Ctrl/Cmd + I</strong> para cursiva.
      </p>

      {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

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
)

export default EditorMensajeAdmin
