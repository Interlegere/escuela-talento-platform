"use client"

import { useEffect, useMemo, useState } from "react"
import PagoMensualCard from "@/components/pagos/PagoMensualCard"
import BibliotecaGrabaciones from "@/components/BibliotecaGrabaciones"
import SeccionDesplegable from "@/components/SeccionDesplegable"
import AgendaActividad from "@/components/agenda/AgendaActividad"
import { useActivityAccess } from "@/components/auth/useActivityAccess"
import ConectandoAdminPanel from "@/components/conectando/ConectandoAdminPanel"
import { isDevelopmentPreviewEnabled } from "@/lib/dev-flags"
import WorkspaceHero from "@/components/ui/WorkspaceHero"

type Recurso = {
  id: number
  slug: string
  nombre: string
  descripcion?: string | null
  tipo: string
  proveedor: string
}

type MensajeGeneral = {
  id: number
  parent_id?: number | null
  asunto?: string | null
  autor_nombre: string
  autor_email?: string | null
  autor_rol?: string | null
  contenido: string
  created_at?: string
  updated_at?: string
}

const MODO_PRUEBA = isDevelopmentPreviewEnabled()
const STORAGE_MENSAJES_LEIDOS_CONECTANDO = "conectando_mensajes_leidos"
const RECURSOS_PRUEBA_CONECTANDO: Recurso[] = [
  {
    id: 888001,
    slug: "sesion_grupal_conectando",
    nombre: "Sesión grupal Conectando Sentidos",
    descripcion: "Modo prueba",
    tipo: "reunion",
    proveedor: "interno",
  },
  {
    id: 888002,
    slug: "grabaciones_conectando",
    nombre: "Grabaciones Conectando Sentidos",
    descripcion: "Modo prueba",
    tipo: "biblioteca",
    proveedor: "google_drive",
  },
]

export default function ConectandoSentidosPage() {
  const {
    session,
    error,
    nombre,
    email,
    acceso,
    motivo,
    recursos,
    cargandoAcceso,
    sesionDemorada,
    sesionLista,
  } = useActivityAccess({
    activitySlug: "conectando-sentidos",
    previewEnabled: MODO_PRUEBA,
    previewResources: RECURSOS_PRUEBA_CONECTANDO,
  })

  const [mensajes, setMensajes] = useState<MensajeGeneral[]>([])
  const [cargandoMensajes, setCargandoMensajes] = useState(false)
  const [asuntoMensajeDraft, setAsuntoMensajeDraft] = useState("")
  const [mensajeDraft, setMensajeDraft] = useState("")
  const [respuestasDraft, setRespuestasDraft] = useState<Record<number, string>>({})
  const [guardandoMensaje, setGuardandoMensaje] = useState(false)
  const [respondiendoMensajeId, setRespondiendoMensajeId] = useState<number | null>(null)
  const [mensajeEditandoId, setMensajeEditandoId] = useState<number | null>(null)
  const [mensajeEditandoAsunto, setMensajeEditandoAsunto] = useState("")
  const [mensajeEditandoContenido, setMensajeEditandoContenido] = useState("")
  const [mensajeExito, setMensajeExito] = useState("")
  const [mensajeError, setMensajeError] = useState("")
  const [mensajesAbiertos, setMensajesAbiertos] = useState<Record<number, boolean>>({})
  const [mensajesLeidos, setMensajesLeidos] = useState<Record<number, string>>({})
  const esAdmin = session?.user?.role === "admin"

  const tieneRecurso = (slug: string) => {
    return recursos.some((r) => r.slug === slug)
  }

  function formatearFechaHora(fecha?: string | null) {
    if (!fecha) return ""
    const d = new Date(fecha)
    if (Number.isNaN(d.getTime())) return fecha

    return d.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const mensajesRaiz = useMemo(() => {
    return mensajes.filter((mensaje) => !mensaje.parent_id)
  }, [mensajes])

  const respuestasPorMensaje = useMemo(() => {
    const mapa = new Map<number, MensajeGeneral[]>()

    for (const mensaje of mensajes) {
      if (!mensaje.parent_id) continue
      const actuales = mapa.get(mensaje.parent_id) || []
      actuales.push(mensaje)
      mapa.set(mensaje.parent_id, actuales)
    }

    return mapa
  }, [mensajes])

  const firmaMensaje = (mensaje?: MensajeGeneral | null) => {
    return mensaje?.updated_at || mensaje?.created_at || String(mensaje?.id || "")
  }

  const firmaHilo = (mensaje: MensajeGeneral) => {
    const respuestas = respuestasPorMensaje.get(mensaje.id) || []
    return [mensaje, ...respuestas]
      .map((item) => firmaMensaje(item))
      .filter(Boolean)
      .sort()
      .at(-1) || String(mensaje.id)
  }

  const hiloLeido = (mensaje: MensajeGeneral) => {
    return mensajesLeidos[mensaje.id] === firmaHilo(mensaje)
  }

  const marcarHiloComoLeido = (mensaje: MensajeGeneral) => {
    setMensajesLeidos((prev) => ({
      ...prev,
      [mensaje.id]: firmaHilo(mensaje),
    }))
  }

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_MENSAJES_LEIDOS_CONECTANDO)
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<number, string>
      setMensajesLeidos(parsed)
    } catch {
      return
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_MENSAJES_LEIDOS_CONECTANDO,
        JSON.stringify(mensajesLeidos)
      )
    } catch {
      return
    }
  }, [mensajesLeidos])

  const cargarMensajes = async () => {
    try {
      setCargandoMensajes(true)
      const query = MODO_PRUEBA ? "?preview=1" : ""
      const res = await fetch(`/api/conectando-sentidos/mensajes${query}`)
      const data = await res.json()

      if (!res.ok) {
        setMensajeError(data.error || "No se pudieron cargar los mensajes.")
        return
      }

      setMensajes(data.mensajes || [])
    } catch {
      setMensajeError("Error cargando mensajes.")
    } finally {
      setCargandoMensajes(false)
    }
  }

  useEffect(() => {
    if (!sesionLista) return
    if (!acceso && !MODO_PRUEBA) return
    void cargarMensajes()
  }, [acceso, sesionLista])

  const handleEnviarMensaje = async (parentId?: number) => {
    const contenido = parentId
      ? (respuestasDraft[parentId] || "").trim()
      : mensajeDraft.trim()
    const asunto = parentId ? "" : asuntoMensajeDraft.trim()

    if (!contenido) {
      setMensajeError("Escribí un mensaje antes de enviarlo.")
      return
    }

    if (!parentId && !asunto) {
      setMensajeError("Escribí un asunto antes de enviarlo.")
      return
    }

    try {
      setGuardandoMensaje(true)
      setMensajeExito("")
      setMensajeError("")
      setRespondiendoMensajeId(parentId || null)

      const res = await fetch("/api/conectando-sentidos/mensajes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          asunto,
          contenido,
          parentId: parentId || null,
          previewEnabled: MODO_PRUEBA,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo enviar el mensaje.")
        return
      }

      if (parentId) {
        setRespuestasDraft((prev) => ({
          ...prev,
          [parentId]: "",
        }))
      } else {
        setAsuntoMensajeDraft("")
        setMensajeDraft("")
      }

      setMensajeExito("Mensaje enviado correctamente.")
      if (!parentId && data?.mensaje?.id) {
        setMensajesAbiertos((prev) => ({
          ...prev,
          [data.mensaje.id]: true,
        }))
        setMensajesLeidos((prev) => ({
          ...prev,
          [data.mensaje.id]: data.mensaje.updated_at || data.mensaje.created_at || new Date().toISOString(),
        }))
      }
      if (parentId) {
        setMensajesLeidos((prev) => ({
          ...prev,
          [parentId]: new Date().toISOString(),
        }))
      }
      await cargarMensajes()
    } catch {
      setMensajeError("Hubo un problema al enviar el mensaje.")
    } finally {
      setGuardandoMensaje(false)
      setRespondiendoMensajeId(null)
    }
  }

  const handleEditarMensaje = async (mensajeId: number) => {
    const contenido = mensajeEditandoContenido.trim()
    const asunto = mensajeEditandoAsunto.trim()

    if (!contenido) {
      setMensajeError("Escribí el contenido actualizado del mensaje.")
      return
    }

    try {
      setGuardandoMensaje(true)
      setMensajeExito("")
      setMensajeError("")

      const res = await fetch("/api/conectando-sentidos/mensajes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mensajeId,
          asunto,
          contenido,
          previewEnabled: MODO_PRUEBA,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo editar el mensaje.")
        return
      }

      setMensajeEditandoId(null)
      setMensajeEditandoAsunto("")
      setMensajeEditandoContenido("")
      setMensajeExito("Mensaje actualizado correctamente.")
      setMensajesLeidos((prev) => ({
        ...prev,
        [mensajeId]: new Date().toISOString(),
      }))
      await cargarMensajes()
    } catch {
      setMensajeError("Hubo un problema al editar el mensaje.")
    } finally {
      setGuardandoMensaje(false)
    }
  }

  if (!sesionLista) {
    return (
      <main className="workspace-page space-y-6">
        <WorkspaceHero
          eyebrow="Mesa grupal"
          title="Conectando Sentidos"
          subtitle="Preparando tu acceso al espacio grupal."
        />

        <section className="workspace-panel space-y-3">
          <p>Cargando sesión y recursos...</p>
          {sesionDemorada && (
            <p className="workspace-inline-note text-amber-700">
              La sesión está tardando más de lo normal. En modo prueba podés seguir
              viendo esta pantalla aunque la autenticación local falle.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>
      </main>
    )
  }

  if (!session && !MODO_PRUEBA) {
    return (
      <main className="workspace-page space-y-6">
        <WorkspaceHero
          eyebrow="Mesa grupal"
          title="Conectando Sentidos"
          subtitle="Redirigiendo al inicio de sesión."
        />

        <section className="workspace-panel">
          <p>Necesitás iniciar sesión para continuar.</p>
        </section>
      </main>
    )
  }

  return (
      <main className="workspace-page space-y-6">
        <WorkspaceHero
          eyebrow={esAdmin ? "Coordinación grupal" : "Sala compartida"}
          title={esAdmin ? "Admin Conectando Sentidos" : "Conectando Sentidos"}
          subtitle={
            esAdmin
              ? "Administrá la sesión, los mensajes y las grabaciones desde un mismo lugar."
              : "Entrá a la sesión grupal, compartí mensajes y revisá las grabaciones."
          }
          logoSrc="/conectando-sentidos-logo.png"
          logoAlt="Logo Conectando Sentidos"
          logoClassName="!h-40 !w-52"
          logoBlendClassName="mix-blend-multiply"
        >
          <div className="flex flex-wrap gap-3">
            <span className="workspace-chip">Trabajo analítico</span>
            <span className="workspace-chip">Ritmo grupal</span>
          </div>
        </WorkspaceHero>

        {MODO_PRUEBA && (
          <section className="workspace-panel-soft space-y-2 bg-yellow-50/80">
            <p className="font-medium">Modo prueba activo</p>
            <p className="workspace-inline-note">
              Esta página está mostrando recursos aunque el pago no esté aprobado,
              solo para desarrollo.
            </p>
          </section>
        )}

        {cargandoAcceso && (
          <section className="workspace-panel">
            <p>Cargando acceso...</p>
          </section>
        )}

        {!cargandoAcceso && !acceso && !MODO_PRUEBA && (
          <>
            <section className="workspace-panel space-y-3">
              <h2 className="workspace-title-sm">Acceso no habilitado</h2>
              <p className="workspace-inline-note text-[var(--foreground)]">
                Para usar Conectando Sentidos necesitás tener tu acceso activo.
              </p>
              <p className="workspace-inline-note">
                Estado detectado: {motivo || "sin acceso"}
              </p>
            </section>

            <PagoMensualCard
              actividadSlug="conectando-sentidos"
              participanteNombre={nombre}
              participanteEmail={email}
            />
          </>
        )}

        {!cargandoAcceso && (acceso || MODO_PRUEBA) && (
          <div className="space-y-4">
            {tieneRecurso("sesion_grupal_conectando") && (
              <SeccionDesplegable titulo="Sesión Conectando Sentidos">
                <AgendaActividad
                  actividadSlug="conectando-sentidos"
                  tituloSeccion="Próximo encuentro de Conectando Sentidos"
                  mostrarSoloProximo
                />
              </SeccionDesplegable>
            )}

            <SeccionDesplegable titulo="Mensajes">
              <div className="space-y-6">
                {(mensajeExito || mensajeError) && (
                  <div className="space-y-2">
                    {mensajeExito && (
                      <p className="text-sm font-medium text-green-700">{mensajeExito}</p>
                    )}
                    {mensajeError && (
                      <p className="text-sm font-medium text-red-700">{mensajeError}</p>
                    )}
                  </div>
                )}

                <div className="workspace-panel-soft space-y-3">
                  <div className="space-y-1">
                    <p className="workspace-eyebrow">Nuevo hilo</p>
                    <h3 className="text-lg font-semibold">Nuevo mensaje</h3>
                  </div>
                  <input
                    className="workspace-field"
                    placeholder="Asunto del mensaje"
                    value={asuntoMensajeDraft}
                    onChange={(e) => setAsuntoMensajeDraft(e.target.value)}
                  />
                  <textarea
                    className="workspace-field min-h-[110px]"
                    placeholder="Escribí aquí comentarios sobre la sesión, valoraciones, agradecimientos o algo que quieras compartir..."
                    value={mensajeDraft}
                    onChange={(e) => setMensajeDraft(e.target.value)}
                  />

                  <button
                    type="button"
                    onClick={() => void handleEnviarMensaje()}
                    disabled={guardandoMensaje}
                    className="workspace-button-primary disabled:opacity-60"
                  >
                    {guardandoMensaje && respondiendoMensajeId === null
                      ? "Enviando..."
                      : "Enviar mensaje"}
                  </button>
                </div>

                {cargandoMensajes && <p className="workspace-inline-note">Cargando mensajes...</p>}

                {!cargandoMensajes && mensajesRaiz.length === 0 && (
                  <p className="workspace-inline-note">
                    Todavía no hay mensajes en Conectando Sentidos.
                  </p>
                )}

                {mensajesRaiz.map((mensaje) => {
                  const respuestas = respuestasPorMensaje.get(mensaje.id) || []
                  const respuestaActual = respuestasDraft[mensaje.id] || ""
                  const editandoEsteMensaje = mensajeEditandoId === mensaje.id
                  const cantidadRespuestas = respuestas.length
                  const estaLeido = hiloLeido(mensaje)

                  return (
                    <div
                      key={mensaje.id}
                      className={`workspace-message-card space-y-4 ${
                        estaLeido ? "" : "workspace-message-card-unread"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-lg font-semibold tracking-[-0.02em]">
                              {mensaje.asunto || "Mensaje sin asunto"}
                            </p>
                            {!estaLeido && (
                              <span className="workspace-badge-unread">
                                No leido
                              </span>
                            )}
                          </div>
                          <p className="workspace-inline-note">{mensaje.autor_nombre}</p>
                          <p className="workspace-inline-note text-xs">
                            {formatearFechaHora(mensaje.created_at)}
                            {mensaje.updated_at &&
                            mensaje.updated_at !== mensaje.created_at
                              ? " · editado"
                              : ""}
                          </p>
                          <p className="workspace-inline-note text-xs">
                            {cantidadRespuestas === 0
                              ? "Sin respuestas"
                              : `${cantidadRespuestas} ${
                                  cantidadRespuestas === 1 ? "respuesta" : "respuestas"
                                }`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const abriendo = !mensajesAbiertos[mensaje.id]
                            setMensajesAbiertos((prev) => ({
                              ...prev,
                              [mensaje.id]: abriendo,
                            }))
                            if (abriendo) {
                              marcarHiloComoLeido(mensaje)
                            }
                          }}
                          className="workspace-button-secondary"
                        >
                          {mensajesAbiertos[mensaje.id] ? "Cerrar" : "Ver mensaje"}
                        </button>
                      </div>

                      {editandoEsteMensaje && (
                        <div className="workspace-stack-tight">
                          <input
                            className="workspace-field"
                            value={mensajeEditandoAsunto}
                            onChange={(e) => setMensajeEditandoAsunto(e.target.value)}
                            placeholder="Asunto del mensaje"
                          />
                          <textarea
                            className="workspace-field min-h-[100px]"
                            value={mensajeEditandoContenido}
                            onChange={(e) => setMensajeEditandoContenido(e.target.value)}
                          />
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => void handleEditarMensaje(mensaje.id)}
                              disabled={guardandoMensaje}
                              className="workspace-button-primary disabled:opacity-60"
                            >
                              {guardandoMensaje ? "Guardando..." : "Guardar edición"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMensajeEditandoId(null)
                                setMensajeEditandoAsunto("")
                                setMensajeEditandoContenido("")
                              }}
                              className="workspace-button-secondary"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {esAdmin && !editandoEsteMensaje && (
                        <button
                          type="button"
                          onClick={() => {
                            setMensajeEditandoId(mensaje.id)
                            setMensajeEditandoAsunto(mensaje.asunto || "")
                            setMensajeEditandoContenido(mensaje.contenido)
                          }}
                          className="workspace-button-secondary"
                        >
                          Editar mensaje
                        </button>
                      )}

                      {mensajesAbiertos[mensaje.id] && !editandoEsteMensaje && (
                        <div className="workspace-divider pt-4 space-y-3">
                          <p className="whitespace-pre-wrap text-sm text-gray-700">
                            {mensaje.contenido}
                          </p>

                          <h4 className="font-semibold">
                            Respuestas
                            {cantidadRespuestas > 0 ? ` (${cantidadRespuestas})` : ""}
                          </h4>

                          {respuestas.length === 0 && (
                            <p className="workspace-inline-note">
                              Todavía no hay respuestas en este hilo.
                            </p>
                          )}

                          {respuestas.map((respuesta) => (
                            <div key={respuesta.id} className="workspace-panel-soft !rounded-[1.1rem] space-y-1">
                              <p className="text-sm font-medium">{respuesta.autor_nombre}</p>
                              <p className="text-xs text-gray-500">
                                {formatearFechaHora(respuesta.created_at)}
                                {respuesta.updated_at &&
                                respuesta.updated_at !== respuesta.created_at
                                  ? " · editado"
                                  : ""}
                              </p>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                {respuesta.contenido}
                              </p>

                              {esAdmin && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMensajeEditandoId(respuesta.id)
                                    setMensajeEditandoAsunto("")
                                    setMensajeEditandoContenido(respuesta.contenido)
                                  }}
                                  className="workspace-button-secondary mt-2"
                                >
                                  Editar mensaje
                                </button>
                              )}
                            </div>
                          ))}

                          <textarea
                            className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.92)] p-3 min-h-[90px]"
                            placeholder="Responder a este hilo..."
                            value={respuestaActual}
                            onChange={(e) =>
                              setRespuestasDraft((prev) => ({
                                ...prev,
                                [mensaje.id]: e.target.value,
                              }))
                            }
                          />

                          <button
                            type="button"
                            onClick={() => void handleEnviarMensaje(mensaje.id)}
                            disabled={guardandoMensaje}
                            className="workspace-button-secondary disabled:opacity-60"
                          >
                            {guardandoMensaje && respondiendoMensajeId === mensaje.id
                              ? "Enviando..."
                              : "Responder"}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </SeccionDesplegable>

            {esAdmin && <ConectandoAdminPanel />}

            {tieneRecurso("grabaciones_conectando") && !esAdmin && (
              <SeccionDesplegable titulo="Biblioteca de grabaciones">
                <BibliotecaGrabaciones
                  actividadSlug="conectando-sentidos"
                  previewEnabled={MODO_PRUEBA}
                />
              </SeccionDesplegable>
            )}
          </div>
        )}
      </main>
  )
}
