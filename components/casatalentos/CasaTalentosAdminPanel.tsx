"use client"

import { useEffect, useState } from "react"
import SeccionDesplegable from "@/components/SeccionDesplegable"
import VideoEmbed from "@/components/VideoEmbed"
import GrabadorVideo from "@/components/casatalentos/GrabadorVideo"
import EditorMensajeAdmin from "@/components/espacios/EditorMensajeAdmin"
import { useSessionDraft } from "@/hooks/useSessionDraft"
import { supabase } from "@/lib/supabase"

function contieneHtml(valor?: string | null) {
  return /<\/?[a-z][\s\S]*>/i.test(String(valor || ""))
}

function escaparHtml(texto: string) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function paraEditorEnriquecido(valor?: string | null) {
  const texto = valor || ""
  if (contieneHtml(texto)) return texto
  return escaparHtml(texto).replaceAll("\n", "<br />")
}

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


type Props = {
  onActualizado?: () => void | Promise<void>
  storageOwnerKey?: string
  uiStoragePrefix?: string
}

type PrepararUploadReferenteSemanalResponse = {
  ok?: boolean
  error?: string
  bucket?: string
  storagePath?: string
  signedToken?: string
  signedUrl?: string
  fechaSemana?: string
  maxBytes?: number
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
  storageOwnerKey = "",
  uiStoragePrefix = "",
}: Props) {
  const [referentesSemanales, setReferentesSemanales] = useState<ReferenteSemanal[]>([])

  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState("")

  const draftsHabilitados = Boolean(storageOwnerKey)
  const draftKey = (campo: string) =>
    `entheos:v1:draft:${storageOwnerKey}:casatalentos:referentes:${campo}`
  const uiKey = (campo: string) =>
    uiStoragePrefix ? `${uiStoragePrefix}:admin:${campo}` : ""
  const {
    value: contenidoGeneral,
    setValue: setContenidoGeneral,
    clearDraft: clearContenidoGeneralDraft,
    hydrateFromServer: hydrateContenidoGeneral,
  } = useSessionDraft(draftKey("general"), "", {
    enabled: draftsHabilitados,
    isEmpty: (value) => !value.trim(),
  })
  const {
    value: fechaSemana,
    setValue: setFechaSemana,
    clearDraft: clearFechaSemanaDraft,
  } = useSessionDraft(draftKey("semanal:fecha"), "", {
    enabled: draftsHabilitados,
    isEmpty: (value) => !value.trim(),
  })
  const {
    value: tituloSemanal,
    setValue: setTituloSemanal,
    clearDraft: clearTituloSemanalDraft,
  } = useSessionDraft(draftKey("semanal:titulo"), "", {
    enabled: draftsHabilitados,
    isEmpty: (value) => !value.trim(),
  })
  const {
    value: descripcionSemanal,
    setValue: setDescripcionSemanal,
    clearDraft: clearDescripcionSemanalDraft,
  } = useSessionDraft(draftKey("semanal:descripcion"), "", {
    enabled: draftsHabilitados,
    isEmpty: (value) => !value.trim(),
  })
  const {
    value: videoUrlSemanal,
    setValue: setVideoUrlSemanal,
    clearDraft: clearVideoUrlSemanalDraft,
  } = useSessionDraft(draftKey("semanal:video-url"), "", {
    enabled: draftsHabilitados,
    isEmpty: (value) => !value.trim(),
  })
  const [archivoSemanal, setArchivoSemanal] = useState<File | null>(null)
  const [subiendoReferente, setSubiendoReferente] = useState(false)
  const [eliminandoVideoSemanalId, setEliminandoVideoSemanalId] = useState<number | null>(null)


  const cargar = async () => {
    try {
      setCargando(true)
      setMensaje("")

      const resCasaTalentos = await fetch("/api/casatalentos/listar")

      const dataCasaTalentos = await leerJson<{
        videos?: VideoItem[]
        votos?: VotoItem[]
        comentarios?: ComentarioItem[]
        referentesGenerales?: { contenido?: string | null } | null
        referentesSemanales?: ReferenteSemanal[]
        error?: string
      }>(resCasaTalentos)

      if (!resCasaTalentos.ok) {
        setMensaje(dataCasaTalentos.error || "No se pudieron cargar los datos de Entusiasmento.")
        return
      }

      setReferentesSemanales(dataCasaTalentos.referentesSemanales || [])
      hydrateContenidoGeneral(
        paraEditorEnriquecido(dataCasaTalentos.referentesGenerales?.contenido)
      )
    } catch {
      setMensaje("Error cargando administración de Entusiasmento.")
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
      clearContenidoGeneralDraft()
      await refrescarTodo()
    } catch {
      setMensaje("Error guardando referentes generales.")
    }
  }

  const guardarReferenteSemanal = async () => {
    try {
      if (!fechaSemana.trim() || !tituloSemanal.trim()) {
        setMensaje("Completá la fecha y el título del referente semanal antes de guardar.")
        return
      }

      setMensaje("Guardando referente semanal...")
      setSubiendoReferente(true)
      let payload: Record<string, unknown> = {
        fechaSemana,
        titulo: tituloSemanal,
        descripcion: descripcionSemanal,
        videoUrl: videoUrlSemanal,
      }

      if (archivoSemanal) {
        setMensaje("Preparando video del referente semanal...")

        const prepararRes = await fetch(
          "/api/casatalentos/admin/preparar-upload-referente-semanal",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fechaSemana,
              titulo: tituloSemanal,
              fileName: archivoSemanal.name,
              mimeType: archivoSemanal.type,
              fileSize: archivoSemanal.size,
            }),
          }
        )

        const preparacion =
          await leerJson<PrepararUploadReferenteSemanalResponse>(prepararRes)

        if (!prepararRes.ok) {
          setMensaje(preparacion.error || "No se pudo preparar el video del referente semanal.")
          return
        }

        if (
          !preparacion.bucket ||
          !preparacion.storagePath ||
          !preparacion.signedToken
        ) {
          setMensaje("La preparación de subida del referente semanal vino incompleta.")
          return
        }

        if (preparacion.maxBytes && archivoSemanal.size > preparacion.maxBytes) {
          setMensaje("El video del referente semanal es muy pesado. Máximo 50MB.")
          return
        }

        setMensaje("Subiendo video del referente semanal...")

        const { error: uploadError } = await supabase.storage
          .from(preparacion.bucket)
          .uploadToSignedUrl(
            preparacion.storagePath,
            preparacion.signedToken,
            archivoSemanal,
            {
              contentType: archivoSemanal.type,
              upsert: false,
            }
          )

        if (uploadError) {
          setMensaje(
            uploadError.message ||
              "No se pudo subir el video del referente semanal. Probá nuevamente con buena conexión."
          )
          return
        }

        payload = {
          fechaSemana: preparacion.fechaSemana || fechaSemana,
          titulo: tituloSemanal,
          descripcion: descripcionSemanal,
          videoUrl: "",
          storagePath: preparacion.storagePath,
          mimeType: archivoSemanal.type,
          fileSize: archivoSemanal.size,
        }
        setMensaje("Confirmando referente semanal...")
      }

      const res = await fetch("/api/casatalentos/admin/guardar-referentes-semanal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensaje(data.error || "No se pudo guardar el referente semanal.")
        return
      }

      setMensaje("Referente semanal guardado correctamente.")
      setArchivoSemanal(null)
      clearFechaSemanaDraft()
      clearTituloSemanalDraft()
      clearDescripcionSemanalDraft()
      clearVideoUrlSemanalDraft()
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
    setDescripcionSemanal(paraEditorEnriquecido(semana.descripcion))
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


  return (
    <section className="space-y-4">
      <div className="border rounded-xl p-4 bg-blue-50 space-y-2">
        <p className="font-medium">Administración de Entusiasmento</p>
        <p className="text-sm text-gray-700">
          Desde aquí administrás los referentes generales y semanales de
          Entusiasmento.
        </p>
      </div>

      {mensaje && <div className="border rounded-xl p-3">{mensaje}</div>}

      <SeccionDesplegable
        titulo="Gestión de referentes"
        storageKey={uiKey("seccion:referentes")}
        mantenerMontado
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Referente general</h3>
            <p className="text-sm text-gray-600">
              Este contenido acompaña el dispositivo de forma estable y podés ajustarlo
              cada vez que haga falta.
            </p>
            <EditorMensajeAdmin value={contenidoGeneral} onChange={setContenidoGeneral} />

            <button
              type="button"
              onClick={guardarReferentesGenerales}
              className="bg-black text-white px-4 py-2 rounded-xl"
            >
              Guardar cambios del referente general
            </button>

            <div className="border rounded-xl p-4 bg-gray-50 space-y-2">
              <p className="text-sm font-medium">Vista previa</p>
              {contenidoGeneral.trim() ? (
                contieneHtml(contenidoGeneral) ? (
                  <div
                    className="max-w-none text-gray-700 [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: contenidoGeneral }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-gray-700">{contenidoGeneral}</div>
                )
              ) : (
                <div className="whitespace-pre-wrap text-gray-700">
                  Todavía no cargaste un referente general.
                </div>
              )}
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

            <EditorMensajeAdmin value={descripcionSemanal} onChange={setDescripcionSemanal} />

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
                    contieneHtml(semana.descripcion) ? (
                      <div
                        className="text-sm max-w-none text-gray-600 [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: semana.descripcion }}
                      />
                    ) : (
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">
                        {semana.descripcion}
                      </p>
                    )
                  )}

                  {semana.video_url && (
                    <div className="space-y-2">
                      <VideoEmbed
                        src={semana.video_url}
                        title={semana.titulo || "Referente semanal"}
                      />
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
