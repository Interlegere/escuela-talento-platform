"use client"

import { useEffect, useState } from "react"
import BibliotecaGrabaciones from "@/components/BibliotecaGrabaciones"
import SeccionDesplegable from "@/components/SeccionDesplegable"
import { isDevelopmentPreviewEnabled } from "@/lib/dev-flags"

type Grabacion = {
  id: number
  titulo: string
  descripcion?: string | null
  drive_url: string
  drive_file_id?: string | null
  fecha?: string | null
  visible: boolean
  actividades?: {
    id: number
    slug: string
    nombre: string
  } | null
}

type EditandoState = {
  id: number
  titulo: string
  descripcion: string
  driveUrl: string
  fecha: string
  visible: boolean
} | null

function formatearFecha(fecha?: string | null) {
  if (!fecha) return ""
  const date = new Date(fecha)
  if (Number.isNaN(date.getTime())) return fecha

  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export default function ConectandoAdminPanel() {
  const [grabaciones, setGrabaciones] = useState<Grabacion[]>([])
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState("")

  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [driveUrl, setDriveUrl] = useState("")
  const [fecha, setFecha] = useState("")
  const [visible, setVisible] = useState(true)

  const [editando, setEditando] = useState<EditandoState>(null)

  const cargar = async () => {
    try {
      setCargando(true)
      setMensaje("")

      const res = await fetch("/api/admin/grabaciones/listar")
      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudieron cargar las grabaciones.")
        return
      }

      setGrabaciones(
        ((data.grabaciones || []) as Grabacion[]).filter(
          (item) => item.actividades?.slug === "conectando-sentidos"
        )
      )
    } catch {
      setMensaje("Error cargando grabaciones.")
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargar()
  }, [])

  const crearGrabacion = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setGuardando(true)
      setMensaje("")

      const res = await fetch("/api/admin/grabaciones/crear", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          titulo,
          descripcion,
          actividadSlug: "conectando-sentidos",
          driveUrl,
          fecha,
          visible,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudo crear la grabación.")
        return
      }

      setTitulo("")
      setDescripcion("")
      setDriveUrl("")
      setFecha("")
      setVisible(true)
      setMensaje("Grabación creada correctamente.")
      await cargar()
    } catch {
      setMensaje("Error creando grabación.")
    } finally {
      setGuardando(false)
    }
  }

  const cambiarVisible = async (grabacionId: number, nuevoValor: boolean) => {
    try {
      setMensaje("")

      const res = await fetch("/api/admin/grabaciones/toggle-visible", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grabacionId,
          visible: nuevoValor,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudo actualizar la visibilidad.")
        return
      }

      await cargar()
    } catch {
      setMensaje("Error actualizando visibilidad.")
    }
  }

  const iniciarEdicion = (grabacion: Grabacion) => {
    setEditando({
      id: grabacion.id,
      titulo: grabacion.titulo,
      descripcion: grabacion.descripcion || "",
      driveUrl: grabacion.drive_url,
      fecha: grabacion.fecha || "",
      visible: grabacion.visible,
    })
  }

  const guardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editando) return

    try {
      setGuardando(true)
      setMensaje("")

      const res = await fetch("/api/admin/grabaciones/actualizar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grabacionId: editando.id,
          titulo: editando.titulo,
          descripcion: editando.descripcion,
          driveUrl: editando.driveUrl,
          fecha: editando.fecha,
          visible: editando.visible,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudo actualizar la grabación.")
        return
      }

      setMensaje("Grabación actualizada correctamente.")
      setEditando(null)
      await cargar()
    } catch {
      setMensaje("Error actualizando grabación.")
    } finally {
      setGuardando(false)
    }
  }

  const renderListaGrabaciones = () => {
    return grabaciones.map((grabacion) => {
      const estaEditando = editando?.id === grabacion.id

      if (estaEditando && editando) {
        return (
          <form
            key={grabacion.id}
            onSubmit={guardarEdicion}
            className="border rounded-xl p-4 space-y-3"
          >
            <input
              className="w-full border rounded-xl p-3"
              value={editando.titulo}
              onChange={(e) =>
                setEditando((prev) =>
                  prev ? { ...prev, titulo: e.target.value } : prev
                )
              }
            />

            <textarea
              className="w-full border rounded-xl p-3 min-h-[90px]"
              value={editando.descripcion}
              onChange={(e) =>
                setEditando((prev) =>
                  prev ? { ...prev, descripcion: e.target.value } : prev
                )
              }
            />

            <input
              className="w-full border rounded-xl p-3"
              value={editando.driveUrl}
              onChange={(e) =>
                setEditando((prev) =>
                  prev ? { ...prev, driveUrl: e.target.value } : prev
                )
              }
            />

            <input
              type="date"
              className="w-full border rounded-xl p-3"
              value={editando.fecha}
              onChange={(e) =>
                setEditando((prev) =>
                  prev ? { ...prev, fecha: e.target.value } : prev
                )
              }
            />

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editando.visible}
                onChange={(e) =>
                  setEditando((prev) =>
                    prev ? { ...prev, visible: e.target.checked } : prev
                  )
                }
              />
              Visible
            </label>

            <div className="flex gap-3 flex-wrap">
              <button
                type="submit"
                disabled={guardando}
                className="bg-black text-white px-4 py-2 rounded-xl disabled:opacity-60"
              >
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>

              <button
                type="button"
                onClick={() => setEditando(null)}
                className="border px-4 py-2 rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </form>
        )
      }

      return (
        <div key={grabacion.id} className="border rounded-xl p-4 space-y-2">
          <p className="font-medium">{grabacion.titulo}</p>
          <p className="text-sm text-gray-500">{formatearFecha(grabacion.fecha)}</p>
          {grabacion.descripcion && (
            <p className="text-sm text-gray-600">{grabacion.descripcion}</p>
          )}
          <p className="text-sm">
            Visible: <strong>{grabacion.visible ? "sí" : "no"}</strong>
          </p>

          <div className="flex gap-4 flex-wrap">
            <a
              href={grabacion.drive_url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline"
            >
              Abrir en Drive
            </a>

            <button
              type="button"
              onClick={() => cambiarVisible(grabacion.id, !grabacion.visible)}
              className="text-blue-600 underline"
            >
              {grabacion.visible ? "Ocultar" : "Mostrar"}
            </button>

            <button
              type="button"
              onClick={() => iniciarEdicion(grabacion)}
              className="text-blue-600 underline"
            >
              Editar
            </button>
          </div>
        </div>
      )
    })
  }

  return (
    <section className="space-y-4">
      <div className="border rounded-xl p-4 bg-blue-50 space-y-2">
        <p className="font-medium">Administración de Conectando Sentidos</p>
        <p className="text-sm text-gray-700">
          Desde aquí podés cargar grabaciones, ordenar su visibilidad y revisar
          la biblioteca sin salir de la actividad.
        </p>
      </div>

      {mensaje && <div className="border rounded-xl p-3">{mensaje}</div>}

      <SeccionDesplegable titulo="Grabaciones y biblioteca">
        <div className="space-y-6">
          <form onSubmit={crearGrabacion} className="space-y-4 border rounded-2xl p-4">
            <h3 className="text-lg font-semibold">Nueva grabación</h3>

            <input
              className="w-full border rounded-xl p-3"
              placeholder="Título"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />

            <textarea
              className="w-full border rounded-xl p-3 min-h-[100px]"
              placeholder="Descripción (opcional)"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />

            <input
              className="w-full border rounded-xl p-3"
              placeholder="Link de archivo de Drive"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
            />

            <input
              type="date"
              className="w-full border rounded-xl p-3"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={visible}
                onChange={(e) => setVisible(e.target.checked)}
              />
              Visible
            </label>

            <button
              type="submit"
              disabled={guardando}
              className="bg-black text-white px-4 py-2 rounded-xl disabled:opacity-60"
            >
              {guardando ? "Guardando..." : "Crear grabación"}
            </button>
          </form>

          <div className="border-t pt-6 space-y-4">
            <h3 className="text-lg font-semibold">Grabaciones cargadas</h3>
            {cargando ? (
              <p>Cargando grabaciones...</p>
            ) : grabaciones.length === 0 ? (
              <p className="text-gray-600">Todavía no hay grabaciones cargadas.</p>
            ) : (
              <div className="space-y-4">{renderListaGrabaciones()}</div>
            )}
          </div>

          <div className="border-t pt-6 space-y-4">
            <h3 className="text-lg font-semibold">Biblioteca visible</h3>
            <BibliotecaGrabaciones
              actividadSlug="conectando-sentidos"
              previewEnabled={isDevelopmentPreviewEnabled()}
              mostrarAccesoDrive
            />
          </div>
        </div>
      </SeccionDesplegable>
    </section>
  )
}
