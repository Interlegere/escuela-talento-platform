"use client"

import { useEffect, useState } from "react"
import SeccionDesplegable from "@/components/SeccionDesplegable"
import GrabadorVideo from "@/components/casatalentos/GrabadorVideo"
import BibliotecaGrabaciones from "@/components/BibliotecaGrabaciones"

type VideoItem = {
  id: number
  participante_nombre: string
  participante_email?: string | null
  titulo: string
  dia?: string | null
  dia_clave?: string | null
  fecha_semana?: string | null
  video_url?: string | null
  storage_path?: string | null
  mime_type?: string | null
  file_size?: number | null
  created_at?: string
}

type VotoItem = {
  id: number
  video_id: number
  votante_nombre: string
  votante_email?: string | null
  fecha_semana?: string | null
  created_at?: string
}

type ComentarioItem = {
  id: number
  video_id: number
  autor_nombre: string
  autor_email?: string | null
  contenido: string
  created_at?: string
}

type ReferenteSemanal = {
  id: number
  fecha_semana: string
  titulo: string
  descripcion?: string | null
  video_url?: string | null
  storage_path?: string | null
  mime_type?: string | null
  file_size?: number | null
}

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

type EditandoGrabacion = {
  id: number
  titulo: string
  descripcion: string
  driveUrl: string
  fecha: string
  visible: boolean
} | null

type Props = {
  onActualizado?: () => void | Promise<void>
}

export type CasaTalentosAdminResumen = {
  videos: number
  votos: number
  comentarios: number
  anfitrion: {
    participante_nombre: string
    titulo: string
    votos: number
  } | null
}

function formatearFecha(fecha?: string | null) {
  if (!fecha) return ""
  const d = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(d.getTime())) return fecha

  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function esUrlExterna(value?: string | null) {
  return /^https?:\/\//i.test(String(value || "").trim())
}

async function leerJson<T>(res: Response): Promise<T> {
  const raw = await res.text()

  if (!raw) {
    return {} as T
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return {
      error: `Respuesta no válida del servidor: ${raw}`,
    } as T
  }
}

export default function CasaTalentosAdminPanel({
  onActualizado,
}: Props) {
  const [referentesSemanales, setReferentesSemanales] = useState<ReferenteSemanal[]>([])
  const [grabaciones, setGrabaciones] = useState<Grabacion[]>([])

  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState("")

  const [contenidoGeneral, setContenidoGeneral] = useState("")
  const [fechaSemana, setFechaSemana] = useState("")
  const [tituloSemanal, setTituloSemanal] = useState("")
  const [descripcionSemanal, setDescripcionSemanal] = useState("")
  const [videoUrlSemanal, setVideoUrlSemanal] = useState("")
  const [archivoSemanal, setArchivoSemanal] = useState<File | null>(null)
  const [subiendoReferente, setSubiendoReferente] = useState(false)
  const [eliminandoVideoSemanalId, setEliminandoVideoSemanalId] = useState<number | null>(null)

  const [tituloGrabacion, setTituloGrabacion] = useState("")
  const [descripcionGrabacion, setDescripcionGrabacion] = useState("")
  const [driveUrlGrabacion, setDriveUrlGrabacion] = useState("")
  const [fechaGrabacion, setFechaGrabacion] = useState("")
  const [visibleGrabacion, setVisibleGrabacion] = useState(true)
  const [guardandoGrabacion, setGuardandoGrabacion] = useState(false)
  const [editandoGrabacion, setEditandoGrabacion] = useState<EditandoGrabacion>(null)

  const cargar = async () => {
    try {
      setCargando(true)
      setMensaje("")

      const [resCasaTalentos, resGrabaciones] = await Promise.all([
        fetch("/api/casatalentos/listar"),
        fetch("/api/admin/grabaciones/listar"),
      ])

      const dataCasaTalentos = await leerJson<{
        videos?: VideoItem[]
        votos?: VotoItem[]
        comentarios?: ComentarioItem[]
        referentesGenerales?: { contenido?: string | null } | null
        referentesSemanales?: ReferenteSemanal[]
        error?: string
      }>(resCasaTalentos)

      const dataGrabaciones = await leerJson<{
        grabaciones?: Grabacion[]
        error?: string
      }>(resGrabaciones)

      if (!resCasaTalentos.ok) {
        setMensaje(dataCasaTalentos.error || "No se pudieron cargar los datos de CasaTalentos.")
        return
      }

      if (!resGrabaciones.ok) {
        setMensaje(dataGrabaciones.error || "No se pudieron cargar las grabaciones.")
        return
      }

      setReferentesSemanales(dataCasaTalentos.referentesSemanales || [])
      setContenidoGeneral(dataCasaTalentos.referentesGenerales?.contenido || "")
      setGrabaciones(
        (dataGrabaciones.grabaciones || []).filter(
          (grabacion) => grabacion.actividades?.slug === "casatalentos"
        )
      )
    } catch {
      setMensaje("Error cargando administración de CasaTalentos.")
    } finally {
      setCargando(false)
    }
  }

  const refrescarTodo = async () => {
    await cargar()
    if (onActualizado) {
      await onActualizado()
    }
  }

  useEffect(() => {
    void cargar()
  }, [])

  const guardarReferentesGenerales = async () => {
    try {
      setMensaje("Guardando referentes generales...")

      const res = await fetch("/api/casatalentos/admin/guardar-referentes-generales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contenido: contenidoGeneral,
        }),
      })

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensaje(data.error || "No se pudieron guardar los referentes generales.")
        return
      }

      setMensaje("Referentes generales guardados correctamente.")
      await refrescarTodo()
    } catch {
      setMensaje("Error guardando referentes generales.")
    }
  }

  const guardarReferenteSemanal = async () => {
    try {
      setMensaje("Guardando referente semanal...")
      setSubiendoReferente(true)

      const formData = new FormData()
      formData.append("fechaSemana", fechaSemana)
      formData.append("titulo", tituloSemanal)
      formData.append("descripcion", descripcionSemanal)
      formData.append("videoUrl", videoUrlSemanal)

      if (archivoSemanal) {
        formData.append("archivo", archivoSemanal)
      }

      const res = await fetch("/api/casatalentos/admin/guardar-referentes-semanal", {
        method: "POST",
        body: formData,
      })

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensaje(data.error || "No se pudo guardar el referente semanal.")
        return
      }

      setMensaje("Referente semanal guardado correctamente.")
      setArchivoSemanal(null)
      await refrescarTodo()
    } catch {
      setMensaje("Error guardando referente semanal.")
    } finally {
      setSubiendoReferente(false)
    }
  }

  const cargarSemanaExistente = (semana: ReferenteSemanal) => {
    setFechaSemana(semana.fecha_semana)
    setTituloSemanal(semana.titulo || "")
    setDescripcionSemanal(semana.descripcion || "")
    setVideoUrlSemanal(esUrlExterna(semana.video_url) ? semana.video_url || "" : "")
    setArchivoSemanal(null)
  }

  const eliminarVideoReferenteSemanal = async (semana: ReferenteSemanal) => {
    const confirmar = window.confirm(
      "¿Querés borrar solo el video de este referente semanal? El título y la descripción se conservan."
    )
    if (!confirmar) return

    try {
      setEliminandoVideoSemanalId(semana.id)
      setMensaje("Borrando video del referente semanal...")

      const res = await fetch(
        "/api/casatalentos/admin/eliminar-video-referente-semanal",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            referenteSemanalId: semana.id,
          }),
        }
      )

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensaje(data.error || "No se pudo borrar el video del referente semanal.")
        return
      }

      if (fechaSemana === semana.fecha_semana) {
        setArchivoSemanal(null)
        setVideoUrlSemanal("")
      }

      setMensaje("Video del referente semanal borrado correctamente.")
      await refrescarTodo()
    } catch {
      setMensaje("Error borrando el video del referente semanal.")
    } finally {
      setEliminandoVideoSemanalId(null)
    }
  }

  const crearGrabacion = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setGuardandoGrabacion(true)
      setMensaje("")

      const res = await fetch("/api/admin/grabaciones/crear", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          titulo: tituloGrabacion,
          descripcion: descripcionGrabacion,
          actividadSlug: "casatalentos",
          driveUrl: driveUrlGrabacion,
          fecha: fechaGrabacion,
          visible: visibleGrabacion,
        }),
      })

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensaje(data.error || "No se pudo crear la grabación.")
        return
      }

      setTituloGrabacion("")
      setDescripcionGrabacion("")
      setDriveUrlGrabacion("")
      setFechaGrabacion("")
      setVisibleGrabacion(true)

      setMensaje("Grabación creada correctamente.")
      await refrescarTodo()
    } catch {
      setMensaje("Error creando grabación.")
    } finally {
      setGuardandoGrabacion(false)
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

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensaje(data.error || "No se pudo actualizar visibilidad.")
        return
      }

      await refrescarTodo()
    } catch {
      setMensaje("Error actualizando visibilidad.")
    }
  }

  const iniciarEdicion = (grabacion: Grabacion) => {
    setEditandoGrabacion({
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
    if (!editandoGrabacion) return

    try {
      setGuardandoGrabacion(true)
      setMensaje("")

      const res = await fetch("/api/admin/grabaciones/actualizar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grabacionId: editandoGrabacion.id,
          titulo: editandoGrabacion.titulo,
          descripcion: editandoGrabacion.descripcion,
          driveUrl: editandoGrabacion.driveUrl,
          fecha: editandoGrabacion.fecha,
          visible: editandoGrabacion.visible,
        }),
      })

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensaje(data.error || "No se pudo actualizar la grabación.")
        return
      }

      setMensaje("Grabación actualizada correctamente.")
      setEditandoGrabacion(null)
      await refrescarTodo()
    } catch {
      setMensaje("Error actualizando grabación.")
    } finally {
      setGuardandoGrabacion(false)
    }
  }

  const renderListaGrabaciones = () => (
    <div className="grid gap-4">
      {grabaciones.length === 0 && (
        <p className="text-gray-600">Todavía no hay grabaciones cargadas.</p>
      )}

      {grabaciones.map((grabacion) => {
        const estaEditando = editandoGrabacion?.id === grabacion.id

        if (estaEditando && editandoGrabacion) {
          return (
            <form
              key={grabacion.id}
              onSubmit={guardarEdicion}
              className="border rounded-xl p-4 space-y-3"
            >
              <input
                className="w-full border rounded-xl p-3"
                value={editandoGrabacion.titulo}
                onChange={(e) =>
                  setEditandoGrabacion((prev) =>
                    prev ? { ...prev, titulo: e.target.value } : prev
                  )
                }
              />

              <textarea
                className="w-full border rounded-xl p-3 min-h-[90px]"
                value={editandoGrabacion.descripcion}
                onChange={(e) =>
                  setEditandoGrabacion((prev) =>
                    prev ? { ...prev, descripcion: e.target.value } : prev
                  )
                }
              />

              <input
                className="w-full border rounded-xl p-3"
                value={editandoGrabacion.driveUrl}
                onChange={(e) =>
                  setEditandoGrabacion((prev) =>
                    prev ? { ...prev, driveUrl: e.target.value } : prev
                  )
                }
              />

              <input
                type="date"
                className="w-full border rounded-xl p-3"
                value={editandoGrabacion.fecha}
                onChange={(e) =>
                  setEditandoGrabacion((prev) =>
                    prev ? { ...prev, fecha: e.target.value } : prev
                  )
                }
              />

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editandoGrabacion.visible}
                  onChange={(e) =>
                    setEditandoGrabacion((prev) =>
                      prev ? { ...prev, visible: e.target.checked } : prev
                    )
                  }
                />
                Visible
              </label>

              <div className="flex gap-3 flex-wrap">
                <button
                  type="submit"
                  disabled={guardandoGrabacion}
                  className="bg-black text-white px-4 py-2 rounded-xl disabled:opacity-60"
                >
                  {guardandoGrabacion ? "Guardando..." : "Guardar cambios"}
                </button>

                <button
                  type="button"
                  onClick={() => setEditandoGrabacion(null)}
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
      })}
    </div>
  )

  return (
    <section className="space-y-4">
      <div className="border rounded-xl p-4 bg-blue-50 space-y-2">
        <p className="font-medium">Administración de CasaTalentos</p>
        <p className="text-sm text-gray-700">
          Desde aquí podés cargar referentes, ordenar grabaciones y seguir videos,
          elecciones y aportes sin salir de la actividad.
        </p>
      </div>

      {mensaje && <div className="border rounded-xl p-3">{mensaje}</div>}

      <SeccionDesplegable titulo="Gestión de referentes">
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Referente general</h3>
            <p className="text-sm text-gray-600">
              Este contenido acompaña el dispositivo de forma estable y podés ajustarlo
              cada vez que haga falta.
            </p>
            <textarea
              className="w-full border rounded-xl p-3 min-h-[180px]"
              value={contenidoGeneral}
              onChange={(e) => setContenidoGeneral(e.target.value)}
              placeholder="Escribí aquí los referentes generales del dispositivo..."
            />

            <button
              type="button"
              onClick={guardarReferentesGenerales}
              className="bg-black text-white px-4 py-2 rounded-xl"
            >
              Guardar cambios del referente general
            </button>

            <div className="border rounded-xl p-4 bg-gray-50 space-y-2">
              <p className="text-sm font-medium">Vista previa</p>
              <div className="whitespace-pre-wrap text-gray-700">
                {contenidoGeneral.trim() || "Todavía no cargaste un referente general."}
              </div>
            </div>
          </div>

          <div className="border-t pt-6 space-y-4">
            <h3 className="text-lg font-semibold">Referente semanal</h3>

            <input
              type="date"
              className="w-full border rounded-xl p-3"
              value={fechaSemana}
              onChange={(e) => setFechaSemana(e.target.value)}
            />

            <input
              className="w-full border rounded-xl p-3"
              value={tituloSemanal}
              onChange={(e) => setTituloSemanal(e.target.value)}
              placeholder="Título del referente semanal"
            />

            <textarea
              className="w-full border rounded-xl p-3 min-h-[120px]"
              value={descripcionSemanal}
              onChange={(e) => setDescripcionSemanal(e.target.value)}
              placeholder="Descripción del referente semanal"
            />

            <input
              className="w-full border rounded-xl p-3"
              value={videoUrlSemanal}
              onChange={(e) => setVideoUrlSemanal(e.target.value)}
              placeholder="URL del video del referente semanal (opcional)"
            />

            <div className="border rounded-2xl p-4 space-y-3">
              <div className="space-y-1">
                <p className="font-medium">Video del referente</p>
                <p className="text-sm text-gray-600">
                  Podés dejar una URL o grabar/subir un video directamente desde aquí.
                </p>
              </div>

              <GrabadorVideo
                onVideoListo={setArchivoSemanal}
                disabled={subiendoReferente}
                maxSegundos={180}
              />

              {archivoSemanal && (
                <p className="text-sm text-green-700">
                  Video listo para guardar: <strong>{archivoSemanal.name}</strong>
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={guardarReferenteSemanal}
              disabled={subiendoReferente}
              className="bg-black text-white px-4 py-2 rounded-xl disabled:opacity-60"
            >
              {subiendoReferente ? "Guardando..." : "Guardar referente semanal"}
            </button>

            <div className="border-t pt-4 space-y-3">
              <h4 className="font-semibold">Semanas cargadas</h4>

              {referentesSemanales.length === 0 && (
                <p className="text-gray-600">No hay referentes semanales cargados todavía.</p>
              )}

              {referentesSemanales.map((semana) => (
                <div key={semana.id} className="border rounded-xl p-4 space-y-2">
                  <p className="font-medium">
                    {formatearFecha(semana.fecha_semana)} — {semana.titulo}
                  </p>

                  {semana.descripcion && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {semana.descripcion}
                    </p>
                  )}

                  {semana.video_url && (
                    <div className="space-y-2">
                      <video controls src={semana.video_url} className="w-full rounded-xl border" />
                    </div>
                  )}

                  <div className="flex gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => cargarSemanaExistente(semana)}
                      className="border px-3 py-2 rounded-xl"
                    >
                      Editar esta semana
                    </button>

                    {semana.video_url && (
                      <button
                        type="button"
                        onClick={() => void eliminarVideoReferenteSemanal(semana)}
                        disabled={eliminandoVideoSemanalId === semana.id}
                        className="border px-3 py-2 rounded-xl disabled:opacity-60"
                      >
                        {eliminandoVideoSemanalId === semana.id
                          ? "Borrando video..."
                          : "Borrar video"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SeccionDesplegable>

      <SeccionDesplegable titulo="Grabaciones y biblioteca">
        <div className="space-y-6">
          <form onSubmit={crearGrabacion} className="space-y-4 border rounded-2xl p-4">
            <h3 className="text-lg font-semibold">Nueva grabación</h3>

            <input
              className="w-full border rounded-xl p-3"
              placeholder="Título"
              value={tituloGrabacion}
              onChange={(e) => setTituloGrabacion(e.target.value)}
            />

            <textarea
              className="w-full border rounded-xl p-3 min-h-[100px]"
              placeholder="Descripción (opcional)"
              value={descripcionGrabacion}
              onChange={(e) => setDescripcionGrabacion(e.target.value)}
            />

            <input
              className="w-full border rounded-xl p-3"
              placeholder="Link de archivo de Drive"
              value={driveUrlGrabacion}
              onChange={(e) => setDriveUrlGrabacion(e.target.value)}
            />

            <input
              type="date"
              className="w-full border rounded-xl p-3"
              value={fechaGrabacion}
              onChange={(e) => setFechaGrabacion(e.target.value)}
            />

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={visibleGrabacion}
                onChange={(e) => setVisibleGrabacion(e.target.checked)}
              />
              Visible
            </label>

            <button
              type="submit"
              disabled={guardandoGrabacion}
              className="bg-black text-white px-4 py-2 rounded-xl disabled:opacity-60"
            >
              {guardandoGrabacion ? "Guardando..." : "Crear grabación"}
            </button>
          </form>

          <div className="border-t pt-6 space-y-4">
            <h3 className="text-lg font-semibold">Grabaciones cargadas</h3>
            {cargando ? <p>Cargando grabaciones...</p> : renderListaGrabaciones()}
          </div>

          <div className="border-t pt-6 space-y-4">
            <h3 className="text-lg font-semibold">Biblioteca visible</h3>
            <BibliotecaGrabaciones
              actividadSlug="casatalentos"
              mostrarAccesoDrive
            />
          </div>
        </div>
      </SeccionDesplegable>

    </section>
  )
}

export function CasaTalentosAdminResumenBlock({
  resumen,
}: {
  resumen: CasaTalentosAdminResumen
}) {
  return (
    <div className="border rounded-2xl p-4 bg-blue-50 space-y-3">
      <p>
        <strong>Videos cargados:</strong> {resumen.videos}
      </p>
      <p>
        <strong>Elecciones emitidas:</strong> {resumen.votos}
      </p>
      <p>
        <strong>Aportes realizados:</strong> {resumen.comentarios}
      </p>

      {!resumen.anfitrion && (
        <p className="text-gray-600">Aún no hay un anfitrión definido por elecciones.</p>
      )}

      {resumen.anfitrion && (
        <div className="border rounded-xl p-4 bg-white space-y-1">
          <p className="font-medium">
            Anfitrión actual: {resumen.anfitrion.participante_nombre}
          </p>
          <p>{resumen.anfitrion.titulo}</p>
          <p className="text-sm text-gray-500">Elecciones: {resumen.anfitrion.votos}</p>
        </div>
      )}
    </div>
  )
}
