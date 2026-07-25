"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import PagoMensualCard from "@/components/pagos/PagoMensualCard"
import BibliotecaGrabaciones from "@/components/BibliotecaGrabaciones"
import SeccionDesplegable from "@/components/SeccionDesplegable"
import AgendaActividad from "@/components/agenda/AgendaActividad"
import { useActivityAccess } from "@/components/auth/useActivityAccess"
import ConectandoAdminPanel from "@/components/conectando/ConectandoAdminPanel"
import EditorMensajeAdmin from "@/components/espacios/EditorMensajeAdmin"
import RecursoCard from "@/components/recursos/RecursoCard"
import type { EditorMensajeAdminHandle } from "@/components/espacios/EditorMensajeAdmin"
import { isDevelopmentPreviewEnabled } from "@/lib/dev-flags"
import WorkspaceHero from "@/components/ui/WorkspaceHero"
import { tieneContenidoRecurso } from "@/lib/recursos"

type Recurso = {
  id: number
  slug: string
  nombre: string
  descripcion?: string | null
  tipo: string
  proveedor: string
}

type RecursoConectando = {
  id: number
  titulo: string
  descripcion?: string | null
  recurso_tipo: string
  url: string
  visible: boolean
}

type MensajeGeneral = {
  id: number
  parent_id?: number | null
  asunto?: string | null
  autor_nombre: string
  autor_email?: string | null
  autor_rol?: string | null
  contenido: string
  contenido_html?: string | null
  created_at?: string
  updated_at?: string
}

const MODO_PRUEBA = isDevelopmentPreviewEnabled()
const BIBLIOTECA_GRABACIONES_HABILITADA = false
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

function escaparHtml(texto: string) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function textoPlanoAHtmlSeguro(texto: string) {
  return escaparHtml(texto).replaceAll("\n", "<br />")
}

function htmlATextoPlano(html: string) {
  if (typeof window === "undefined") {
    return html.replace(/<[^>]+>/g, " ").trim()
  }

  const contenedor = document.createElement("div")
  contenedor.innerHTML = html
  return (contenedor.innerText || contenedor.textContent || "").trim()
}

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
  const [mensajeDraftHtml, setMensajeDraftHtml] = useState("")
  const [respuestasDraft, setRespuestasDraft] = useState<Record<number, string>>({})
  const [respuestasDraftHtml, setRespuestasDraftHtml] = useState<Record<number, string>>({})
  const [guardandoMensaje, setGuardandoMensaje] = useState(false)
  const [respondiendoMensajeId, setRespondiendoMensajeId] = useState<number | null>(null)
  const [mensajeEditandoId, setMensajeEditandoId] = useState<number | null>(null)
  const [mensajeEditandoAsunto, setMensajeEditandoAsunto] = useState("")
  const [mensajeEditandoContenido, setMensajeEditandoContenido] = useState("")
  const [mensajeEditandoContenidoHtml, setMensajeEditandoContenidoHtml] = useState("")
  const [mensajeExito, setMensajeExito] = useState("")
  const [mensajeError, setMensajeError] = useState("")
  const [mensajesAbiertos, setMensajesAbiertos] = useState<Record<number, boolean>>({})
  const [mensajesLeidos, setMensajesLeidos] = useState<Record<number, string>>({})
  const [recursosConectando, setRecursosConectando] = useState<RecursoConectando[]>([])
  const [cargandoRecursos, setCargandoRecursos] = useState(false)
  const [recursoTitulo, setRecursoTitulo] = useState("")
  const [recursoDescripcion, setRecursoDescripcion] = useState("")
  const [recursoTipo, setRecursoTipo] = useState("enlace")
  const [recursoUrl, setRecursoUrl] = useState("")
  const [recursoVisible, setRecursoVisible] = useState(true)
  const recursoEditorRef = useRef<EditorMensajeAdminHandle | null>(null)
  const [recursoEditandoId, setRecursoEditandoId] = useState<number | null>(null)
  const [recursoEditTitulo, setRecursoEditTitulo] = useState("")
  const [recursoEditDescripcion, setRecursoEditDescripcion] = useState("")
  const [recursoEditTipo, setRecursoEditTipo] = useState("enlace")
  const [recursoEditUrl, setRecursoEditUrl] = useState("")
  const [recursoEditVisible, setRecursoEditVisible] = useState(true)
  const recursoEditEditorRef = useRef<EditorMensajeAdminHandle | null>(null)
  const [guardandoEdicionRecurso, setGuardandoEdicionRecurso] = useState(false)
  const [eliminandoRecursoId, setEliminandoRecursoId] = useState<number | null>(null)
  const editorNuevoMensajeRef = useRef<EditorMensajeAdminHandle | null>(null)
  const editorEdicionMensajeRef = useRef<EditorMensajeAdminHandle | null>(null)
  const editorRespuestaRef = useRef<Record<number, EditorMensajeAdminHandle | null>>({})
  const esAdmin = session?.user?.role === "admin"
  const storageEmail = (email || session?.user?.email || "").trim().toLowerCase()
  const storageRole = esAdmin ? "admin" : session?.user?.role || "participante"
  const uiStoragePrefix = storageEmail
    ? `entheos:v1:ui:${storageEmail}:${storageRole}:conectando-sentidos`
    : ""
  const uiKey = (campo: string) =>
    uiStoragePrefix ? `${uiStoragePrefix}:${campo}` : ""

  const tieneRecurso = (slug: string) => {
    return recursos.some((r) => r.slug === slug)
  }

  const cargarRecursosConectando = async () => {
    if (!session && !MODO_PRUEBA) {
      setRecursosConectando([])
      return
    }

    if (!esAdmin) {
      const recursosUsuario = recursos
        .filter((item) => item.tipo !== "reunion" && item.tipo !== "biblioteca")
        .map((item) => ({
          id: item.id,
          titulo: item.nombre,
          descripcion: item.descripcion || null,
          recurso_tipo: item.tipo,
          url: item.url || "",
          visible: true,
        }))

      setRecursosConectando(recursosUsuario.filter((item) => Boolean(item.url)))
      return
    }

    try {
      setCargandoRecursos(true)
      const res = await fetch("/api/conectando-sentidos/recursos")
      const data = await res.json()

      if (!res.ok) {
        setMensajeError(
          data.error || "No se pudieron cargar los recursos de Conectando."
        )
        return
      }

      setRecursosConectando(data.recursos || [])
    } catch {
      setMensajeError("Error cargando los recursos de Conectando.")
    } finally {
      setCargandoRecursos(false)
    }
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

  const cantidadMensajesNoLeidos = useMemo(() => {
    return mensajesRaiz.reduce((total, mensaje) => {
      return mensajesLeidos[mensaje.id] === firmaHilo(mensaje) ? total : total + 1
    }, 0)
  }, [mensajesLeidos, mensajesRaiz, respuestasPorMensaje])

  const tituloMensajes = useMemo(() => {
    return (
      <span className="flex items-center gap-2 flex-wrap">
        <span>Mensajes</span>
        {cantidadMensajesNoLeidos > 0 && (
          <span className="workspace-badge-unread">
            {cantidadMensajesNoLeidos} no leido
            {cantidadMensajesNoLeidos === 1 ? "" : "s"}
          </span>
        )}
      </span>
    )
  }, [cantidadMensajesNoLeidos])

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

  useEffect(() => {
    if (!sesionLista) return
    if (!acceso && !MODO_PRUEBA) return
    void cargarRecursosConectando()
  }, [acceso, esAdmin, recursos, sesionLista, session])

  const guardarRecurso = async () => {
    try {
      setMensajeExito("")
      setMensajeError("")
      const descripcionFinal =
        recursoEditorRef.current?.getHtml() || recursoDescripcion

      if (
        !recursoTitulo.trim() ||
        !tieneContenidoRecurso({
          descripcion: descripcionFinal,
          url: recursoUrl,
        })
      ) {
        setMensajeError(
          "Completá el título y agregá una descripción o una URL."
        )
        return
      }

      const res = await fetch("/api/conectando-sentidos/recursos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          titulo: recursoTitulo,
          descripcion: descripcionFinal,
          recursoTipo,
          url: recursoUrl,
          visible: recursoVisible,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo guardar el recurso.")
        return
      }

      setRecursoTitulo("")
      setRecursoDescripcion("")
      setRecursoTipo("enlace")
      setRecursoUrl("")
      setRecursoVisible(true)
      setMensajeExito("Recurso guardado correctamente.")
      await cargarRecursosConectando()
    } catch {
      setMensajeError("Error guardando el recurso.")
    }
  }

  const cambiarVisibleRecurso = async (recursoId: number, visible: boolean) => {
    try {
      setMensajeError("")

      const res = await fetch("/api/conectando-sentidos/recursos", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recursoId,
          visible,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo actualizar el recurso.")
        return
      }

      await cargarRecursosConectando()
    } catch {
      setMensajeError("Error actualizando el recurso.")
    }
  }

  const iniciarEdicionRecurso = (item: RecursoConectando) => {
    setMensajeError("")
    setMensajeExito("")
    setRecursoEditandoId(item.id)
    setRecursoEditTitulo(item.titulo)
    setRecursoEditDescripcion(item.descripcion || "")
    setRecursoEditTipo(item.recurso_tipo || "enlace")
    setRecursoEditUrl(item.url || "")
    setRecursoEditVisible(item.visible)
  }

  const cancelarEdicionRecurso = () => {
    setRecursoEditandoId(null)
  }

  const guardarEdicionRecurso = async () => {
    if (!recursoEditandoId) return

    try {
      setGuardandoEdicionRecurso(true)
      setMensajeError("")
      setMensajeExito("")

      const descripcionFinal =
        recursoEditEditorRef.current?.getHtml() || recursoEditDescripcion

      if (
        !recursoEditTitulo.trim() ||
        !tieneContenidoRecurso({
          descripcion: descripcionFinal,
          url: recursoEditUrl,
        })
      ) {
        setMensajeError("Completá el título y agregá una descripción o una URL.")
        return
      }

      const res = await fetch("/api/conectando-sentidos/recursos", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recursoId: recursoEditandoId,
          titulo: recursoEditTitulo,
          descripcion: descripcionFinal,
          recursoTipo: recursoEditTipo,
          url: recursoEditUrl,
          visible: recursoEditVisible,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo actualizar el recurso.")
        return
      }

      setMensajeExito("Recurso actualizado correctamente.")
      setRecursoEditandoId(null)
      await cargarRecursosConectando()
    } catch {
      setMensajeError("Error actualizando el recurso.")
    } finally {
      setGuardandoEdicionRecurso(false)
    }
  }

  const eliminarRecurso = async (recursoId: number) => {
    const confirmar = window.confirm(
      "¿Seguro que querés eliminar este recurso? Esta acción no se puede deshacer."
    )

    if (!confirmar) return

    try {
      setMensajeError("")
      setMensajeExito("")
      setEliminandoRecursoId(recursoId)

      const res = await fetch("/api/conectando-sentidos/recursos", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recursoId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo eliminar el recurso.")
        return
      }

      setMensajeExito("Recurso eliminado correctamente.")
      if (recursoEditandoId === recursoId) {
        setRecursoEditandoId(null)
      }
      await cargarRecursosConectando()
    } catch {
      setMensajeError("Error eliminando el recurso.")
    } finally {
      setEliminandoRecursoId(null)
    }
  }

  const handleEnviarMensaje = async (parentId?: number) => {
    const contenidoHtml = esAdmin
      ? parentId
        ? (
            editorRespuestaRef.current[parentId || 0]?.getHtml() ||
            respuestasDraftHtml[parentId] ||
            ""
          ).trim()
        : (editorNuevoMensajeRef.current?.getHtml() || mensajeDraftHtml || "").trim()
      : ""
    const contenido = esAdmin
      ? htmlATextoPlano(contenidoHtml)
      : parentId
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
          contenidoHtml: esAdmin ? contenidoHtml : undefined,
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
        setRespuestasDraftHtml((prev) => ({
          ...prev,
          [parentId]: "",
        }))
      } else {
        setAsuntoMensajeDraft("")
        setMensajeDraft("")
        setMensajeDraftHtml("")
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
    const editorActivo = editorRespuestaRef.current[mensajeId] || editorEdicionMensajeRef.current
    const contenidoHtml = esAdmin
      ? (editorActivo?.getHtml() || mensajeEditandoContenidoHtml || "").trim()
      : ""
    const contenido = esAdmin
      ? (editorActivo?.getText() || htmlATextoPlano(contenidoHtml)).trim()
      : mensajeEditandoContenido.trim()
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
          contenidoHtml: esAdmin ? contenidoHtml : undefined,
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
      setMensajeEditandoContenidoHtml("")
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

  const handleEliminarMensaje = async (mensajeId: number) => {
    const confirmar = window.confirm(
      "El mensaje dejará de verse en la plataforma. No se borrarán archivos ni datos físicos. ¿Querés continuar?"
    )

    if (!confirmar) return

    try {
      setGuardandoMensaje(true)
      setMensajeExito("")
      setMensajeError("")

      const res = await fetch("/api/conectando-sentidos/mensajes", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mensajeId,
          previewEnabled: MODO_PRUEBA,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo eliminar el mensaje.")
        return
      }

      setMensajeEditandoId(null)
      setMensajeExito("Mensaje eliminado correctamente.")
      await cargarMensajes()
    } catch {
      setMensajeError("Hubo un problema al eliminar el mensaje.")
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
            {!esAdmin && tieneRecurso("sesion_grupal_conectando") && (
              <SeccionDesplegable
                titulo="Próxima reunión"
                storageKey={uiKey("seccion:proxima-reunion")}
              >
                <AgendaActividad
                  actividadSlug="conectando-sentidos"
                  tituloSeccion="Próximo encuentro de Conectando Sentidos"
                  mostrarSoloProximo
                />
              </SeccionDesplegable>
            )}

            <SeccionDesplegable
              titulo={tituloMensajes}
              storageKey={uiKey("seccion:mensajes")}
            >
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
                  {esAdmin ? (
                    <EditorMensajeAdmin
                      ref={editorNuevoMensajeRef}
                      value={mensajeDraftHtml}
                      onChange={setMensajeDraftHtml}
                    />
                  ) : (
                    <textarea
                      className="workspace-field min-h-[110px]"
                      placeholder="Escribí aquí comentarios sobre la sesión, valoraciones, agradecimientos o algo que quieras compartir..."
                      value={mensajeDraft}
                      onChange={(e) => setMensajeDraft(e.target.value)}
                    />
                  )}

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
                          {esAdmin ? (
                            <EditorMensajeAdmin
                              ref={editorEdicionMensajeRef}
                              value={mensajeEditandoContenidoHtml}
                              onChange={setMensajeEditandoContenidoHtml}
                            />
                          ) : (
                            <textarea
                              className="workspace-field min-h-[100px]"
                              value={mensajeEditandoContenido}
                              onChange={(e) => setMensajeEditandoContenido(e.target.value)}
                            />
                          )}
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
                                setMensajeEditandoContenidoHtml("")
                              }}
                              className="workspace-button-secondary"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {esAdmin && !editandoEsteMensaje && (
                        <div className="flex gap-3 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setMensajeEditandoId(mensaje.id)
                              setMensajeEditandoAsunto(mensaje.asunto || "")
                              setMensajeEditandoContenido(mensaje.contenido)
                              setMensajeEditandoContenidoHtml(
                                mensaje.contenido_html ||
                                  textoPlanoAHtmlSeguro(mensaje.contenido)
                              )
                            }}
                            className="workspace-button-secondary"
                          >
                            Editar mensaje
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleEliminarMensaje(mensaje.id)}
                            disabled={guardandoMensaje}
                            className="workspace-button-secondary disabled:opacity-60"
                          >
                            Eliminar mensaje
                          </button>
                        </div>
                      )}

                      {mensajesAbiertos[mensaje.id] && !editandoEsteMensaje && (
                        <div className="workspace-divider pt-4 space-y-3">
                          {mensaje.contenido_html ? (
                            <div
                              className="break-words text-sm text-gray-700 [&_em]:italic [&_h3]:text-base [&_h3]:font-semibold [&_p]:my-2 [&_strong]:font-semibold"
                              dangerouslySetInnerHTML={{ __html: mensaje.contenido_html }}
                            />
                          ) : (
                            <p className="whitespace-pre-wrap text-sm text-gray-700">
                              {mensaje.contenido}
                            </p>
                          )}

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

                              {mensajeEditandoId === respuesta.id ? (
                                <div className="workspace-stack-tight pt-1">
                                  {esAdmin ? (
                                    <EditorMensajeAdmin
                                      ref={(instance) => {
                                        editorRespuestaRef.current[respuesta.id] = instance
                                      }}
                                      value={mensajeEditandoContenidoHtml}
                                      onChange={setMensajeEditandoContenidoHtml}
                                    />
                                  ) : (
                                    <textarea
                                      className="workspace-field min-h-[100px]"
                                      value={mensajeEditandoContenido}
                                      onChange={(e) =>
                                        setMensajeEditandoContenido(e.target.value)
                                      }
                                    />
                                  )}
                                  <div className="flex gap-3">
                                    <button
                                      type="button"
                                      onClick={() => void handleEditarMensaje(respuesta.id)}
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
                                        setMensajeEditandoContenidoHtml("")
                                      }}
                                      className="workspace-button-secondary"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {respuesta.contenido_html ? (
                                    <div
                                      className="break-words text-sm text-gray-700 [&_em]:italic [&_h3]:text-base [&_h3]:font-semibold [&_p]:my-2 [&_strong]:font-semibold"
                                      dangerouslySetInnerHTML={{
                                        __html: respuesta.contenido_html,
                                      }}
                                    />
                                  ) : (
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                      {respuesta.contenido}
                                    </p>
                                  )}

                                  {esAdmin && (
                                    <div className="mt-2 flex gap-3 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setMensajeEditandoId(respuesta.id)
                                          setMensajeEditandoAsunto("")
                                          setMensajeEditandoContenido(respuesta.contenido)
                                          setMensajeEditandoContenidoHtml(
                                            respuesta.contenido_html ||
                                              textoPlanoAHtmlSeguro(respuesta.contenido)
                                          )
                                        }}
                                        className="workspace-button-secondary"
                                      >
                                        Editar mensaje
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleEliminarMensaje(respuesta.id)}
                                        disabled={guardandoMensaje}
                                        className="workspace-button-secondary disabled:opacity-60"
                                      >
                                        Eliminar mensaje
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ))}

                          {esAdmin ? (
                            <EditorMensajeAdmin
                              ref={(instance) => {
                                editorRespuestaRef.current[mensaje.id] = instance
                              }}
                              value={respuestasDraftHtml[mensaje.id] || ""}
                              onChange={(value) =>
                                setRespuestasDraftHtml((prev) => ({
                                  ...prev,
                                  [mensaje.id]: value,
                                }))
                              }
                            />
                          ) : (
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
                          )}

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

            {esAdmin && (
              <SeccionDesplegable
                titulo="Próxima reunión"
                storageKey={uiKey("seccion:proxima-reunion")}
              >
                <AgendaActividad
                  actividadSlug="conectando-sentidos"
                  tituloSeccion="Próximo encuentro de Conectando Sentidos"
                  mostrarSoloProximo
                />
              </SeccionDesplegable>
            )}

            {esAdmin && <ConectandoAdminPanel />}

            {BIBLIOTECA_GRABACIONES_HABILITADA &&
              tieneRecurso("grabaciones_conectando") &&
              !esAdmin && (
              <SeccionDesplegable
                titulo="Biblioteca de grabaciones"
                storageKey={uiKey("seccion:biblioteca")}
              >
                <BibliotecaGrabaciones
                  actividadSlug="conectando-sentidos"
                  previewEnabled={MODO_PRUEBA}
                />
              </SeccionDesplegable>
            )}

            <SeccionDesplegable
              titulo="Recursos"
              storageKey={uiKey("seccion:recursos")}
            >
              <div className="space-y-4">
                {esAdmin && (
                  <div className="workspace-panel-soft space-y-3">
                    <div className="space-y-1">
                      <p className="workspace-eyebrow">Nuevo recurso</p>
                      <h3 className="text-lg font-semibold">Cargar recurso</h3>
                    </div>

                    <input
                      className="workspace-field"
                      placeholder="Título"
                      value={recursoTitulo}
                      onChange={(e) => setRecursoTitulo(e.target.value)}
                    />

                    <EditorMensajeAdmin
                      ref={recursoEditorRef}
                      value={recursoDescripcion}
                      onChange={setRecursoDescripcion}
                    />

                    <select
                      className="workspace-field"
                      value={recursoTipo}
                      onChange={(e) => setRecursoTipo(e.target.value)}
                    >
                      <option value="enlace">Enlace</option>
                      <option value="video">Video</option>
                      <option value="imagen">Imagen</option>
                      <option value="archivo">Archivo</option>
                      <option value="guia">Guía</option>
                    </select>

                    <input
                      className="workspace-field"
                      placeholder="URL"
                      value={recursoUrl}
                      onChange={(e) => setRecursoUrl(e.target.value)}
                    />

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={recursoVisible}
                        onChange={(e) => setRecursoVisible(e.target.checked)}
                      />
                      Visible para participantes
                    </label>

                    <button
                      type="button"
                      onClick={() => void guardarRecurso()}
                      className="workspace-button-secondary"
                      disabled={
                        !recursoTitulo.trim() ||
                        !tieneContenidoRecurso({
                          descripcion: recursoDescripcion,
                          url: recursoUrl,
                        })
                      }
                    >
                      Guardar recurso
                    </button>
                  </div>
                )}

                {cargandoRecursos && (
                  <p className="workspace-inline-note">Cargando recursos...</p>
                )}

                {!cargandoRecursos && recursosConectando.length === 0 && (
                  <p className="workspace-inline-note">
                    Todavía no hay recursos cargados.
                  </p>
                )}

                {recursosConectando.map((item) => {
                  if (esAdmin && recursoEditandoId === item.id) {
                    return (
                      <div
                        key={item.id}
                        className="workspace-panel-soft space-y-3 border border-[var(--line)]"
                      >
                        <input
                          className="workspace-field"
                          placeholder="Título"
                          value={recursoEditTitulo}
                          onChange={(e) => setRecursoEditTitulo(e.target.value)}
                        />

                        <EditorMensajeAdmin
                          ref={recursoEditEditorRef}
                          value={recursoEditDescripcion}
                          onChange={setRecursoEditDescripcion}
                        />

                        <select
                          className="workspace-field"
                          value={recursoEditTipo}
                          onChange={(e) => setRecursoEditTipo(e.target.value)}
                        >
                          <option value="enlace">Enlace</option>
                          <option value="video">Video</option>
                          <option value="imagen">Imagen</option>
                          <option value="archivo">Archivo</option>
                          <option value="grabacion">Grabación</option>
                          <option value="guia">Guía</option>
                        </select>

                        <input
                          className="workspace-field"
                          placeholder="URL"
                          value={recursoEditUrl}
                          onChange={(e) => setRecursoEditUrl(e.target.value)}
                        />

                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={recursoEditVisible}
                            onChange={(e) => setRecursoEditVisible(e.target.checked)}
                          />
                          Visible para participantes
                        </label>

                        <div className="flex gap-3 flex-wrap">
                          <button
                            type="button"
                            onClick={() => void guardarEdicionRecurso()}
                            disabled={guardandoEdicionRecurso}
                            className="workspace-button-primary disabled:opacity-60"
                          >
                            {guardandoEdicionRecurso ? "Guardando..." : "Guardar cambios"}
                          </button>

                          <button
                            type="button"
                            onClick={cancelarEdicionRecurso}
                            className="workspace-button-secondary"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <RecursoCard
                      key={item.id}
                      titulo={item.titulo}
                      descripcion={item.descripcion}
                      recursoTipo={item.recurso_tipo}
                      url={item.url}
                      footer={
                        esAdmin ? (
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={item.visible}
                                onChange={(e) =>
                                  void cambiarVisibleRecurso(item.id, e.target.checked)
                                }
                              />
                              Visible para participantes
                            </label>

                            <div className="flex gap-3 flex-wrap">
                              <button
                                type="button"
                                onClick={() => iniciarEdicionRecurso(item)}
                                className="text-sm text-blue-600 underline"
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                onClick={() => void eliminarRecurso(item.id)}
                                disabled={eliminandoRecursoId === item.id}
                                className="text-sm text-red-600 underline disabled:opacity-60"
                              >
                                {eliminandoRecursoId === item.id
                                  ? "Eliminando..."
                                  : "Eliminar"}
                              </button>
                            </div>
                          </div>
                        ) : undefined
                      }
                    />
                  )
                })}
              </div>
            </SeccionDesplegable>
          </div>
        )}
      </main>
  )
}
