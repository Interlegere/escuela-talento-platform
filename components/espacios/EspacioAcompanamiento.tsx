"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import PagoMensualCard from "@/components/pagos/PagoMensualCard"
import PagoReservaTerapiaCard from "@/components/pagos/PagoReservaTerapiaCard"
import ReservaTerapiaSection from "@/components/agenda/ReservaTerapiaSection"
import SeccionDesplegable from "@/components/SeccionDesplegable"
import { useActivityAccess } from "@/components/auth/useActivityAccess"
import ConsentimientoMeetButton from "@/components/consentimientos/ConsentimientoMeetButton"
import EditorMensajeAdmin from "@/components/espacios/EditorMensajeAdmin"
import type { EditorMensajeAdminHandle } from "@/components/espacios/EditorMensajeAdmin"
import RecursoCard from "@/components/recursos/RecursoCard"
import type { EspacioActividadSlug } from "@/lib/espacios"
import { supabase } from "@/lib/supabase"
import WorkspaceHero from "@/components/ui/WorkspaceHero"
import HoraEnZonaLocal from "@/components/ui/HoraEnZonaLocal"
import type { DocumentoNota } from "@/lib/documentos-notas"
import { tieneContenidoRecurso } from "@/lib/recursos"

type AccesoExtra = {
  id: number
  actividad_destino_slug: "casatalentos" | "conectando-sentidos"
  habilitado: boolean
  nota?: string | null
}

type Encuentro = {
  id: string | number
  reservaId?: number | null
  disponibilidadId?: number | null
  titulo: string
  fecha: string
  hora: string
  duracion: string
  estado: string
  medioPago?: string | null
  montoTransferencia?: string | null
  montoMercadoPago?: string | null
  porcentajeRecargoMercadoPago?: number | null
  comprobanteNombreArchivo?: string | null
  meetLink?: string | null
  puedeIngresar: boolean
  motivoBloqueo?: string | null
  notasDocumentos?: DocumentoNota[]
}

type Mensaje = {
  id: number
  parent_id?: number | null
  asunto?: string | null
  autor_email: string
  autor_nombre: string
  autor_rol: string
  contenido_texto?: string | null
  contenido_html?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type Participante = {
  email: string
  nombre: string
}

type Recurso = {
  id: number
  titulo: string
  descripcion?: string | null
  recurso_tipo: string
  url: string
  visible: boolean
}

type UploadPreparado = {
  bucket: string
  storagePath: string
  signedToken: string
  viewUrl: string
}

type Props = {
  actividadSlug: EspacioActividadSlug
  titulo: string
  subtitulo: string
  etiquetaEncuentros: string
  etiquetaMensajes: string
  mostrarAccesos?: boolean
}

const RESERVA_NUEVA_SESION_TERAPIA_HABILITADA = false

function mensajeBloqueoMensajeria(motivo?: string) {
  switch (motivo) {
    default:
      return "La mensajería no está habilitada por el momento."
  }
}

function mensajeBloqueoPagoGeneral(
  actividadSlug: EspacioActividadSlug,
  motivo?: string | null
) {
  if (motivo === "sin_actividad") {
    return actividadSlug === "mentorias"
      ? "Todavía falta asignar tu modalidad y tu pago de Mentoría para habilitar esta función."
      : "Todavía falta asignar el encuadre económico de esta actividad para habilitar esta función."
  }

  if (actividadSlug === "terapia") {
    if (motivo === "sesion") {
      return "En Terapia por sesión, el ingreso se habilita con el pago y la confirmación de cada encuentro."
    }

    return "Esta función se habilita cuando el pago del período actual o del proceso activo de Terapia está aprobado."
  }

  return "Esta función se habilita cuando el pago del período actual de Mentoría está aprobado."
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

function formatearDiaSolo(fecha?: string | null) {
  if (!fecha) return ""

  const d = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(d.getTime())) return fecha

  const dia = d.toLocaleDateString("es-AR", {
    weekday: "long",
  })

  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}`
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
    hourCycle: "h23",
  })
}

function resumenMensajeria(
  actividadSlug: EspacioActividadSlug,
  adminActivo: boolean
) {
  if (adminActivo) {
    return "Podés acompañar el proceso, responder mensajes y ordenar el espacio de trabajo."
  }

  if (actividadSlug === "terapia") {
    return "La mensajería terapéutica está habilitada para continuar el proceso entre sesiones."
  }

  return "La mensajería está disponible para acompañar tu proceso y sostener el intercambio."
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

export default function EspacioAcompanamiento({
  actividadSlug,
  titulo,
  subtitulo,
  etiquetaEncuentros,
  etiquetaMensajes,
  mostrarAccesos = false,
}: Props) {
  const {
    session,
    error,
    nombre,
    email,
    acceso,
    motivo,
    cargandoAcceso,
    sesionDemorada,
    sesionLista,
  } = useActivityAccess({
    activitySlug: actividadSlug,
  })

  const [cargandoResumen, setCargandoResumen] = useState(false)
  const [resumenInicializado, setResumenInicializado] = useState(false)
  const [cargandoParticipantes, setCargandoParticipantes] = useState(false)
  const [configuracionPendiente, setConfiguracionPendiente] = useState(false)
  const [mensajeError, setMensajeError] = useState("")
  const [mensajeInfo, setMensajeInfo] = useState("")
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [participanteActual, setParticipanteActual] = useState<Participante | null>(null)
  const [participanteSeleccionado, setParticipanteSeleccionado] = useState("")
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [encuentros, setEncuentros] = useState<Encuentro[]>([])
  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [accesosExtra, setAccesosExtra] = useState<AccesoExtra[]>([])
  const [mensajeriaHabilitada, setMensajeriaHabilitada] = useState(true)
  const [motivoMensajeria, setMotivoMensajeria] = useState<string | null>(null)
  const [pagoHabilitado, setPagoHabilitado] = useState(true)
  const [motivoPago, setMotivoPago] = useState<string | null>(null)

  const [mensajeTexto, setMensajeTexto] = useState("")
  const [mensajeHtml, setMensajeHtml] = useState("")
  const [mensajeAsunto, setMensajeAsunto] = useState("")
  const [respuestasTexto, setRespuestasTexto] = useState<Record<number, string>>({})
  const [respuestasHtml, setRespuestasHtml] = useState<Record<number, string>>({})
  const [mensajesAbiertos, setMensajesAbiertos] = useState<Record<number, boolean>>({})
  const [mensajesLeidos, setMensajesLeidos] = useState<Record<number, string>>({})
  const [mensajeEditandoId, setMensajeEditandoId] = useState<number | null>(null)
  const [mensajeEditandoAsunto, setMensajeEditandoAsunto] = useState("")
  const [mensajeEditandoTexto, setMensajeEditandoTexto] = useState("")
  const [mensajeEditandoHtml, setMensajeEditandoHtml] = useState("")
  const [guardandoEdicionMensaje, setGuardandoEdicionMensaje] = useState(false)
  const mensajeEditandoEditorRef = useRef<EditorMensajeAdminHandle | null>(null)

  const [recursoTitulo, setRecursoTitulo] = useState("")
  const [recursoDescripcion, setRecursoDescripcion] = useState("")
  const [recursoTipo, setRecursoTipo] = useState("enlace")
  const [recursoUrl, setRecursoUrl] = useState("")
  const [recursoVisible, setRecursoVisible] = useState(true)
  const [recursoArchivo, setRecursoArchivo] = useState<File | null>(null)
  const [subiendoAsset, setSubiendoAsset] = useState<null | "mensaje" | "recurso">(null)
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

  const adminActivo = session?.user?.role === "admin"
  const storageActorEmail = (session?.user?.email || email || "")
    .trim()
    .toLowerCase()
  const storageScope = (
    adminActivo
      ? participanteSeleccionado || participanteActual?.email || "admin"
      : email || session?.user?.email || "participante"
  )
    .trim()
    .toLowerCase()
  const uiStoragePrefix = storageActorEmail
    ? `entheos:v1:ui:${storageActorEmail}:${actividadSlug}:${storageScope}`
    : ""
  const uiKey = (campo: string) =>
    uiStoragePrefix ? `${uiStoragePrefix}:${campo}` : ""
  const claveStorageMensajesLeidos = useMemo(() => {
    const participanteClave = (
      adminActivo
        ? participanteSeleccionado || participanteActual?.email || "sin-participante"
        : email || session?.user?.email || "sin-email"
    )
      .trim()
      .toLowerCase()

    return `espacios_mensajes_leidos_${actividadSlug}_${participanteClave}`
  }, [
    actividadSlug,
    adminActivo,
    email,
    participanteActual?.email,
    participanteSeleccionado,
    session?.user?.email,
  ])

  const cargarResumen = useCallback(async (
    emailParticipante?: string,
    options?: { silencioso?: boolean }
  ) => {
    const silencioso = options?.silencioso === true

    try {
      if (!silencioso) {
        setCargandoResumen(true)
      }
      setMensajeError("")

      const res = await fetch("/api/espacios/resumen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividadSlug,
          participanteEmail: emailParticipante || undefined,
        }),
      })

      const data = await leerJson<{
        configuracionPendiente?: boolean
        esAdmin?: boolean
        mensajeriaHabilitada?: boolean
        motivoMensajeria?: string
        pagoHabilitado?: boolean
        motivoPago?: string
        participanteActual?: Participante | null
        mensajes?: Mensaje[]
        encuentros?: Encuentro[]
        recursos?: Recurso[]
        accesosExtra?: AccesoExtra[]
        error?: string
      }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo cargar el espacio.")
        return
      }

      setConfiguracionPendiente(Boolean(data.configuracionPendiente))
      setMensajeriaHabilitada(data.mensajeriaHabilitada !== false)
      setMotivoMensajeria(data.motivoMensajeria || null)
      setPagoHabilitado(data.pagoHabilitado !== false)
      setMotivoPago(data.motivoPago || null)
      setParticipanteActual(data.participanteActual || null)
      setMensajes(data.mensajes || [])
      setEncuentros(data.encuentros || [])
      setRecursos(data.recursos || [])
      setAccesosExtra(data.accesosExtra || [])
      setResumenInicializado(true)
    } catch {
      setMensajeError("Error cargando el espacio.")
    } finally {
      if (!silencioso) {
        setCargandoResumen(false)
      }
    }
  }, [actividadSlug])

  const cargarParticipantes = useCallback(async () => {
    try {
      setCargandoParticipantes(true)
      setMensajeError("")

      const res = await fetch("/api/espacios/participantes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividadSlug,
        }),
      })

      const data = await leerJson<{
        participantes?: Participante[]
        error?: string
      }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo cargar la lista de participantes.")
        return
      }

      const lista = data.participantes || []
      setParticipantes(lista)

      if (lista.length === 0) {
        setParticipanteActual(null)
        return
      }

      const participanteInicial =
        lista.find((item) => item.email === participanteSeleccionado) || lista[0]

      if (participanteInicial) {
        setParticipanteActual(participanteInicial)
        if (participanteInicial.email !== participanteSeleccionado) {
          setParticipanteSeleccionado(participanteInicial.email)
        }
      }
    } catch {
      setMensajeError("Error cargando la lista de participantes.")
    } finally {
      setCargandoParticipantes(false)
    }
  }, [actividadSlug, participanteSeleccionado])

  useEffect(() => {
    if (!sesionLista || !session || cargandoAcceso || !acceso) {
      return
    }

    if (adminActivo) {
      return
    }

    void cargarResumen(undefined)
  }, [
    sesionLista,
    session,
    cargandoAcceso,
    acceso,
    adminActivo,
    cargarResumen,
  ])

  useEffect(() => {
    if (!sesionLista || !session || cargandoAcceso || !acceso || !adminActivo) {
      return
    }

    void cargarParticipantes()
  }, [
    sesionLista,
    session,
    cargandoAcceso,
    acceso,
    adminActivo,
    cargarParticipantes,
  ])

  useEffect(() => {
    if (
      !sesionLista ||
      !session ||
      cargandoAcceso ||
      !acceso ||
      !adminActivo ||
      !participanteSeleccionado
    ) {
      return
    }

    void cargarResumen(participanteSeleccionado)
  }, [
    sesionLista,
    session,
    cargandoAcceso,
    acceso,
    adminActivo,
    participanteSeleccionado,
    cargarResumen,
  ])

  const puedeVerAccesos = mostrarAccesos && adminActivo
  const tituloEncuentro = actividadSlug === "terapia" ? "sesión" : "reunión"
  const tituloEncuentros =
    actividadSlug === "terapia" ? "sesiones" : "reuniones"
  const requierePagoParaMensajeria = actividadSlug === "terapia" && !adminActivo
  const vistaCompactaEncuentros =
    !adminActivo && actividadSlug === "mentorias"
  const mostrarPagoDentroDelEspacio = actividadSlug !== "mentorias"

  const firmaMensaje = (mensaje?: Mensaje | null) => {
    return mensaje?.updated_at || mensaje?.created_at || String(mensaje?.id || "")
  }

  const mensajesRaiz = useMemo(() => {
    return mensajes.filter((mensaje) => !mensaje.parent_id)
  }, [mensajes])

  const respuestasPorMensaje = useMemo(() => {
    const mapa = new Map<number, Mensaje[]>()

    for (const mensaje of mensajes) {
      if (!mensaje.parent_id) continue
      const actuales = mapa.get(mensaje.parent_id) || []
      actuales.push(mensaje)
      mapa.set(mensaje.parent_id, actuales)
    }

    return mapa
  }, [mensajes])

  const firmaHilo = (mensaje: Mensaje) => {
    const respuestas = respuestasPorMensaje.get(mensaje.id) || []

    return [mensaje, ...respuestas]
      .map((item) => firmaMensaje(item))
      .filter(Boolean)
      .sort()
      .at(-1) || String(mensaje.id)
  }

  const mensajeLeido = (mensaje: Mensaje) => {
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
        <span>{etiquetaMensajes}</span>
        {cantidadMensajesNoLeidos > 0 && (
          <span className="workspace-badge-unread">
            {cantidadMensajesNoLeidos} no leido
            {cantidadMensajesNoLeidos === 1 ? "" : "s"}
          </span>
        )}
      </span>
    )
  }, [cantidadMensajesNoLeidos, etiquetaMensajes])

  const marcarMensajeComoLeido = (mensaje: Mensaje) => {
    setMensajesLeidos((prev) => ({
      ...prev,
      [mensaje.id]: firmaHilo(mensaje),
    }))
  }

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(claveStorageMensajesLeidos)
      if (!raw) {
        setMensajesLeidos({})
        return
      }

      const parsed = JSON.parse(raw) as Record<number, string>
      setMensajesLeidos(parsed)
    } catch {
      setMensajesLeidos({})
    }
  }, [claveStorageMensajesLeidos])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        claveStorageMensajesLeidos,
        JSON.stringify(mensajesLeidos)
      )
    } catch {
      return
    }
  }, [claveStorageMensajesLeidos, mensajesLeidos])

  const encuentrosCompactos = useMemo(() => {
    if (!vistaCompactaEncuentros) {
      return encuentros
    }

    const mapa = new Map<string, Encuentro>()

    for (const item of encuentros) {
      const fecha = item.fecha ? new Date(`${item.fecha}T00:00:00`) : null
      const diaSemana = fecha
        ? fecha.toLocaleDateString("es-AR", { weekday: "long" }).toLowerCase()
        : item.fecha
      const clave = [item.titulo, diaSemana, item.hora, item.duracion].join("|")

      if (!mapa.has(clave)) {
        mapa.set(clave, item)
      }
    }

    return Array.from(mapa.values())
  }, [encuentros, vistaCompactaEncuentros])

  const renderDocumentosNotas = (item: Encuentro) => {
    if (!adminActivo || !item.meetLink) {
      return null
    }

    const documentos = item.notasDocumentos || []

    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.72)] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Antes del Meet
        </p>

        {documentos.length > 0 ? (
          <>
            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
              Toma de notas
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {documentos.map((documento, index) => (
                <a
                  key={`${item.id}-${documento.url}-${index}`}
                  href={documento.url}
                  target="_blank"
                  rel="noreferrer"
                  className="workspace-button-secondary !px-3 !py-1.5 text-xs"
                >
                  {documento.titulo}
                </a>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-[var(--muted)]">
            No hay documentos de notas cargados para este participante o encuentro.
          </p>
        )}
      </div>
    )
  }

  const inferirTipoRecursoDesdeArchivo = (file: File) => {
    if (file.type.startsWith("image/")) return "imagen"
    if (file.type.startsWith("video/")) return "video"
    return "archivo"
  }

  const subirArchivoEspacio = async (
    file: File,
    destino: "mensaje" | "recurso"
  ) => {
    setSubiendoAsset(destino)

    try {
      const prepararRes = await fetch("/api/espacios/preparar-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividadSlug,
          participanteEmail: adminActivo ? participanteSeleccionado || undefined : undefined,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          destino,
        }),
      })

      const preparacion = await leerJson<UploadPreparado & { error?: string }>(
        prepararRes
      )

      if (!prepararRes.ok) {
        throw new Error(preparacion.error || "No se pudo preparar la subida.")
      }

      const { error: uploadError } = await supabase.storage
        .from(preparacion.bucket)
        .uploadToSignedUrl(preparacion.storagePath, preparacion.signedToken, file)

      if (uploadError) {
        throw uploadError
      }

      return {
        url: preparacion.viewUrl,
        name: file.name,
        mimeType: file.type,
      }
    } finally {
      setSubiendoAsset(null)
    }
  }

  const guardarMensaje = async (parentId?: number) => {
    try {
      setMensajeError("")
      setMensajeInfo("")

      const contenidoTexto = parentId
        ? respuestasTexto[parentId]?.trim() || ""
        : mensajeTexto
      const contenidoHtml = parentId
        ? respuestasHtml[parentId]?.trim() || ""
        : mensajeHtml
      const asunto = parentId ? "" : mensajeAsunto

      const res = await fetch("/api/espacios/mensajes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividadSlug,
          participanteEmail: adminActivo ? participanteSeleccionado || undefined : undefined,
          parentId: parentId || null,
          asunto,
          contenidoTexto: adminActivo ? undefined : contenidoTexto,
          contenidoHtml: adminActivo ? contenidoHtml : undefined,
        }),
      })

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo guardar el mensaje.")
        return
      }

      if (parentId) {
        setRespuestasTexto((prev) => ({
          ...prev,
          [parentId]: "",
        }))
        setRespuestasHtml((prev) => ({
          ...prev,
          [parentId]: "",
        }))
        setMensajesAbiertos((prev) => ({
          ...prev,
          [parentId]: true,
        }))
      } else {
        setMensajeTexto("")
        setMensajeHtml("")
        setMensajeAsunto("")
      }
      setMensajeInfo("Mensaje guardado correctamente.")
      await cargarResumen(
        adminActivo ? participanteSeleccionado || undefined : undefined,
        { silencioso: true }
      )
    } catch {
      setMensajeError("Error guardando el mensaje.")
    }
  }

  const eliminarMensaje = async (mensajeId: number) => {
    const confirmar = window.confirm(
      "El mensaje dejará de verse en la plataforma. No se borrarán archivos ni datos físicos. ¿Querés continuar?"
    )

    if (!confirmar) return

    try {
      setMensajeError("")
      setMensajeInfo("")

      const res = await fetch("/api/espacios/mensajes", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividadSlug,
          participanteEmail: adminActivo ? participanteSeleccionado || undefined : undefined,
          mensajeId,
        }),
      })

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo eliminar el mensaje.")
        return
      }

      setMensajeInfo("Mensaje eliminado correctamente.")
      await cargarResumen(
        adminActivo ? participanteSeleccionado || undefined : undefined,
        { silencioso: true }
      )
    } catch {
      setMensajeError("Error eliminando el mensaje.")
    }
  }

  const iniciarEdicionMensaje = (mensaje: Mensaje) => {
    setMensajeError("")
    setMensajeInfo("")
    setMensajeEditandoId(mensaje.id)
    setMensajeEditandoAsunto(mensaje.parent_id ? "" : mensaje.asunto || "")
    setMensajeEditandoTexto(mensaje.contenido_texto || "")
    setMensajeEditandoHtml(mensaje.contenido_html || "")
  }

  const cancelarEdicionMensaje = () => {
    setMensajeEditandoId(null)
  }

  const guardarEdicionMensaje = async (mensajeId: number) => {
    const contenidoHtml = (
      mensajeEditandoEditorRef.current?.getHtml() || mensajeEditandoHtml
    ).trim()
    const contenidoTexto = (
      mensajeEditandoEditorRef.current?.getText() || mensajeEditandoTexto
    ).trim()

    if (!contenidoTexto) {
      setMensajeError("Escribí el contenido actualizado del mensaje.")
      return
    }

    try {
      setGuardandoEdicionMensaje(true)
      setMensajeError("")
      setMensajeInfo("")

      const res = await fetch("/api/espacios/mensajes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividadSlug,
          participanteEmail: adminActivo ? participanteSeleccionado || undefined : undefined,
          mensajeId,
          asunto: mensajeEditandoAsunto,
          contenidoTexto,
          contenidoHtml,
        }),
      })

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo editar el mensaje.")
        return
      }

      setMensajeInfo("Mensaje editado correctamente.")
      setMensajeEditandoId(null)
      await cargarResumen(
        adminActivo ? participanteSeleccionado || undefined : undefined,
        { silencioso: true }
      )
    } catch {
      setMensajeError("Error editando el mensaje.")
    } finally {
      setGuardandoEdicionMensaje(false)
    }
  }

  const guardarRecurso = async () => {
    try {
      setMensajeError("")
      setMensajeInfo("")
      let urlFinal = recursoUrl.trim()
      let tipoFinal = recursoTipo
      const descripcionFinal =
        recursoEditorRef.current?.getHtml() || recursoDescripcion

      if (
        !recursoTitulo.trim() ||
        !tieneContenidoRecurso({
          descripcion: descripcionFinal,
          url: urlFinal,
          tieneArchivo: Boolean(recursoArchivo),
        })
      ) {
        setMensajeError(
          "Completá el título y agregá una descripción, una URL o un archivo."
        )
        return
      }

      if (recursoArchivo) {
        const asset = await subirArchivoEspacio(recursoArchivo, "recurso")
        urlFinal = asset.url
        tipoFinal = inferirTipoRecursoDesdeArchivo(recursoArchivo)
      }

      const res = await fetch("/api/espacios/recursos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividadSlug,
          participanteEmail: participanteSeleccionado || undefined,
          titulo: recursoTitulo,
          descripcion: descripcionFinal,
          recursoTipo: tipoFinal,
          url: urlFinal,
          visible: recursoVisible,
        }),
      })

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo guardar el recurso.")
        return
      }

      setRecursoTitulo("")
      setRecursoDescripcion("")
      setRecursoTipo("enlace")
      setRecursoUrl("")
      setRecursoVisible(true)
      setRecursoArchivo(null)
      setMensajeInfo("Recurso guardado correctamente.")
      await cargarResumen(participanteSeleccionado || undefined, {
        silencioso: true,
      })
    } catch (error) {
      setMensajeError(
        error instanceof Error ? error.message : "Error guardando el recurso."
      )
    }
  }

  const cambiarVisibleRecurso = async (recursoId: number, visible: boolean) => {
    try {
      setMensajeError("")

      const res = await fetch("/api/espacios/recursos", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividadSlug,
          participanteEmail: participanteSeleccionado || undefined,
          recursoId,
          visible,
        }),
      })

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo actualizar el recurso.")
        return
      }

      await cargarResumen(participanteSeleccionado || undefined, {
        silencioso: true,
      })
    } catch {
      setMensajeError("Error actualizando el recurso.")
    }
  }

  const iniciarEdicionRecurso = (item: Recurso) => {
    setMensajeError("")
    setMensajeInfo("")
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
      setMensajeInfo("")

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

      const res = await fetch("/api/espacios/recursos", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividadSlug,
          participanteEmail: participanteSeleccionado || undefined,
          recursoId: recursoEditandoId,
          titulo: recursoEditTitulo,
          descripcion: descripcionFinal,
          recursoTipo: recursoEditTipo,
          url: recursoEditUrl,
          visible: recursoEditVisible,
        }),
      })

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo actualizar el recurso.")
        return
      }

      setMensajeInfo("Recurso actualizado correctamente.")
      setRecursoEditandoId(null)
      await cargarResumen(participanteSeleccionado || undefined, {
        silencioso: true,
      })
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
      setMensajeInfo("")
      setEliminandoRecursoId(recursoId)

      const res = await fetch("/api/espacios/recursos", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividadSlug,
          participanteEmail: participanteSeleccionado || undefined,
          recursoId,
        }),
      })

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo eliminar el recurso.")
        return
      }

      setMensajeInfo("Recurso eliminado correctamente.")
      if (recursoEditandoId === recursoId) {
        setRecursoEditandoId(null)
      }
      await cargarResumen(participanteSeleccionado || undefined, {
        silencioso: true,
      })
    } catch {
      setMensajeError("Error eliminando el recurso.")
    } finally {
      setEliminandoRecursoId(null)
    }
  }

  const guardarAccesoExtra = async (
    actividadDestinoSlug: "casatalentos" | "conectando-sentidos",
    habilitado: boolean
  ) => {
    try {
      setMensajeError("")

      const accesoExistente = accesosExtra.find(
        (item) => item.actividad_destino_slug === actividadDestinoSlug
      )

      const res = await fetch("/api/espacios/accesos-extra", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividadSlug,
          participanteEmail: participanteSeleccionado || undefined,
          actividadDestinoSlug,
          habilitado,
          nota: accesoExistente?.nota || null,
        }),
      })

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo guardar el acceso.")
        return
      }

      await cargarResumen(participanteSeleccionado || undefined, {
        silencioso: true,
      })
    } catch {
      setMensajeError("Error guardando el acceso.")
    }
  }

  if (!sesionLista) {
    return (
      <main className="workspace-page space-y-6">
        <WorkspaceHero
          eyebrow="Espacio individual"
          title={titulo}
          subtitle="Preparando tu acceso al espacio de trabajo."
        />

        <section className="workspace-panel space-y-3">
          <p>Cargando sesión y permisos...</p>
          {sesionDemorada && (
            <p className="workspace-inline-note text-amber-700">
              La sesión está tardando más de lo normal. Probá esperar unos segundos
              o volver a iniciar sesión.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="workspace-page space-y-6">
        <WorkspaceHero
          eyebrow="Espacio individual"
          title={titulo}
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
          eyebrow={adminActivo ? "Acompañamiento" : ""}
          title={titulo}
          subtitle={subtitulo}
        >
          <div className="flex flex-wrap gap-3">
            {actividadSlug === "terapia" ? (
              <>
                <span className="workspace-chip">Sesiones 1 a 1</span>
                <span className="workspace-chip">Escucha</span>
                <span className="workspace-chip">Análisis</span>
                <span className="workspace-chip">Trascendencia</span>
              </>
            ) : (
              <span className="workspace-chip">Compromiso por lo propio</span>
            )}
          </div>
        </WorkspaceHero>

        {cargandoAcceso && (
          <section className="workspace-panel">
            <p>Cargando acceso...</p>
          </section>
        )}

        {!cargandoAcceso && !acceso && (
          <>
            <section className="workspace-panel space-y-3">
              <h2 className="workspace-title-sm">Acceso no habilitado</h2>
              <p className="workspace-inline-note text-[var(--foreground)]">
                Para usar este espacio necesitás tener tu acceso activo.
              </p>
              <p className="workspace-inline-note">
                Estado detectado: {motivo || "sin acceso"}
              </p>
            </section>

            {mostrarPagoDentroDelEspacio && (
              <PagoMensualCard
                actividadSlug={actividadSlug}
                participanteNombre={nombre}
                participanteEmail={email}
              />
            )}
          </>
        )}

        {!cargandoAcceso && acceso && (
          <div className="space-y-4">
          {!adminActivo && (
            <section className="workspace-panel-soft space-y-3">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="workspace-chip">
                  {encuentros.length > 0
                    ? `${encuentros.length} ${tituloEncuentros} próximas`
                    : `Sin ${tituloEncuentros} próximas`}
                </span>
                <span className="workspace-chip">
                  {recursos.length > 0
                    ? `${recursos.length} recurso${recursos.length === 1 ? "" : "s"} disponible${recursos.length === 1 ? "" : "s"}`
                    : "Sin recursos cargados"}
                </span>
              </div>

              {actividadSlug === "terapia" && !mensajeriaHabilitada && (
                <p className="text-sm text-amber-700">
                  {resumenMensajeria(
                    actividadSlug,
                    adminActivo
                  )}
                </p>
              )}
            </section>
          )}

          {adminActivo && (
            <section className="workspace-panel space-y-3">
              <p className="workspace-eyebrow">Vista admin</p>
              <h2 className="text-xl font-semibold">Elegí a quién acompañar</h2>
              <p className="workspace-inline-note">
                Elegí el/la participante cuyo espacio querés gestionar.
              </p>

              <select
                className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.92)] p-3"
                value={participanteSeleccionado}
                disabled={cargandoParticipantes || participantes.length === 0}
                onChange={(e) => {
                  const value = e.target.value
                  setParticipanteSeleccionado(value)
                  const participante = participantes.find((item) => item.email === value) || null
                  setParticipanteActual(participante)
                }}
              >
                {cargandoParticipantes && (
                  <option value="">Cargando participantes...</option>
                )}
                {!cargandoParticipantes && participantes.length === 0 && (
                  <option value="">No hay participantes cargados</option>
                )}
                {participantes.map((item) => (
                  <option key={item.email} value={item.email}>
                    {item.nombre} · {item.email}
                  </option>
                ))}
              </select>

              {participanteActual && (
                <p className="workspace-inline-note">
                  Espacio actual: {participanteActual.nombre} ({participanteActual.email})
                </p>
              )}
            </section>
          )}

          {mensajeError && (
            <section className="workspace-panel text-red-600">
              {mensajeError}
            </section>
          )}

          {mensajeInfo && (
            <section className="workspace-panel text-green-700">
              {mensajeInfo}
            </section>
          )}

          {configuracionPendiente && (
            <section className="workspace-panel-soft bg-amber-50/80 space-y-2">
              <p className="font-medium">Configuración pendiente</p>
              <p className="workspace-inline-note text-[var(--foreground)]">
                Falta crear las tablas de espacios en Supabase para habilitar mensajes,
                recursos y accesos.
              </p>
            </section>
          )}

          {!configuracionPendiente && (
            <>
              {adminActivo &&
                (actividadSlug === "terapia" || actividadSlug === "mentorias") && (
                <section className="workspace-panel-soft space-y-3">
                  <p className="workspace-eyebrow">Programación centralizada</p>
                  <h2 className="text-xl font-semibold">
                    {actividadSlug === "terapia"
                      ? "Las sesiones se administran desde la agenda unificada"
                      : "Las reuniones TMV se administran desde la agenda unificada"}
                  </h2>
                  <p className="workspace-inline-note">
                    Para evitar duplicaciones, la agenda principal de la escuela
                    es ahora el lugar desde donde se crean y revisan los encuentros
                    de {actividadSlug === "terapia" ? " Terapia" : " Mentorías"},
                    con asignación por participante y lectura completa del mes.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/agenda" className="workspace-button-secondary">
                      Abrir agenda unificada
                    </Link>
                  </div>
                </section>
              )}

              <SeccionDesplegable
                titulo={tituloMensajes}
                storageKey={uiKey("seccion:mensajes")}
              >
                <div className="space-y-4">
                  {cargandoResumen && !resumenInicializado && (
                    <p className="workspace-inline-note">Cargando mensajes...</p>
                  )}

                  {!cargandoResumen && resumenInicializado && mensajesRaiz.length === 0 && (
                    <p className="workspace-inline-note">
                      Todavía no hay mensajes en este espacio.
                    </p>
                  )}

                  <div className="space-y-3">
                    {mensajesRaiz.map((item) => {
                      const estaLeido = mensajeLeido(item)
                      const abierto = Boolean(mensajesAbiertos[item.id])
                      const respuestas = respuestasPorMensaje.get(item.id) || []
                      const respuestaTextoActual = respuestasTexto[item.id] || ""
                      const respuestaHtmlActual = respuestasHtml[item.id] || ""

                      return (
                        <div
                          key={item.id}
                          className={`workspace-message-card space-y-3 ${
                            estaLeido ? "" : "workspace-message-card-unread"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-lg font-semibold tracking-[-0.02em]">
                                  {item.asunto?.trim() || "Mensaje sin asunto"}
                                </p>
                                {!estaLeido && (
                                  <span className="workspace-badge-unread">
                                    No leido
                                  </span>
                                )}
                              </div>

                              <p className="workspace-inline-note">
                                {item.autor_nombre} · {item.autor_rol}
                              </p>
                              <p className="workspace-inline-note text-xs">
                                {formatearFechaHora(item.created_at)}
                              </p>
                            </div>

                            <div className="flex gap-3 flex-wrap">
                              <button
                                type="button"
                                onClick={() => {
                                  const abriendo = !abierto
                                  setMensajesAbiertos((prev) => ({
                                    ...prev,
                                    [item.id]: abriendo,
                                  }))

                                  if (abriendo) {
                                    marcarMensajeComoLeido(item)
                                  }
                                }}
                                className="workspace-button-secondary"
                              >
                                {abierto ? "Cerrar" : "Ver mensaje"}
                              </button>
                              {adminActivo && mensajeEditandoId !== item.id && (
                                <button
                                  type="button"
                                  onClick={() => iniciarEdicionMensaje(item)}
                                  className="workspace-button-secondary"
                                >
                                  Editar mensaje
                                </button>
                              )}
                              {adminActivo && mensajeEditandoId !== item.id && (
                                <button
                                  type="button"
                                  onClick={() => void eliminarMensaje(item.id)}
                                  className="workspace-button-secondary"
                                >
                                  Eliminar mensaje
                                </button>
                              )}
                            </div>
                          </div>

                          {abierto && (
                            <div className="workspace-divider pt-4 space-y-4">
                              <div>
                                {mensajeEditandoId === item.id ? (
                                  <div className="space-y-3">
                                    <input
                                      className="workspace-field"
                                      placeholder="Asunto"
                                      value={mensajeEditandoAsunto}
                                      onChange={(e) => setMensajeEditandoAsunto(e.target.value)}
                                    />

                                    <EditorMensajeAdmin
                                      ref={mensajeEditandoEditorRef}
                                      value={mensajeEditandoHtml}
                                      onChange={setMensajeEditandoHtml}
                                    />

                                    <div className="flex gap-3 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={() => void guardarEdicionMensaje(item.id)}
                                        disabled={guardandoEdicionMensaje}
                                        className="workspace-button-primary disabled:opacity-60"
                                      >
                                        {guardandoEdicionMensaje ? "Guardando..." : "Guardar cambios"}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={cancelarEdicionMensaje}
                                        className="workspace-button-secondary"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                ) : item.contenido_html ? (
                                  <div
                                    className="max-w-none text-sm leading-7 text-gray-700"
                                    dangerouslySetInnerHTML={{ __html: item.contenido_html }}
                                  />
                                ) : (
                                  <p className="whitespace-pre-wrap text-sm text-gray-700">
                                    {item.contenido_texto}
                                  </p>
                                )}
                              </div>

                              {respuestas.length > 0 && (
                                <div className="space-y-3">
                                  <p className="workspace-eyebrow">Respuestas</p>

                                  {respuestas.map((respuesta) => (
                                    <div
                                      key={respuesta.id}
                                      className="rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.82)] p-4 space-y-2"
                                    >
                                      <div className="space-y-1">
                                        <p className="font-medium">
                                          {respuesta.autor_nombre}
                                        </p>
                                        <p className="workspace-inline-note text-xs">
                                          {formatearFechaHora(respuesta.created_at)}
                                        </p>
                                      </div>

                                      {mensajeEditandoId === respuesta.id ? (
                                        <div className="space-y-3">
                                          <EditorMensajeAdmin
                                            ref={mensajeEditandoEditorRef}
                                            value={mensajeEditandoHtml}
                                            onChange={setMensajeEditandoHtml}
                                          />

                                          <div className="flex gap-3 flex-wrap">
                                            <button
                                              type="button"
                                              onClick={() => void guardarEdicionMensaje(respuesta.id)}
                                              disabled={guardandoEdicionMensaje}
                                              className="workspace-button-primary disabled:opacity-60"
                                            >
                                              {guardandoEdicionMensaje
                                                ? "Guardando..."
                                                : "Guardar cambios"}
                                            </button>

                                            <button
                                              type="button"
                                              onClick={cancelarEdicionMensaje}
                                              className="workspace-button-secondary"
                                            >
                                              Cancelar
                                            </button>
                                          </div>
                                        </div>
                                      ) : respuesta.contenido_html ? (
                                        <div
                                          className="max-w-none text-sm leading-7 text-gray-700"
                                          dangerouslySetInnerHTML={{
                                            __html: respuesta.contenido_html,
                                          }}
                                        />
                                      ) : (
                                        <p className="whitespace-pre-wrap text-sm text-gray-700">
                                          {respuesta.contenido_texto}
                                        </p>
                                      )}
                                      {adminActivo && mensajeEditandoId !== respuesta.id && (
                                        <div className="flex gap-3 flex-wrap mt-2">
                                          <button
                                            type="button"
                                            onClick={() => iniciarEdicionMensaje(respuesta)}
                                            className="workspace-button-secondary"
                                          >
                                            Editar mensaje
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => void eliminarMensaje(respuesta.id)}
                                            className="workspace-button-secondary"
                                          >
                                            Eliminar mensaje
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.62)] p-4">
                                <p className="workspace-eyebrow">Responder hilo</p>

                                {adminActivo ? (
                                  <EditorMensajeAdmin
                                    value={respuestaHtmlActual}
                                    onChange={(value) =>
                                      setRespuestasHtml((prev) => ({
                                        ...prev,
                                        [item.id]: value,
                                      }))
                                    }
                                    onUploadImage={(file) => subirArchivoEspacio(file, "mensaje")}
                                    onUploadFile={(file) => subirArchivoEspacio(file, "mensaje")}
                                  />
                                ) : (
                                  <textarea
                                    className="workspace-field min-h-[110px]"
                                    placeholder="Escribí tu respuesta..."
                                    value={respuestaTextoActual}
                                    onChange={(e) =>
                                      setRespuestasTexto((prev) => ({
                                        ...prev,
                                        [item.id]: e.target.value,
                                      }))
                                    }
                                  />
                                )}

                                <button
                                  type="button"
                                  onClick={() => void guardarMensaje(item.id)}
                                  disabled={
                                    cargandoResumen ||
                                    subiendoAsset === "mensaje" ||
                                    (adminActivo
                                      ? !respuestaHtmlActual.trim()
                                      : !respuestaTextoActual.trim())
                                  }
                                  className="workspace-button-secondary disabled:opacity-60"
                                >
                                  Responder
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="workspace-divider pt-4 space-y-3">
                    <div className="space-y-1">
                      <p className="workspace-eyebrow">Nuevo mensaje</p>
                      <h3 className="font-semibold">Abrir un nuevo intercambio</h3>
                    </div>

                    <input
                      className="workspace-field"
                      placeholder="Asunto del mensaje"
                      value={mensajeAsunto}
                      onChange={(e) => setMensajeAsunto(e.target.value)}
                    />

                    {adminActivo ? (
                      <EditorMensajeAdmin
                        value={mensajeHtml}
                        onChange={setMensajeHtml}
                        onUploadImage={(file) => subirArchivoEspacio(file, "mensaje")}
                        onUploadFile={(file) => subirArchivoEspacio(file, "mensaje")}
                      />
                    ) : requierePagoParaMensajeria && !mensajeriaHabilitada ? (
                      <div className="space-y-2">
                        <p className="text-sm text-amber-700">
                          {mensajeBloqueoMensajeria(motivoMensajeria || undefined)}
                        </p>
                      </div>
                    ) : (
                      <textarea
                        className="workspace-field min-h-[120px]"
                        placeholder="Escribí tu mensaje..."
                        value={mensajeTexto}
                        onChange={(e) => setMensajeTexto(e.target.value)}
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => void guardarMensaje()}
                      disabled={
                        cargandoResumen ||
                        subiendoAsset === "mensaje" ||
                        !mensajeAsunto.trim() ||
                        (!adminActivo &&
                          requierePagoParaMensajeria &&
                          !mensajeriaHabilitada) ||
                        (!adminActivo && !mensajeTexto.trim()) ||
                        (adminActivo && !mensajeHtml.trim())
                      }
                      className="workspace-button-secondary disabled:opacity-60"
                    >
                      Enviar mensaje
                    </button>
                  </div>
                </div>
              </SeccionDesplegable>

              <SeccionDesplegable
                titulo={etiquetaEncuentros}
                storageKey={uiKey("seccion:encuentros")}
              >
                <div className="space-y-4">
                  {cargandoResumen && !resumenInicializado && (
                    <p className="workspace-inline-note">Cargando {tituloEncuentros}...</p>
                  )}

                  {!cargandoResumen && resumenInicializado && encuentros.length === 0 && (
                    <p className="workspace-inline-note">
                      No hay {tituloEncuentros} agendadas próximamente.
                    </p>
                  )}

                  {vistaCompactaEncuentros ? (
                    <div className="workspace-panel-soft space-y-3">
                      <p className="workspace-inline-note">
                        Tus reuniones fijas aparecen resumidas por día y horario.
                      </p>

                      <div className="space-y-3">
                        {encuentrosCompactos.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-4 flex-wrap border-b last:border-b-0 pb-3 last:pb-0"
                          >
                            <div className="space-y-1">
                              <p className="font-medium">
                                {formatearDiaSolo(item.fecha)} ·{" "}
                                <HoraEnZonaLocal fecha={item.fecha} hora={item.hora} />
                              </p>
                              <p className="workspace-inline-note">
                                {item.titulo} · {item.duracion} min
                              </p>
                              <div className="mt-2">{renderDocumentosNotas(item)}</div>
                            </div>

                            {item.puedeIngresar && item.meetLink ? (
                              <ConsentimientoMeetButton
                                actividad={actividadSlug}
                                href={item.meetLink}
                                disponibilidadId={item.disponibilidadId}
                                fechaEncuentro={item.fecha}
                                horaEncuentro={item.hora}
                                className="workspace-button-secondary"
                              >
                                Ir a Meet
                              </ConsentimientoMeetButton>
                            ) : (
                              <p className="text-sm text-amber-700">
                                {item.motivoBloqueo ||
                                  `Todavía no está habilitado el ingreso a esta ${tituloEncuentro}.`}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {!adminActivo &&
                        mostrarPagoDentroDelEspacio &&
                        !pagoHabilitado &&
                        encuentros.some((item) => !item.puedeIngresar) && (
                        <PagoMensualCard
                          actividadSlug={actividadSlug}
                          participanteNombre={nombre}
                          participanteEmail={email}
                        />
                      )}
                    </div>
                  ) : (
                    encuentros.map((item) => (
                      <div key={item.id} className="workspace-card-link !rounded-[1.4rem] !p-4 space-y-2">
                        <p className="font-medium">{item.titulo}</p>
                        <p className="workspace-inline-note">
                          {formatearFecha(item.fecha)} ·{" "}
                          <HoraEnZonaLocal fecha={item.fecha} hora={item.hora} />
                        </p>
                        <p className="workspace-inline-note">
                          Duración: {item.duracion} min
                        </p>
                        <p className="workspace-inline-note">
                          Estado: {item.estado}
                        </p>

                        {renderDocumentosNotas(item)}

                        {item.puedeIngresar && item.meetLink && (
                          <ConsentimientoMeetButton
                            actividad={actividadSlug}
                            href={item.meetLink}
                            disponibilidadId={item.disponibilidadId}
                            fechaEncuentro={item.fecha}
                            horaEncuentro={item.hora}
                            className="workspace-button-secondary"
                          >
                            Ingresar a la videollamada
                          </ConsentimientoMeetButton>
                        )}

                        {!item.puedeIngresar && (
                          <div className="space-y-3">
                            <p className="text-sm text-amber-700">
                              {item.motivoBloqueo ||
                                `Todavía no está habilitado el ingreso a esta ${tituloEncuentro}.`}
                            </p>

                            {!adminActivo &&
                              actividadSlug === "terapia" &&
                              item.estado === "pendiente_pago" &&
                              item.reservaId && (
                                <PagoReservaTerapiaCard
                                  reservaId={item.reservaId}
                                  montoTransferencia={item.montoTransferencia}
                                  montoMercadoPago={item.montoMercadoPago}
                                  porcentajeRecargoMercadoPago={
                                    item.porcentajeRecargoMercadoPago
                                  }
                                  comprobanteNombreArchivo={
                                    item.comprobanteNombreArchivo
                                  }
                                  onActualizado={() => cargarResumen(undefined, { silencioso: true })}
                                />
                              )}

                            {!adminActivo &&
                              mostrarPagoDentroDelEspacio &&
                              !pagoHabilitado &&
                              !(actividadSlug === "terapia" && motivoPago === "sesion") && (
                              <PagoMensualCard
                                actividadSlug={actividadSlug}
                                participanteNombre={nombre}
                                participanteEmail={email}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </SeccionDesplegable>

              {actividadSlug === "terapia" && RESERVA_NUEVA_SESION_TERAPIA_HABILITADA && (
                <ReservaTerapiaSection />
              )}

              <SeccionDesplegable
                titulo="Recursos"
                storageKey={uiKey("seccion:recursos")}
              >
                <div className="space-y-4">
                  {adminActivo && (
                    <div className="workspace-panel-soft space-y-3">
                      <div className="space-y-1">
                        <p className="workspace-eyebrow">Nuevo recurso</p>
                        <h3 className="font-semibold">Cargar recurso</h3>
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
                        onUploadImage={(file) => subirArchivoEspacio(file, "recurso")}
                        onUploadFile={(file) => subirArchivoEspacio(file, "recurso")}
                      />

                      <select
                        className="workspace-field"
                        value={recursoTipo}
                        onChange={(e) => setRecursoTipo(e.target.value)}
                        disabled={Boolean(recursoArchivo)}
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
                        placeholder={
                          recursoArchivo
                            ? "La URL se completará automáticamente al guardar el recurso."
                            : "URL"
                        }
                        value={recursoUrl}
                        onChange={(e) => setRecursoUrl(e.target.value)}
                        disabled={Boolean(recursoArchivo)}
                      />

                      <div className="space-y-2">
                        <label className="workspace-inline-note text-xs uppercase tracking-[0.12em]">
                          Imagen o archivo adjunto
                        </label>
                        <input
                          type="file"
                          accept=".pdf,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null
                            setRecursoArchivo(file)
                            if (file) {
                              setRecursoTipo(inferirTipoRecursoDesdeArchivo(file))
                              if (!recursoTitulo.trim()) {
                                setRecursoTitulo(file.name.replace(/\.[^.]+$/, ""))
                              }
                            }
                          }}
                        />
                        {recursoArchivo && (
                          <p className="workspace-inline-note">
                            Archivo listo para guardar: {recursoArchivo.name}
                          </p>
                        )}
                      </div>

                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={recursoVisible}
                          onChange={(e) => setRecursoVisible(e.target.checked)}
                        />
                        Visible para participante
                      </label>

                      <button
                        type="button"
                        onClick={() => void guardarRecurso()}
                        disabled={
                          subiendoAsset === "recurso" ||
                          !recursoTitulo.trim() ||
                          !tieneContenidoRecurso({
                            descripcion: recursoDescripcion,
                            url: recursoUrl,
                            tieneArchivo: Boolean(recursoArchivo),
                          })
                        }
                        className="workspace-button-secondary disabled:opacity-60"
                      >
                        {subiendoAsset === "recurso" ? "Subiendo recurso..." : "Guardar recurso"}
                      </button>
                    </div>
                  )}

                  {recursos.length === 0 && !cargandoResumen && (
                    <p className="text-gray-600">
                      Todavía no hay recursos cargados.
                    </p>
                  )}

                  {recursos.map((item) => {
                    if (adminActivo && recursoEditandoId === item.id) {
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
                            Visible para participante
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
                          adminActivo ? (
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={item.visible}
                                  onChange={(e) =>
                                    void cambiarVisibleRecurso(item.id, e.target.checked)
                                  }
                                />
                                Visible para participante
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

              {puedeVerAccesos && (
                <SeccionDesplegable
                  titulo="Accesos"
                  storageKey={uiKey("seccion:accesos")}
                >
                  <div className="space-y-4">
                    {[
                      {
                        slug: "casatalentos" as const,
                        nombre: "Entusiasmento",
                      },
                      {
                        slug: "conectando-sentidos" as const,
                        nombre: "Conectando Sentidos",
                      },
                    ].map((destino) => {
                      const accesoExtra = accesosExtra.find(
                        (item) => item.actividad_destino_slug === destino.slug
                      )
                      const habilitado = accesoExtra?.habilitado === true

                      return (
                        <div key={destino.slug} className="border rounded-xl p-4 space-y-2">
                          <p className="font-medium">{destino.nombre}</p>
                          <p className="text-sm text-gray-600">
                            Acceso complementario definido desde este espacio.
                          </p>

                          {adminActivo ? (
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={habilitado}
                                onChange={(e) =>
                                  void guardarAccesoExtra(
                                    destino.slug,
                                    e.target.checked
                                  )
                                }
                              />
                              Habilitar acceso
                            </label>
                          ) : habilitado ? (
                            pagoHabilitado ? (
                              <a
                                href={`/${destino.slug}`}
                                className="inline-block border px-3 py-2 rounded-xl"
                              >
                                Ir a {destino.nombre}
                              </a>
                            ) : (
                              <div className="space-y-3">
                                <p className="text-sm text-amber-700">
                                  {mensajeBloqueoPagoGeneral(
                                    actividadSlug,
                                    motivoPago
                                  )}
                                </p>
                                {mostrarPagoDentroDelEspacio && (
                                  <PagoMensualCard
                                    actividadSlug={actividadSlug}
                                    participanteNombre={nombre}
                                    participanteEmail={email}
                                  />
                                )}
                              </div>
                            )
                          ) : (
                            <p className="text-sm text-gray-500">
                              Todavía no está habilitado desde este espacio.
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </SeccionDesplegable>
              )}
            </>
          )}
          </div>
        )}
      </main>
  )
}
