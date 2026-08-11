"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import PagoMensualCard from "@/components/pagos/PagoMensualCard"
import SeccionDesplegable from "@/components/SeccionDesplegable"
import VideoEmbed from "@/components/VideoEmbed"
import GrabadorVideo from "@/components/casatalentos/GrabadorVideo"
import GrabadorAudio from "@/components/casatalentos/GrabadorAudio"
import ConsentimientoMeetButton from "@/components/consentimientos/ConsentimientoMeetButton"
import { useActivityAccess } from "@/components/auth/useActivityAccess"
import CasaTalentosAdminPanel from "@/components/casatalentos/CasaTalentosAdminPanel"
import EditorMensajeAdmin from "@/components/espacios/EditorMensajeAdmin"
import type { EditorMensajeAdminHandle } from "@/components/espacios/EditorMensajeAdmin"
import { isDevelopmentPreviewEnabled } from "@/lib/dev-flags"
import { obtenerPartesArgentina } from "@/lib/fechas"
import { supabase } from "@/lib/supabase"
import WorkspaceHero from "@/components/ui/WorkspaceHero"
import { usePersistentState } from "@/hooks/usePersistentState"
import { useSessionDraft } from "@/hooks/useSessionDraft"
import RecursoCard from "@/components/recursos/RecursoCard"
import { tieneContenidoRecurso } from "@/lib/recursos"

type Recurso = {
  id: number
  slug: string
  nombre: string
  descripcion?: string | null
  tipo: string
  proveedor: string
  url?: string | null
  drive_file_id?: string | null
}

type RecursoGestion = {
  id: number
  actividadRecursoId?: number
  slug?: string | null
  titulo: string
  descripcion?: string | null
  recurso_tipo: string
  url?: string | null
  visible: boolean
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
  votante_rol?: string | null
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

type ReferentesGenerales = {
  id: number
  contenido: string
}

type ReferenteSemanal = {
  id: number
  fecha_semana: string
  titulo: string
  descripcion?: string | null
  video_url?: string | null
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

type PrepararUploadResponse = {
  ok?: boolean
  error?: string
  bucket?: string
  storagePath?: string
  signedToken?: string
  signedUrl?: string
  diaClave?: string
  fechaSemana?: string
  maxBytes?: number
}

type ProyectoEntusiasmo = {
  id: number
  participante_email: string
  participante_nombre: string | null
  que: string | null
  para_que: string | null
  problema_solucion: string | null
  resultado_semanal: string | null
  resultado_mensual: string | null
  resultado_trimestral: string | null
  resultado_anual: string | null
  habilidad_a_desarrollar: string | null
  que_te_entusiasma: string | null
  pitch_contenido: string | null
  pitch_storage_path: string | null
  pitch_mime_type: string | null
  pitch_actualizado_at: string | null
}

type CoordenadasForm = {
  que: string
  paraQue: string
  problemaSolucion: string
  resultadoSemanal: string
  resultadoMensual: string
  resultadoTrimestral: string
  resultadoAnual: string
  habilidadADesarrollar: string
  queTeEntusiasma: string
  pitchContenido: string
}

const COORDENADAS_VACIAS: CoordenadasForm = {
  que: "",
  paraQue: "",
  problemaSolucion: "",
  resultadoSemanal: "",
  resultadoMensual: "",
  resultadoTrimestral: "",
  resultadoAnual: "",
  habilidadADesarrollar: "",
  queTeEntusiasma: "",
  pitchContenido: "",
}

type PrepararUploadPitchResponse = {
  ok?: boolean
  error?: string
  bucket?: string
  storagePath?: string
  signedToken?: string
  signedUrl?: string
  mimeType?: string
  maxBytes?: number
}

type ProximoEncuentro = {
  id: string
  disponibilidadId?: number | null
  fecha: string
  hora: string
  meetLink?: string | null
  puedeIngresar: boolean
}

type AporteItem = {
  id: number
  autor_nombre: string | null
  autor_email: string | null
  contenido: string
  created_at: string
}

type ProduccionItem = {
  id: number
  tipo: string
  titulo: string | null
  contenido: string | null
  storage_path: string | null
  mime_type: string | null
  visible: boolean
  created_at: string
  signedUrl?: string | null
}

type TareaItem = {
  id: number
  contenido: string
  completada: boolean
  created_at: string
}

type PrepararUploadProduccionResponse = {
  ok?: boolean
  error?: string
  bucket?: string
  storagePath?: string
  signedToken?: string
  signedUrl?: string
  mimeType?: string
  maxBytes?: number
}

const MODO_PRUEBA = isDevelopmentPreviewEnabled()
// Flag temporal: Entusiasmento (Mi espacio/CoFruto) todavía se está
// terminando de armar. Cambiar a `true` cuando esté listo para que lo
// usen los participantes — hasta entonces solo admin lo ve completo.
const ENTUSIASMENTO_ABIERTO_A_PARTICIPANTES = false
// Excepción puntual mientras el flag de arriba sigue en false: emails que
// igual pueden entrar a probarlo como participante (ej. para probar un
// bug reportado). Sacar de acá cuando ya no haga falta.
const ENTUSIASMENTO_BETA_EMAILS = ["consultasbpe@gmail.com"]
const STORAGE_MENSAJES_LEIDOS_CASATALENTOS = "casatalentos_mensajes_leidos"
const CAMPOS_COORDENADAS: Array<keyof CoordenadasForm> = [
  "que",
  "paraQue",
  "problemaSolucion",
  "resultadoSemanal",
  "resultadoMensual",
  "resultadoTrimestral",
  "resultadoAnual",
  "habilidadADesarrollar",
  "queTeEntusiasma",
]
const RECURSOS_PRUEBA_CASATALENTOS: Recurso[] = [
  {
    id: 999001,
    slug: "biblioteca_grabaciones_casatalentos",
    nombre: "Biblioteca de grabaciones CasaTalentos",
    descripcion: "Modo prueba",
    tipo: "biblioteca",
    proveedor: "google_drive",
  },
  {
    id: 999002,
    slug: "dispositivo_videos_casatalentos",
    nombre: "Dispositivo semanal de videos CasaTalentos",
    descripcion: "Modo prueba",
    tipo: "dinamica",
    proveedor: "interno",
  },
  {
    id: 999003,
    slug: "reunion_semanal_casatalentos",
    nombre: "Reunión semanal CasaTalentos",
    descripcion: "Modo prueba",
    tipo: "reunion",
    proveedor: "interno",
  },
]
const RECURSOS_OCULTOS_SOLAPA = new Set([
  "biblioteca_grabaciones_casatalentos",
  "dispositivo_videos_casatalentos",
  "reunion_semanal_casatalentos",
])

function esRecursoSolapaCasaTalentos(recurso: Recurso) {
  if (RECURSOS_OCULTOS_SOLAPA.has(recurso.slug)) {
    return false
  }

  return (
    recurso.tipo !== "reunion" &&
    recurso.tipo !== "biblioteca" &&
    recurso.tipo !== "dinamica"
  )
}

function escaparHtml(texto: string) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function textoPlanoAHtmlSeguro(texto: string) {
  return escaparHtml(texto).replaceAll("\n", "<br />")
}

function contieneHtml(valor?: string | null) {
  return /<\/?[a-z][\s\S]*>/i.test(String(valor || ""))
}

function htmlATextoPlano(html: string) {
  if (typeof window === "undefined") {
    return html.replace(/<[^>]+>/g, " ").trim()
  }

  const contenedor = document.createElement("div")
  contenedor.innerHTML = html
  return (contenedor.innerText || contenedor.textContent || "").trim()
}

function formatearFecha(fecha?: string | null) {
  if (!fecha) return "Sin fecha"
  const d = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(d.getTime())) return fecha

  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatearFechaHora(fecha?: string | null) {
  if (!fecha) return "Sin fecha"
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

function claveParticipante(video: {
  participante_email?: string | null
  participante_nombre: string
}) {
  return (video.participante_email || video.participante_nombre || "")
    .trim()
    .toLowerCase()
}

function claveVotante(voto: {
  votante_email?: string | null
  votante_nombre: string
}) {
  return (voto.votante_email || voto.votante_nombre || "")
    .trim()
    .toLowerCase()
}

function normalizarClaveDia(dia?: string | null) {
  return (dia || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function pesoEvaluacion(voto: VotoItem) {
  return String(voto.votante_rol || "").trim().toLowerCase() === "admin" ? 2 : 1
}

function ordenDia(dia?: string | null) {
  switch (normalizarClaveDia(dia)) {
    case "lunes":
      return 1
    case "miercoles":
      return 2
    default:
      return 99
  }
}

function ordenarVideosPorProceso(videos: VideoItem[]) {
  return [...videos].sort((a, b) => {
    const orden = ordenDia(a.dia_clave || a.dia) - ordenDia(b.dia_clave || b.dia)
    if (orden !== 0) return orden

    return String(a.created_at || "").localeCompare(String(b.created_at || ""))
  })
}

function obtenerVideoRepresentativo(videos: VideoItem[]) {
  const ordenados = ordenarVideosPorProceso(videos)
  const miercoles = [...ordenados]
    .reverse()
    .find((video) => normalizarClaveDia(video.dia_clave || video.dia) === "miercoles")

  if (miercoles) {
    return miercoles
  }

  return ordenados[ordenados.length - 1] || ordenados[0] || null
}

function normalizarFechaSemana(fecha?: string | null) {
  if (!fecha) return ""

  const base = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(base.getTime())) {
    return fecha
  }

  const dia = base.getDay()
  const desplazamiento = dia === 0 ? -6 : 1 - dia
  base.setDate(base.getDate() + desplazamiento)

  const year = base.getFullYear()
  const month = String(base.getMonth() + 1).padStart(2, "0")
  const day = String(base.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function obtenerAhoraArgentinaCliente() {
  const ahora = obtenerPartesArgentina()
  const weekday = ahora.weekdayShort

  const numeroDia =
    weekday === "Sun"
      ? 0
      : weekday === "Mon"
        ? 1
        : weekday === "Tue"
          ? 2
          : weekday === "Wed"
            ? 3
            : weekday === "Thu"
              ? 4
              : weekday === "Fri"
                ? 5
                : weekday === "Sat"
                  ? 6
                  : 0

  return {
    weekday,
    year: ahora.year,
    month: ahora.month,
    day: ahora.day,
    hour: ahora.hour,
    minute: ahora.minute,
    numeroDia,
    fechaIso: `${String(ahora.year).padStart(4, "0")}-${String(ahora.month).padStart(
      2,
      "0"
    )}-${String(ahora.day).padStart(2, "0")}`,
  }
}

function resultadosDisponiblesSegunAhora(ahora: ReturnType<typeof obtenerAhoraArgentinaCliente>) {
  if (ahora.weekday === "Thu") {
    const minutosActuales = ahora.hour * 60 + ahora.minute
    return minutosActuales > 17 * 60
  }

  return ahora.numeroDia >= 5 || ahora.numeroDia === 0
}

async function leerRespuestaJson<T>(res: Response): Promise<T> {
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

export default function CasaTalentosPage() {
  const {
    session,
    status,
    error,
    nombre,
    email,
    acceso,
    motivo,
    recursos,
    cargandoAcceso,
    sesionDemorada,
    sesionLista,
    recargarAcceso,
  } = useActivityAccess({
    activitySlug: "casatalentos",
    previewEnabled: MODO_PRUEBA,
    previewResources: RECURSOS_PRUEBA_CASATALENTOS,
  })

  const [mounted, setMounted] = useState(false)

  const [videos, setVideos] = useState<VideoItem[]>([])
  const [votos, setVotos] = useState<VotoItem[]>([])
  const [comentarios, setComentarios] = useState<ComentarioItem[]>([])
  const [referentesGenerales, setReferentesGenerales] = useState<ReferentesGenerales | null>(null)
  const [referentesSemanales, setReferentesSemanales] = useState<ReferenteSemanal[]>([])
  const [mensajesGenerales, setMensajesGenerales] = useState<MensajeGeneral[]>([])
  const [participantesActivosCasaTalentos, setParticipantesActivosCasaTalentos] = useState<
    { email: string; nombre: string }[]
  >([])

  const [archivo, setArchivo] = useState<File | null>(null)
  const [titulo, setTitulo] = useState("")
  const [nombreParticipante, setNombreParticipante] = useState("")
  const [videoAbierto, setVideoAbierto] = useState<string | null>(null)
  const [elegidoSeleccionado, setElegidoSeleccionado] = useState<number | null>(null)
  const [eliminandoVideoId, setEliminandoVideoId] = useState<number | null>(null)
  const esAdmin = session?.user?.role === "admin"
  const storageEmail = (email || session?.user?.email || "")
    .trim()
    .toLowerCase()
  const storageRole = esAdmin ? "admin" : session?.user?.role || "participante"
  const uiStoragePrefix = storageEmail
    ? `entheos:v1:ui:${storageEmail}:${storageRole}:casatalentos`
    : ""
  const uiKey = (campo: string) =>
    uiStoragePrefix ? `${uiStoragePrefix}:${campo}` : ""
  const [subsolapaDispositivo, setSubsolapaDispositivo] = usePersistentState<
    "referentes" | "videos" | "evaluacion"
  >(uiKey("dispositivo:subtab"), "referentes", {
    enabled: Boolean(uiStoragePrefix),
  })
  const [numeroDia, setNumeroDia] = useState<number>(0)
  const [ahoraArgentina, setAhoraArgentina] = useState(() =>
    obtenerAhoraArgentinaCliente()
  )

  const [proyecto, setProyecto] = useState<ProyectoEntusiasmo | null>(null)
  const [pitchSignedUrl, setPitchSignedUrl] = useState<string | null>(null)
  const [cargandoProyecto, setCargandoProyecto] = useState(false)
  const [coordenadas, setCoordenadas] = useState<CoordenadasForm>(COORDENADAS_VACIAS)
  const [coordenadasAbiertas, setCoordenadasAbiertas] = useState(false)
  const [guardandoCoordenadas, setGuardandoCoordenadas] = useState(false)
  const [mensajeCoordenadas, setMensajeCoordenadas] = useState("")
  const [archivoPitch, setArchivoPitch] = useState<File | null>(null)
  const [subiendoPitch, setSubiendoPitch] = useState(false)
  const [estadoSubidaPitch, setEstadoSubidaPitch] = useState("")
  const [mensajePitch, setMensajePitch] = useState("")
  const [destinoEntusiasmo, setDestinoEntusiasmo] = usePersistentState<
    "mi-espacio" | "cofruto"
  >(uiKey("entusiasmo:destino"), "mi-espacio", {
    enabled: Boolean(uiStoragePrefix),
  })
  const coordenadasSinDefinir = CAMPOS_COORDENADAS.filter(
    (campo) => !coordenadas[campo].trim()
  ).length
  const [proximoEncuentro, setProximoEncuentro] = useState<ProximoEncuentro | null>(null)
  const [aportesRecibidos, setAportesRecibidos] = useState<AporteItem[]>([])
  const [aporteDestinatario, setAporteDestinatario] = useState("")
  const [aporteContenido, setAporteContenido] = useState("")
  const [enviandoAporte, setEnviandoAporte] = useState(false)
  const [mensajeAporte, setMensajeAporte] = useState("")
  const [valoracionesAbiertas, setValoracionesAbiertas] = useState(false)
  const [producciones, setProducciones] = useState<ProduccionItem[]>([])
  const [tituloProduccion, setTituloProduccion] = useState("")
  const [textoProduccion, setTextoProduccion] = useState("")
  const [archivoProduccion, setArchivoProduccion] = useState<File | null>(null)
  const [tipoNuevaProduccion, setTipoNuevaProduccion] = useState<"texto" | "imagen" | "audio">(
    "texto"
  )
  const [guardandoProduccion, setGuardandoProduccion] = useState(false)
  const [mensajeProduccion, setMensajeProduccion] = useState("")
  const [tareas, setTareas] = useState<TareaItem[]>([])
  const [nuevaTarea, setNuevaTarea] = useState("")
  const [guardandoTarea, setGuardandoTarea] = useState(false)
  const [mensajeTarea, setMensajeTarea] = useState("")

  const [mensajeExito, setMensajeExito] = useState("")
  const [mensajeError, setMensajeError] = useState("")
  const [subiendoVideo, setSubiendoVideo] = useState(false)
  const [estadoSubidaVideo, setEstadoSubidaVideo] = useState("")
  const [eligiendo, setEligiendo] = useState(false)
  const [recursoTitulo, setRecursoTitulo] = useState("")
  const [recursoDescripcion, setRecursoDescripcion] = useState("")
  const [recursoTipo, setRecursoTipo] = useState("enlace")
  const [recursoUrl, setRecursoUrl] = useState("")
  const [recursoVisible, setRecursoVisible] = useState(true)
  const recursoEditorRef = useRef<EditorMensajeAdminHandle | null>(null)
  const [guardandoRecurso, setGuardandoRecurso] = useState(false)
  const [recursosAdminGestion, setRecursosAdminGestion] = useState<RecursoGestion[]>([])
  const [recursoEditandoId, setRecursoEditandoId] = useState<number | null>(null)
  const [recursoEditTitulo, setRecursoEditTitulo] = useState("")
  const [recursoEditDescripcion, setRecursoEditDescripcion] = useState("")
  const [recursoEditTipo, setRecursoEditTipo] = useState("enlace")
  const [recursoEditUrl, setRecursoEditUrl] = useState("")
  const [recursoEditVisible, setRecursoEditVisible] = useState(true)
  const recursoEditEditorRef = useRef<EditorMensajeAdminHandle | null>(null)
  const [guardandoEdicionRecurso, setGuardandoEdicionRecurso] = useState(false)
  const [eliminandoRecursoId, setEliminandoRecursoId] = useState<number | null>(null)

  const draftOwner = storageEmail
  const draftKey = (campo: string) =>
    `entheos:v1:draft:${draftOwner}:casatalentos:${campo}`
  const recordVacio = (value: Record<number, string>) =>
    Object.values(value).every((item) => !String(item || "").trim())

  const [comentariosDraft, setComentariosDraft] = useState<Record<number, string>>({})
  const [comentandoVideoId, setComentandoVideoId] = useState<number | null>(null)
  const {
    value: mensajeGeneralDraft,
    setValue: setMensajeGeneralDraft,
    clearDraft: clearMensajeGeneralDraft,
  } = useSessionDraft(draftKey("mensaje:general:texto"), "", {
    enabled: Boolean(draftOwner),
    isEmpty: (value) => !value.trim(),
  })
  const {
    value: mensajeGeneralDraftHtml,
    setValue: setMensajeGeneralDraftHtml,
    clearDraft: clearMensajeGeneralDraftHtml,
  } = useSessionDraft(draftKey("mensaje:general:html"), "", {
    enabled: Boolean(draftOwner),
    isEmpty: (value) => !value.trim(),
  })
  const {
    value: asuntoMensajeGeneralDraft,
    setValue: setAsuntoMensajeGeneralDraft,
    clearDraft: clearAsuntoMensajeGeneralDraft,
  } = useSessionDraft(draftKey("mensaje:general:asunto"), "", {
    enabled: Boolean(draftOwner),
    isEmpty: (value) => !value.trim(),
  })
  const {
    value: respuestasDraft,
    setValue: setRespuestasDraft,
  } = useSessionDraft<Record<number, string>>(
    draftKey("mensaje:respuestas:texto"),
    {},
    { enabled: Boolean(draftOwner), isEmpty: recordVacio }
  )
  const {
    value: respuestasDraftHtml,
    setValue: setRespuestasDraftHtml,
  } = useSessionDraft<Record<number, string>>(
    draftKey("mensaje:respuestas:html"),
    {},
    { enabled: Boolean(draftOwner), isEmpty: recordVacio }
  )
  const [respondiendoMensajeId, setRespondiendoMensajeId] = useState<number | null>(null)
  const [mensajeEditandoId, setMensajeEditandoId] = useState<number | null>(null)
  const [mensajeEditandoAsunto, setMensajeEditandoAsunto] = useState("")
  const [mensajeEditandoContenido, setMensajeEditandoContenido] = useState("")
  const [mensajeEditandoContenidoHtml, setMensajeEditandoContenidoHtml] = useState("")
  const [guardandoMensajeGeneral, setGuardandoMensajeGeneral] = useState(false)
  const [mensajesAbiertos, setMensajesAbiertos] = useState<Record<number, boolean>>({})
  const [mensajesLeidos, setMensajesLeidos] = useState<Record<number, string>>({})
  const editorNuevoMensajeRef = useRef<EditorMensajeAdminHandle | null>(null)
  const editorEdicionMensajeRef = useRef<EditorMensajeAdminHandle | null>(null)
  const editorRespuestaRef = useRef<Record<number, EditorMensajeAdminHandle | null>>({})
  useEffect(() => {
    setMounted(true)
    let timeoutId: number | null = null

    const actualizarTiempo = () => {
      const ahora = obtenerAhoraArgentinaCliente()
      setAhoraArgentina(ahora)
      setNumeroDia(ahora.numeroDia)
    }

    const programarProximaActualizacion = () => {
      const ahora = new Date()
      const msHastaProximoMinuto =
        (60 - ahora.getSeconds()) * 1000 - ahora.getMilliseconds() + 250

      timeoutId = window.setTimeout(() => {
        actualizarTiempo()
        programarProximaActualizacion()
      }, Math.max(msHastaProximoMinuto, 1000))
    }

    const actualizarSiVuelveLaPestana = () => {
      if (document.visibilityState === "visible") {
        actualizarTiempo()
      }
    }

    actualizarTiempo()
    programarProximaActualizacion()
    window.addEventListener("focus", actualizarTiempo)
    document.addEventListener("visibilitychange", actualizarSiVuelveLaPestana)

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      window.removeEventListener("focus", actualizarTiempo)
      document.removeEventListener("visibilitychange", actualizarSiVuelveLaPestana)
    }
  }, [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_MENSAJES_LEIDOS_CASATALENTOS)
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
        STORAGE_MENSAJES_LEIDOS_CASATALENTOS,
        JSON.stringify(mensajesLeidos)
      )
    } catch {
      return
    }
  }, [mensajesLeidos])

  const cargarDatosCasaTalentos = async () => {
    try {
      const res = await fetch(
        MODO_PRUEBA ? "/api/casatalentos/listar?preview=1" : "/api/casatalentos/listar"
      )
      const data = await leerRespuestaJson<{
        videos?: VideoItem[]
        votos?: VotoItem[]
        comentarios?: ComentarioItem[]
        referentesGenerales?: ReferentesGenerales | null
        referentesSemanales?: ReferenteSemanal[]
        mensajesGenerales?: MensajeGeneral[]
        error?: string
      }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudieron cargar los videos.")
        return
      }

      setVideos(data.videos || [])
      setVotos(data.votos || [])
      setComentarios(data.comentarios || [])
      setReferentesGenerales(data.referentesGenerales || null)
      setReferentesSemanales(data.referentesSemanales || [])
      setMensajesGenerales(data.mensajesGenerales || [])
    } catch {
      setMensajeError("Error cargando datos de CasaTalentos.")
    }
  }

  useEffect(() => {
    if (mounted) {
      void cargarDatosCasaTalentos()
    }
  }, [mounted])

  useEffect(() => {
    if (!mounted) return

    const cargarProximoEncuentro = async () => {
      try {
        const res = await fetch("/api/agenda/por-actividad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actividadSlug: "casatalentos" }),
        })
        const data = await leerRespuestaJson<{ items?: ProximoEncuentro[] }>(res)
        setProximoEncuentro((data.items || [])[0] || null)
      } catch {
        setProximoEncuentro(null)
      }
    }

    void cargarProximoEncuentro()
  }, [mounted])

  const cargarProyecto = async () => {
    try {
      setCargandoProyecto(true)
      const res = await fetch("/api/entusiasmo/proyecto")
      const data = await leerRespuestaJson<{
        proyecto?: ProyectoEntusiasmo | null
        pitchSignedUrl?: string | null
        error?: string
      }>(res)

      if (!res.ok) {
        setMensajeCoordenadas(data.error || "No se pudo cargar tu proyecto.")
        return
      }

      const cargado = data.proyecto || null
      setProyecto(cargado)
      setPitchSignedUrl(data.pitchSignedUrl || null)
      setCoordenadas({
        que: cargado?.que || "",
        paraQue: cargado?.para_que || "",
        problemaSolucion: cargado?.problema_solucion || "",
        resultadoSemanal: cargado?.resultado_semanal || "",
        resultadoMensual: cargado?.resultado_mensual || "",
        resultadoTrimestral: cargado?.resultado_trimestral || "",
        resultadoAnual: cargado?.resultado_anual || "",
        habilidadADesarrollar: cargado?.habilidad_a_desarrollar || "",
        queTeEntusiasma: cargado?.que_te_entusiasma || "",
        pitchContenido: cargado?.pitch_contenido || "",
      })
    } catch {
      setMensajeCoordenadas("Error cargando tu proyecto.")
    } finally {
      setCargandoProyecto(false)
    }
  }

  useEffect(() => {
    if (mounted) {
      void cargarProyecto()
    }
  }, [mounted])

  const cargarAportesRecibidos = async () => {
    try {
      const res = await fetch("/api/entusiasmo/aportes")
      const data = await leerRespuestaJson<{ aportes?: AporteItem[] }>(res)
      setAportesRecibidos(data.aportes || [])
    } catch {
      setAportesRecibidos([])
    }
  }

  useEffect(() => {
    if (mounted) {
      void cargarAportesRecibidos()
    }
  }, [mounted])

  const cargarProducciones = async () => {
    try {
      const res = await fetch("/api/entusiasmo/producciones")
      const data = await leerRespuestaJson<{ producciones?: ProduccionItem[] }>(res)
      setProducciones(data.producciones || [])
    } catch {
      setProducciones([])
    }
  }

  useEffect(() => {
    if (mounted) {
      void cargarProducciones()
    }
  }, [mounted])

  const handleArchivoProduccion = (e: React.ChangeEvent<HTMLInputElement>) => {
    setArchivoProduccion(e.target.files?.[0] || null)
    setMensajeProduccion("")
  }

  const crearProduccion = async () => {
    setMensajeProduccion("")

    try {
      setGuardandoProduccion(true)

      if (tipoNuevaProduccion === "texto") {
        if (!textoProduccion.trim()) {
          setMensajeProduccion("Escribí algo antes de guardar.")
          return
        }

        const res = await fetch("/api/entusiasmo/producciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "texto",
            titulo: tituloProduccion,
            contenido: textoProduccion,
          }),
        })
        const data = await leerRespuestaJson<{ error?: string }>(res)

        if (!res.ok) {
          setMensajeProduccion(data.error || "No se pudo guardar.")
          return
        }
      } else {
        if (!archivoProduccion) {
          setMensajeProduccion("Elegí un archivo antes de guardar.")
          return
        }

        const prepararRes = await fetch("/api/entusiasmo/producciones/preparar-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: archivoProduccion.name,
            mimeType: archivoProduccion.type,
            fileSize: archivoProduccion.size,
          }),
        })
        const preparacion = await leerRespuestaJson<PrepararUploadProduccionResponse>(
          prepararRes
        )

        if (!prepararRes.ok || !preparacion.bucket || !preparacion.storagePath || !preparacion.signedToken) {
          setMensajeProduccion(preparacion.error || "No se pudo preparar la subida.")
          return
        }

        const { error: uploadError } = await supabase.storage
          .from(preparacion.bucket)
          .uploadToSignedUrl(preparacion.storagePath, preparacion.signedToken, archivoProduccion, {
            contentType: archivoProduccion.type,
            upsert: false,
          })

        if (uploadError) {
          setMensajeProduccion(uploadError.message || "No se pudo subir el archivo.")
          return
        }

        const confirmarRes = await fetch("/api/entusiasmo/producciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: tipoNuevaProduccion,
            titulo: tituloProduccion,
            storagePath: preparacion.storagePath,
            mimeType: archivoProduccion.type,
          }),
        })
        const data = await leerRespuestaJson<{ error?: string }>(confirmarRes)

        if (!confirmarRes.ok) {
          setMensajeProduccion(data.error || "No se pudo guardar.")
          return
        }
      }

      setTituloProduccion("")
      setTextoProduccion("")
      setArchivoProduccion(null)
      setMensajeProduccion("Guardado.")
      await cargarProducciones()
    } catch {
      setMensajeProduccion("Error guardando la producción.")
    } finally {
      setGuardandoProduccion(false)
    }
  }

  const alternarVisibilidadProduccion = async (id: number, visibleActual: boolean) => {
    try {
      await fetch("/api/entusiasmo/producciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, visible: !visibleActual }),
      })
      await cargarProducciones()
    } catch {
      setMensajeProduccion("No se pudo cambiar la visibilidad.")
    }
  }

  const eliminarProduccion = async (id: number) => {
    try {
      await fetch("/api/entusiasmo/producciones", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      await cargarProducciones()
    } catch {
      setMensajeProduccion("No se pudo eliminar.")
    }
  }

  const cargarTareas = async () => {
    try {
      const res = await fetch("/api/entusiasmo/tareas")
      const data = await leerRespuestaJson<{ tareas?: TareaItem[] }>(res)
      setTareas(data.tareas || [])
    } catch {
      setTareas([])
    }
  }

  useEffect(() => {
    if (mounted) {
      void cargarTareas()
    }
  }, [mounted])

  const agregarTarea = async () => {
    if (!nuevaTarea.trim()) {
      setMensajeTarea("Escribí la tarea antes de agregarla.")
      return
    }

    try {
      setGuardandoTarea(true)
      setMensajeTarea("")

      const res = await fetch("/api/entusiasmo/tareas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido: nuevaTarea }),
      })
      const data = await leerRespuestaJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeTarea(data.error || "No se pudo agregar la tarea.")
        return
      }

      setNuevaTarea("")
      await cargarTareas()
    } catch {
      setMensajeTarea("Error agregando la tarea.")
    } finally {
      setGuardandoTarea(false)
    }
  }

  const alternarTareaCompletada = async (id: number, completadaActual: boolean) => {
    try {
      await fetch("/api/entusiasmo/tareas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, completada: !completadaActual }),
      })
      await cargarTareas()
    } catch {
      setMensajeTarea("No se pudo actualizar la tarea.")
    }
  }

  const enviarAporte = async () => {
    const destinatario = aporteDestinatario.trim().toLowerCase()
    const contenido = aporteContenido.trim()

    if (!destinatario || !contenido) {
      setMensajeAporte("Completá el email y el contenido del aporte.")
      return
    }

    try {
      setEnviandoAporte(true)
      setMensajeAporte("")

      const res = await fetch("/api/entusiasmo/aportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participanteEmail: destinatario, contenido }),
      })
      const data = await leerRespuestaJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeAporte(data.error || "No se pudo enviar el aporte.")
        return
      }

      setMensajeAporte(`Aporte enviado a ${destinatario}.`)
      setAporteContenido("")
    } catch {
      setMensajeAporte("Error enviando el aporte.")
    } finally {
      setEnviandoAporte(false)
    }
  }

  const guardarCoordenadas = async () => {
    try {
      setGuardandoCoordenadas(true)
      setMensajeCoordenadas("")

      const res = await fetch("/api/entusiasmo/proyecto", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coordenadas),
      })

      const data = await leerRespuestaJson<{
        proyecto?: ProyectoEntusiasmo
        error?: string
      }>(res)

      if (!res.ok) {
        setMensajeCoordenadas(data.error || "No se pudo guardar tu proyecto.")
        return
      }

      setProyecto(data.proyecto || null)
      setMensajeCoordenadas("Guardado.")
    } catch {
      setMensajeCoordenadas("Error guardando tu proyecto.")
    } finally {
      setGuardandoCoordenadas(false)
    }
  }

  const handleArchivoPitch = (file: File | null) => {
    setArchivoPitch(file)
    setMensajePitch("")
  }

  const handleSubirPitch = async () => {
    setMensajePitch("")
    setEstadoSubidaPitch("")

    if (!archivoPitch) {
      setMensajePitch("Primero grabá o elegí un archivo para tu pitch.")
      return
    }

    try {
      setSubiendoPitch(true)
      setEstadoSubidaPitch("Preparando subida...")

      const prepararRes = await fetch("/api/entusiasmo/pitch/preparar-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: archivoPitch.name,
          mimeType: archivoPitch.type,
          fileSize: archivoPitch.size,
        }),
      })

      const preparacion = await leerRespuestaJson<PrepararUploadPitchResponse>(prepararRes)

      if (!prepararRes.ok) {
        setMensajePitch(preparacion.error || "No se pudo preparar la subida del pitch.")
        return
      }

      if (!preparacion.bucket || !preparacion.storagePath || !preparacion.signedToken) {
        setMensajePitch("La preparación de subida vino incompleta.")
        return
      }

      setEstadoSubidaPitch("Subiendo pitch...")

      const { error: uploadError } = await supabase.storage
        .from(preparacion.bucket)
        .uploadToSignedUrl(
          preparacion.storagePath,
          preparacion.signedToken,
          archivoPitch,
          { contentType: archivoPitch.type, upsert: false }
        )

      if (uploadError) {
        setMensajePitch(
          uploadError.message ||
            "No se pudo subir el pitch al storage. Probá nuevamente con buena conexión."
        )
        return
      }

      setEstadoSubidaPitch("Confirmando pitch...")

      const confirmarRes = await fetch("/api/entusiasmo/pitch/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath: preparacion.storagePath,
          mimeType: archivoPitch.type,
        }),
      })

      const data = await leerRespuestaJson<{
        proyecto?: ProyectoEntusiasmo
        pitchUrl?: string
        error?: string
      }>(confirmarRes)

      if (!confirmarRes.ok) {
        setMensajePitch(data.error || "No se pudo confirmar el pitch.")
        return
      }

      setProyecto(data.proyecto || null)
      setPitchSignedUrl(data.pitchUrl || null)
      setArchivoPitch(null)
      setMensajePitch("Pitch actualizado.")
    } catch {
      setMensajePitch("Error subiendo el pitch.")
    } finally {
      setSubiendoPitch(false)
      setEstadoSubidaPitch("")
    }
  }

  useEffect(() => {
    if (!mounted || !esAdmin) return

    let cancelado = false

    const cargarParticipantesActivos = async () => {
      try {
        const res = await fetch("/api/espacios/participantes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            actividadSlug: "casatalentos",
          }),
        })

        const data = await leerRespuestaJson<{
          participantes?: { email: string; nombre: string }[]
          error?: string
        }>(res)

        if (!res.ok || cancelado) {
          return
        }

        setParticipantesActivosCasaTalentos(data.participantes || [])
      } catch {
        if (!cancelado) {
          setParticipantesActivosCasaTalentos([])
        }
      }
    }

    void cargarParticipantesActivos()

    return () => {
      cancelado = true
    }
  }, [esAdmin, mounted])

  const nombreDiaActual = useMemo(() => {
    const dias = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ]
    return dias[numeroDia] || "Día"
  }, [numeroDia])

  const tieneRecurso = (slug: string) => {
    return recursos.some((r) => r.slug === slug)
  }

  const recursosCasaTalentos = useMemo(() => {
    return recursos.filter(esRecursoSolapaCasaTalentos)
  }, [recursos])

  const recursosAdminCasaTalentos = useMemo(() => {
    return recursosAdminGestion.filter((item) =>
      esRecursoSolapaCasaTalentos({
        id: item.id,
        slug: item.slug || "",
        nombre: item.titulo,
        descripcion: item.descripcion,
        tipo: item.recurso_tipo,
        proveedor: "externo",
        url: item.url,
      })
    )
  }, [recursosAdminGestion])

  const recursosSolapa = esAdmin ? recursosAdminCasaTalentos : recursosCasaTalentos

  const semanaActual = useMemo(() => {
    return normalizarFechaSemana(ahoraArgentina.fechaIso)
  }, [ahoraArgentina.fechaIso])

  const semanaEnUso = semanaActual

  const videosSemana = useMemo(() => {
    if (!semanaEnUso) return videos
    return videos.filter(
      (v) => normalizarFechaSemana(v.fecha_semana) === semanaEnUso
    )
  }, [semanaEnUso, videos])

  const idsVideosSemana = useMemo(() => {
    return new Set(videosSemana.map((v) => v.id))
  }, [videosSemana])

  const votosSemana = useMemo(() => {
    return votos.filter(
      (v) => normalizarFechaSemana(v.fecha_semana) === semanaEnUso && idsVideosSemana.has(v.video_id)
    )
  }, [votos, idsVideosSemana, semanaEnUso])

  const comentariosSemana = useMemo(() => {
    return comentarios.filter((c) => idsVideosSemana.has(c.video_id))
  }, [comentarios, idsVideosSemana])

  const comentariosPorVideo = useMemo(() => {
    const mapa = new Map<number, ComentarioItem[]>()

    for (const comentario of comentariosSemana) {
      const actuales = mapa.get(comentario.video_id) || []
      actuales.push(comentario)
      mapa.set(comentario.video_id, actuales)
    }

    return mapa
  }, [comentariosSemana])

  const votosPorVideo = useMemo(() => {
    const mapa = new Map<number, number>()
    for (const voto of votosSemana) {
      mapa.set(voto.video_id, (mapa.get(voto.video_id) || 0) + pesoEvaluacion(voto))
    }
    return mapa
  }, [votosSemana])

  const eleccionesPorParticipante = useMemo(() => {
    const participantePorVideo = new Map<number, { clave: string; nombre: string }>()
    const mapa = new Map<
      string,
      {
        id: number
        nombre: string
        email?: string | null
        rol?: string | null
        peso: number
      }[]
    >()

    for (const video of videosSemana) {
      participantePorVideo.set(video.id, {
        clave: claveParticipante(video),
        nombre: video.participante_nombre,
      })
    }

    for (const voto of votosSemana) {
      const participante = participantePorVideo.get(voto.video_id)
      if (!participante) continue

      const elecciones = mapa.get(participante.clave) || []
      elecciones.push({
        id: voto.id,
        nombre: voto.votante_nombre,
        email: voto.votante_email || null,
        rol: voto.votante_rol || null,
        peso: pesoEvaluacion(voto),
      })
      mapa.set(participante.clave, elecciones)
    }

    for (const elecciones of mapa.values()) {
      elecciones.sort((a, b) => {
        if (b.peso !== a.peso) return b.peso - a.peso
        return a.nombre.localeCompare(b.nombre)
      })
    }

    return mapa
  }, [videosSemana, votosSemana])

  const referenteSemanalActual = useMemo(() => {
    return (
      referentesSemanales.find(
        (r) => normalizarFechaSemana(r.fecha_semana) === semanaEnUso
      ) || null
    )
  }, [referentesSemanales, semanaEnUso])

  const rankingParticipantes = useMemo(() => {
    const mapa = new Map<
      string,
      {
        clave: string
        nombre: string
        email?: string | null
        dias: Set<string>
        totalVotos: number
        bonusAportes: number
        puntajeTotal: number
        aportesRecibidos: number
        participoEligiendo: boolean
        subioLunes: boolean
        subioMiercoles: boolean
        videos: VideoItem[]
      }
    >()

    for (const video of videosSemana) {
      const clave = claveParticipante(video)
      const actual =
        mapa.get(clave) ||
        {
          clave,
          nombre: video.participante_nombre,
          email: video.participante_email || null,
          dias: new Set<string>(),
          totalVotos: 0,
          bonusAportes: 0,
          puntajeTotal: 0,
          aportesRecibidos: 0,
          participoEligiendo: false,
          subioLunes: false,
          subioMiercoles: false,
          videos: [],
      }

      const diaNormalizado = normalizarClaveDia(video.dia_clave)
      if (diaNormalizado) {
        actual.dias.add(diaNormalizado)
        if (diaNormalizado === "lunes") actual.subioLunes = true
        if (diaNormalizado === "miercoles") actual.subioMiercoles = true
      }

      actual.totalVotos += votosPorVideo.get(video.id) || 0
      actual.videos.push(video)
      mapa.set(clave, actual)
    }

    const participantesQueEligieron = new Set(votosSemana.map((v) => claveVotante(v)))
    const maxAportesRecibidos = Array.from(mapa.values()).reduce((maximo, participante) => {
      const idsVideosParticipante = new Set(
        participante.videos.map((video) => video.id)
      )
      const aportesRecibidos = comentariosSemana.filter((comentario) =>
        idsVideosParticipante.has(comentario.video_id)
      ).length
      participante.aportesRecibidos = aportesRecibidos
      return Math.max(maximo, aportesRecibidos)
    }, 0)

    const lista = Array.from(mapa.values()).map((item) => {
      const participoEligiendo = participantesQueEligieron.has(item.clave)
      const elegible = item.subioLunes && item.subioMiercoles && participoEligiendo
      const bonusAportes =
        item.aportesRecibidos > 0 && item.aportesRecibidos === maxAportesRecibidos ? 1 : 0
      const puntajeTotal = item.totalVotos + bonusAportes

      return {
        ...item,
        bonusAportes,
        puntajeTotal,
        participoEligiendo,
        elegible,
      }
    })

    lista.sort((a, b) => {
      if (a.elegible !== b.elegible) return a.elegible ? -1 : 1
      if (b.puntajeTotal !== a.puntajeTotal) return b.puntajeTotal - a.puntajeTotal
      if (b.totalVotos !== a.totalVotos) return b.totalVotos - a.totalVotos
      if (b.aportesRecibidos !== a.aportesRecibidos) return b.aportesRecibidos - a.aportesRecibidos
      return a.nombre.localeCompare(b.nombre)
    })

    return lista
  }, [comentariosSemana, videosSemana, votosSemana, votosPorVideo])

  const top3 = useMemo(() => rankingParticipantes.slice(0, 3), [rankingParticipantes])

  const ganadorSemana = useMemo(() => {
    const elegibles = rankingParticipantes.filter((p) => p.elegible)
    if (elegibles.length === 0) return null

    const maxPuntaje = elegibles[0].puntajeTotal
    const empatados = elegibles.filter((p) => p.puntajeTotal === maxPuntaje)

    if (empatados.length > 1) {
      return { empate: true as const, puntaje: maxPuntaje, participantes: empatados }
    }

    return { empate: false as const, participante: empatados[0] }
  }, [rankingParticipantes])

  const opcionesEvaluacionProceso = useMemo(() => {
    return rankingParticipantes
      .map((participante) => {
        const videoRepresentativo = obtenerVideoRepresentativo(participante.videos)
        const idsVideosParticipante = new Set(
          participante.videos.map((video) => video.id)
        )
        const aportesRealizados = comentariosSemana.filter(
          (comentario) => claveVotante({
            votante_email: comentario.autor_email || null,
            votante_nombre: comentario.autor_nombre,
          }) === participante.clave
        ).length

        return {
          ...participante,
          videoRepresentativo,
          aportesRealizados,
        }
      })
      .filter((participante) => Boolean(participante.videoRepresentativo))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [comentariosSemana, rankingParticipantes])

  const resumenSemana = useMemo(() => {
    return {
      videos: videosSemana.length,
      participantes: rankingParticipantes.length,
      comentarios: comentariosSemana.length,
      top: top3.length,
    }
  }, [comentariosSemana.length, rankingParticipantes.length, top3.length, videosSemana.length])

  const resultadosVotacionVisibles = useMemo(() => {
    if (esAdmin) return true
    if (!semanaEnUso || semanaEnUso !== semanaActual) return true
    if (MODO_PRUEBA) return true

    return resultadosDisponiblesSegunAhora(ahoraArgentina)
  }, [
    ahoraArgentina.hour,
    ahoraArgentina.minute,
    ahoraArgentina.numeroDia,
    ahoraArgentina.weekday,
    esAdmin,
    semanaActual,
    semanaEnUso,
  ])

  const evaluacionCerrada = useMemo(() => {
    if (!semanaEnUso || semanaEnUso !== semanaActual) return true

    return resultadosDisponiblesSegunAhora(ahoraArgentina)
  }, [
    ahoraArgentina.hour,
    ahoraArgentina.minute,
    ahoraArgentina.numeroDia,
    ahoraArgentina.weekday,
    semanaActual,
    semanaEnUso,
  ])

  const diaActualClave = useMemo(() => {
    switch (numeroDia) {
      case 1:
        return "lunes"
      case 3:
        return "miercoles"
      default:
        return ""
    }
  }, [numeroDia])

  const esMartesAportes = numeroDia === 2
  const eleccionesHabilitadas = useMemo(() => {
    if (MODO_PRUEBA) return true
    if (semanaEnUso !== semanaActual) return false
    if (ahoraArgentina.weekday !== "Thu") return false

    const minutosActuales = ahoraArgentina.hour * 60 + ahoraArgentina.minute
    return minutosActuales <= 17 * 60
  }, [
    ahoraArgentina.hour,
    ahoraArgentina.minute,
    ahoraArgentina.weekday,
    semanaActual,
    semanaEnUso,
  ])
  const mostrarControlesEvaluacion = esAdmin || eleccionesHabilitadas

  const claveActorEvaluacion = useMemo(() => {
    return (email || nombre || "").trim().toLowerCase()
  }, [email, nombre])

  const yaParticipoEvaluacionSemana = useMemo(() => {
    if (!claveActorEvaluacion) return false

    return votosSemana.some((voto) => claveVotante(voto) === claveActorEvaluacion)
  }, [claveActorEvaluacion, votosSemana])

  const bloquearNuevaEvaluacion = yaParticipoEvaluacionSemana && !esAdmin
  const mostrarEncuestaEvaluacion =
    mostrarControlesEvaluacion && !bloquearNuevaEvaluacion

  const nombreGanadorEntusiasmo = useMemo(() => {
    if (!evaluacionCerrada || !ganadorSemana) return ""

    if (ganadorSemana.empate) {
      return ganadorSemana.participantes.map((participante) => participante.nombre).join(" y ")
    }

    return ganadorSemana.participante.nombre
  }, [evaluacionCerrada, ganadorSemana])

  const participantesSinVideoLunes = useMemo(() => {
    if (
      !esAdmin ||
      semanaEnUso !== semanaActual ||
      participantesActivosCasaTalentos.length === 0
    ) {
      return []
    }

    const participantesConLunes = new Set(
      videosSemana
        .filter((video) => normalizarClaveDia(video.dia_clave || video.dia) === "lunes")
        .map((video) => claveParticipante(video))
    )

    return participantesActivosCasaTalentos.filter((participante) => {
      return !participantesConLunes.has(String(participante.email || "").trim().toLowerCase())
    })
  }, [esAdmin, participantesActivosCasaTalentos, semanaActual, semanaEnUso, videosSemana])

  const mensajesRaiz = useMemo(() => {
    return mensajesGenerales.filter((mensaje) => !mensaje.parent_id)
  }, [mensajesGenerales])

  const respuestasPorMensaje = useMemo(() => {
    const mapa = new Map<number, MensajeGeneral[]>()

    for (const mensaje of mensajesGenerales) {
      if (!mensaje.parent_id) continue
      const actuales = mapa.get(mensaje.parent_id) || []
      actuales.push(mensaje)
      mapa.set(mensaje.parent_id, actuales)
    }

    return mapa
  }, [mensajesGenerales])

  const firmaMensajeGeneral = (mensaje?: MensajeGeneral | null) => {
    return mensaje?.updated_at || mensaje?.created_at || String(mensaje?.id || "")
  }

  const firmaHiloMensaje = (mensaje: MensajeGeneral) => {
    const respuestas = respuestasPorMensaje.get(mensaje.id) || []
    return [mensaje, ...respuestas]
      .map((item) => firmaMensajeGeneral(item))
      .filter(Boolean)
      .sort()
      .at(-1) || String(mensaje.id)
  }

  const hiloLeido = (mensaje: MensajeGeneral) => {
    return mensajesLeidos[mensaje.id] === firmaHiloMensaje(mensaje)
  }

  const cantidadMensajesNoLeidos = useMemo(() => {
    return mensajesRaiz.reduce((total, mensaje) => {
      return mensajesLeidos[mensaje.id] === firmaHiloMensaje(mensaje)
        ? total
        : total + 1
    }, 0)
  }, [mensajesLeidos, mensajesRaiz, respuestasPorMensaje])

  const marcarHiloComoLeido = (mensaje: MensajeGeneral) => {
    setMensajesLeidos((prev) => ({
      ...prev,
      [mensaje.id]: firmaHiloMensaje(mensaje),
    }))
  }

  const yaSubioVideoHoy = useMemo(() => {
    const claveActual = (email || nombre || "").trim().toLowerCase()
    if (!claveActual || !diaActualClave) {
      return false
    }

    return videosSemana.some((video) => {
      const claveVideo = claveParticipante(video)
      const diaVideo = normalizarClaveDia(video.dia_clave || video.dia)
      return claveVideo === claveActual && diaVideo === diaActualClave
    })
  }, [diaActualClave, email, nombre, videosSemana])

  const mostrarBloqueSubida =
    semanaEnUso === semanaActual &&
    Boolean(diaActualClave) &&
    !yaSubioVideoHoy

  const resumenAdmin = useMemo(() => {
    const anfitrion =
      top3.length > 0
        ? {
            participante_nombre: top3[0].nombre,
            titulo: top3[0].videos[0]?.titulo || "Sin título",
            votos: top3[0].puntajeTotal,
          }
        : null

    return {
      videos: videos.length,
      votos: votos.length,
      comentarios: comentarios.length,
      anfitrion,
    }
  }, [comentarios.length, top3, videos.length, votos.length])

  useEffect(() => {
    if (!esAdmin) {
      setRecursosAdminGestion([])
      return
    }

    let cancelado = false

    const cargarRecursosAdmin = async () => {
      try {
        const res = await fetch("/api/casatalentos/recursos")
        const data = await leerRespuestaJson<{
          ok?: boolean
          recursos?: RecursoGestion[]
          error?: string
        }>(res)

        if (!res.ok) {
          if (!cancelado) {
            setMensajeError(data.error || "No se pudieron cargar los recursos.")
          }
          return
        }

        if (!cancelado) {
          setRecursosAdminGestion(data.recursos || [])
        }
      } catch {
        if (!cancelado) {
          setMensajeError("No se pudieron cargar los recursos.")
        }
      }
    }

    void cargarRecursosAdmin()

    return () => {
      cancelado = true
    }
  }, [esAdmin])

  const guardarRecurso = async () => {
    try {
      setGuardandoRecurso(true)
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

      const res = await fetch("/api/casatalentos/recursos", {
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

      const data = await leerRespuestaJson<{ error?: string }>(res)

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
      recargarAcceso()
      const resRefetch = await fetch("/api/casatalentos/recursos")
      const dataRefetch = await leerRespuestaJson<{ recursos?: RecursoGestion[] }>(
        resRefetch
      )
      if (resRefetch.ok) {
        setRecursosAdminGestion(dataRefetch.recursos || [])
      }
    } catch {
      setMensajeError("Error guardando el recurso.")
    } finally {
      setGuardandoRecurso(false)
    }
  }

  const cambiarVisibleRecurso = async (recursoId: number, visible: boolean) => {
    try {
      setMensajeExito("")
      setMensajeError("")

      const res = await fetch("/api/casatalentos/recursos", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recursoId,
          visible,
        }),
      })

      const data = await leerRespuestaJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo actualizar el recurso.")
        return
      }

      setMensajeExito("Visibilidad del recurso actualizada.")
      recargarAcceso()
      setRecursosAdminGestion((prev) =>
        prev.map((item) =>
          item.id === recursoId ? { ...item, visible } : item
        )
      )
    } catch {
      setMensajeError("Error actualizando el recurso.")
    }
  }

  const iniciarEdicionRecurso = (item: RecursoGestion) => {
    setMensajeExito("")
    setMensajeError("")
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
      setMensajeExito("")
      setMensajeError("")

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

      const res = await fetch("/api/casatalentos/recursos", {
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

      const data = await leerRespuestaJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo actualizar el recurso.")
        return
      }

      setMensajeExito("Recurso actualizado correctamente.")
      recargarAcceso()
      setRecursosAdminGestion((prev) =>
        prev.map((item) =>
          item.id === recursoEditandoId
            ? {
                ...item,
                titulo: recursoEditTitulo,
                descripcion: descripcionFinal,
                recurso_tipo: recursoEditTipo,
                url: recursoEditUrl,
                visible: recursoEditVisible,
              }
            : item
        )
      )
      setRecursoEditandoId(null)
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
      setMensajeExito("")
      setMensajeError("")
      setEliminandoRecursoId(recursoId)

      const res = await fetch("/api/casatalentos/recursos", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recursoId }),
      })

      const data = await leerRespuestaJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo eliminar el recurso.")
        return
      }

      setMensajeExito("Recurso eliminado correctamente.")
      recargarAcceso()
      setRecursosAdminGestion((prev) => prev.filter((item) => item.id !== recursoId))
      if (recursoEditandoId === recursoId) {
        setRecursoEditandoId(null)
      }
    } catch {
      setMensajeError("Error eliminando el recurso.")
    } finally {
      setEliminandoRecursoId(null)
    }
  }

  const handleEnviarMensajeGeneral = async (parentId?: number) => {
    const contenidoHtml = esAdmin
      ? parentId
        ? (
            editorRespuestaRef.current[parentId || 0]?.getHtml() ||
            respuestasDraftHtml[parentId] ||
            ""
          ).trim()
        : (editorNuevoMensajeRef.current?.getHtml() || mensajeGeneralDraftHtml || "").trim()
      : ""
    const contenido = esAdmin
      ? htmlATextoPlano(contenidoHtml)
      : parentId
        ? (respuestasDraft[parentId] || "").trim()
        : mensajeGeneralDraft.trim()
    const asunto = parentId ? "" : asuntoMensajeGeneralDraft.trim()

    if (!contenido) {
      setMensajeError("Escribí un mensaje antes de enviarlo.")
      return
    }

    if (!parentId && !asunto) {
      setMensajeError("Escribí un asunto antes de enviarlo.")
      return
    }

    try {
      setMensajeError("")
      setMensajeExito("")
      setGuardandoMensajeGeneral(true)
      setRespondiendoMensajeId(parentId || null)

      const res = await fetch("/api/casatalentos/mensajes", {
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

      const data = await leerRespuestaJson<{
        error?: string
        mensaje?: {
          id: number
          created_at?: string | null
          updated_at?: string | null
        }
      }>(res)

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
        setAsuntoMensajeGeneralDraft("")
        setMensajeGeneralDraft("")
        setMensajeGeneralDraftHtml("")
        clearAsuntoMensajeGeneralDraft()
        clearMensajeGeneralDraft()
        clearMensajeGeneralDraftHtml()
      }

      setMensajeExito("Mensaje enviado correctamente.")
      const mensajeCreado = data.mensaje

      if (!parentId && mensajeCreado?.id) {
        setMensajesAbiertos((prev) => ({
          ...prev,
          [mensajeCreado.id]: true,
        }))
        setMensajesLeidos((prev) => ({
          ...prev,
          [mensajeCreado.id]:
            mensajeCreado.updated_at ||
            mensajeCreado.created_at ||
            new Date().toISOString(),
        }))
      }
      if (parentId) {
        setMensajesLeidos((prev) => ({
          ...prev,
          [parentId]: new Date().toISOString(),
        }))
      }
      await cargarDatosCasaTalentos()
    } catch {
      setMensajeError("Hubo un problema al enviar el mensaje.")
    } finally {
      setGuardandoMensajeGeneral(false)
      setRespondiendoMensajeId(null)
    }
  }

  const handleEditarMensajeGeneral = async (mensajeId: number) => {
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
      setMensajeError("")
      setMensajeExito("")
      setGuardandoMensajeGeneral(true)

      const res = await fetch("/api/casatalentos/mensajes", {
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

      const data = await leerRespuestaJson<{ error?: string }>(res)

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
      await cargarDatosCasaTalentos()
    } catch {
      setMensajeError("Hubo un problema al editar el mensaje.")
    } finally {
      setGuardandoMensajeGeneral(false)
    }
  }

  const handleEliminarMensajeGeneral = async (mensajeId: number) => {
    const confirmar = window.confirm(
      "El mensaje dejará de verse en la plataforma. No se borrarán archivos ni datos físicos. ¿Querés continuar?"
    )

    if (!confirmar) return

    try {
      setMensajeError("")
      setMensajeExito("")
      setGuardandoMensajeGeneral(true)

      const res = await fetch("/api/casatalentos/mensajes", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mensajeId,
          previewEnabled: MODO_PRUEBA,
        }),
      })

      const data = await leerRespuestaJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo eliminar el mensaje.")
        return
      }

      setMensajeEditandoId(null)
      setMensajeExito("Mensaje eliminado correctamente.")
      await cargarDatosCasaTalentos()
    } catch {
      setMensajeError("Hubo un problema al eliminar el mensaje.")
    } finally {
      setGuardandoMensajeGeneral(false)
    }
  }

  const textoReferentesGenerales =
    referentesGenerales?.contenido?.trim() ||
    `Para ser ganador/a de la semana:
+ Subir y participar con tus videos semanales de 1 min.: lunes y miércoles
+ El martes es día de aportes escritos para acompañar el proceso
+ Participar de la elección/evaluación del jueves hasta las 17:00 hs`

  if (!mounted || !sesionLista) {
    return (
      <main className="workspace-page space-y-6">
        <WorkspaceHero
          title="Entusiasmento"
          subtitle="Preparando tu acceso al espacio de entrenamiento."
        />

        <section className="workspace-panel">
          <p>Cargando sesión y recursos...</p>
          {sesionDemorada && (
            <p className="workspace-inline-note mt-3 text-amber-700">
              La sesión está tardando más de lo normal. En modo prueba vamos a
              intentar mostrar el contenido aunque la autenticación local del celular
              no responda.
            </p>
          )}
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          <p className="workspace-inline-note mt-3 text-xs">
            Estado sesión: {status} {session?.user?.email ? `| ${session.user.email}` : "| sin email"}
          </p>
        </section>
      </main>
    )
  }

  if (!session && !MODO_PRUEBA) {
    return (
      <main className="workspace-page space-y-6">
        <WorkspaceHero
          title="Entusiasmento"
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
        <WorkspaceHero title="Entusiasmento" subtitle="Espacio para Plasmar" />

        <div className="flex flex-wrap items-center justify-end gap-3">
          {proximoEncuentro && (
            <div className="inline-flex items-center gap-3 rounded-full border border-[var(--accent)] bg-white/90 px-4 py-2 shadow-sm">
              <span className="text-xs text-gray-600">
                {formatearFecha(proximoEncuentro.fecha)} · {proximoEncuentro.hora}
              </span>
              {proximoEncuentro.meetLink && proximoEncuentro.puedeIngresar ? (
                <ConsentimientoMeetButton
                  actividad="casatalentos"
                  href={proximoEncuentro.meetLink}
                  disponibilidadId={proximoEncuentro.disponibilidadId}
                  fechaEncuentro={proximoEncuentro.fecha}
                  horaEncuentro={proximoEncuentro.hora}
                  className="workspace-button-secondary !px-3 !py-1 text-xs"
                >
                  Reunión semanal
                </ConsentimientoMeetButton>
              ) : (
                <span className="text-xs font-semibold text-[var(--accent-strong)]">
                  Reunión semanal
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setValoracionesAbiertas((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--accent)] bg-[rgba(255,247,225,0.9)] px-4 py-2 shadow-[0_0_16px_rgba(207,145,48,0.45)] transition hover:shadow-[0_0_22px_rgba(207,145,48,0.6)]"
          >
            <span
              aria-hidden
              style={{ fontSize: `${Math.min(1 + mensajesGenerales.length * 0.04, 1.7)}rem` }}
            >
              ✉️
            </span>
            <span className="text-xs font-semibold text-[var(--accent-strong)]">
              Valoraciones{mensajesGenerales.length > 0 ? ` (${mensajesGenerales.length})` : ""}
            </span>
            {cantidadMensajesNoLeidos > 0 && (
              <span className="workspace-badge-unread">{cantidadMensajesNoLeidos}</span>
            )}
          </button>
        </div>

        {valoracionesAbiertas && (
          <div className="space-y-6 rounded-[1.75rem] border-2 border-[var(--accent)] bg-[rgba(255,247,225,0.5)] p-4 shadow-[0_0_24px_rgba(207,145,48,0.2)]">
              <div className="space-y-6">
                {(mensajeExito || mensajeError) && (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                      mensajeError
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-green-200 bg-green-50 text-green-700"
                    }`}
                  >
                    {mensajeError || mensajeExito}
                  </div>
                )}

                <div className="space-y-3 rounded-[1.75rem] border-2 border-[var(--accent)] bg-white/70 p-4">
                  <div className="space-y-1">
                    <p className="workspace-eyebrow text-[var(--accent-strong)]">✦ Dejar una marca</p>
                    <h3 className="text-lg font-bold tracking-tight text-[var(--accent-strong)]">
                      Nueva valoración o agradecimiento
                    </h3>
                  </div>
                  <input
                    className="workspace-field"
                    placeholder="Título (ej: Gracias por el acompañamiento)"
                    value={asuntoMensajeGeneralDraft}
                    onChange={(e) => setAsuntoMensajeGeneralDraft(e.target.value)}
                  />
                  {esAdmin ? (
                    <EditorMensajeAdmin
                      ref={editorNuevoMensajeRef}
                      value={mensajeGeneralDraftHtml}
                      onChange={setMensajeGeneralDraftHtml}
                    />
                  ) : (
                    <textarea
                      className="workspace-field min-h-[110px]"
                      placeholder="Escribí aquí una valoración, un agradecimiento, o algo que quieras compartir con el espacio..."
                      value={mensajeGeneralDraft}
                      onChange={(e) => setMensajeGeneralDraft(e.target.value)}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => void handleEnviarMensajeGeneral()}
                    disabled={guardandoMensajeGeneral}
                    className="workspace-button-primary disabled:opacity-60"
                  >
                    {guardandoMensajeGeneral && respondiendoMensajeId === null
                      ? "Enviando..."
                      : "Compartir"}
                  </button>
                </div>

                {mensajesRaiz.length === 0 && (
                  <p className="text-gray-600">
                    Todavía no hay valoraciones ni agradecimientos en Entusiasmento.
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
                        <div className="space-y-3">
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
                              onClick={() => void handleEditarMensajeGeneral(mensaje.id)}
                              disabled={guardandoMensajeGeneral}
                              className="workspace-button-primary disabled:opacity-60"
                            >
                              {guardandoMensajeGeneral ? "Guardando..." : "Guardar edición"}
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
                            onClick={() => void handleEliminarMensajeGeneral(mensaje.id)}
                            disabled={guardandoMensajeGeneral}
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
                            <div key={respuesta.id} className="workspace-message-reply space-y-1">
                                <p className="text-sm font-medium">{respuesta.autor_nombre}</p>
                                <p className="workspace-inline-note text-xs">
                                  {formatearFechaHora(respuesta.created_at)}
                                  {respuesta.updated_at &&
                                  respuesta.updated_at !== respuesta.created_at
                                  ? " · editado"
                                  : ""}
                              </p>
                              {mensajeEditandoId === respuesta.id ? (
                                <div className="space-y-3 pt-1">
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
                                      onChange={(e) => setMensajeEditandoContenido(e.target.value)}
                                    />
                                  )}
                                  <div className="flex gap-3">
                                    <button
                                      type="button"
                                      onClick={() => void handleEditarMensajeGeneral(respuesta.id)}
                                      disabled={guardandoMensajeGeneral}
                                      className="workspace-button-primary disabled:opacity-60"
                                    >
                                      {guardandoMensajeGeneral ? "Guardando..." : "Guardar edición"}
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
                                        onClick={() =>
                                          void handleEliminarMensajeGeneral(respuesta.id)
                                        }
                                        disabled={guardandoMensajeGeneral}
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
                              className="workspace-field min-h-[90px]"
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
                            onClick={() => void handleEnviarMensajeGeneral(mensaje.id)}
                            disabled={guardandoMensajeGeneral}
                            className="workspace-button-secondary disabled:opacity-60"
                          >
                            {guardandoMensajeGeneral && respondiendoMensajeId === mensaje.id
                              ? "Enviando..."
                              : "Responder"}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
          </div>
        )}

        {MODO_PRUEBA && (
          <section className="workspace-panel-soft space-y-2 bg-yellow-50/80">
            <p className="font-medium">Modo prueba activo</p>
            <p className="workspace-inline-note text-[var(--foreground)]">
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
                Para usar CasaTalentos necesitás tener tu acceso activo.
              </p>
              <p className="workspace-inline-note">
                Estado detectado: {motivo || "sin acceso"}
              </p>
            </section>

            <PagoMensualCard
              actividadSlug="casatalentos"
              participanteNombre={nombre}
              participanteEmail={email}
            />
          </>
        )}

        {!cargandoAcceso && (acceso || MODO_PRUEBA) && (
          <div className="space-y-4">

            {esAdmin ||
            ENTUSIASMENTO_ABIERTO_A_PARTICIPANTES ||
            ENTUSIASMENTO_BETA_EMAILS.includes(storageEmail) ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDestinoEntusiasmo("mi-espacio")}
                    className={`rounded-[1.5rem] border-2 px-4 py-4 text-left transition ${
                      destinoEntusiasmo === "mi-espacio"
                        ? "border-[var(--accent)] bg-[rgba(207,145,48,0.1)] shadow-[0_6px_0_0_rgba(207,145,48,0.25)]"
                        : "border-[var(--line)] bg-white/70"
                    }`}
                  >
                    <p className="text-2xl leading-none">🪴</p>
                    <p className="mt-2 text-base font-bold tracking-tight">Mi espacio</p>
                    <p className="text-xs text-gray-600">Tu proyecto, a tu ritmo</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDestinoEntusiasmo("cofruto")}
                    className={`rounded-[1.5rem] border-2 px-4 py-4 text-left transition ${
                      destinoEntusiasmo === "cofruto"
                        ? "border-emerald-500 bg-emerald-50 shadow-[0_6px_0_0_rgba(16,185,129,0.25)]"
                        : "border-[var(--line)] bg-white/70"
                    }`}
                  >
                    <p className="text-2xl leading-none">🧺</p>
                    <p className="mt-2 text-base font-bold tracking-tight">CoFruto</p>
                    <p className="text-xs text-gray-600">La mesa común</p>
                  </button>
                </div>

                {mensajeCoordenadas && (
                  <p className="rounded-xl border border-[var(--line)] bg-[rgba(255,250,242,0.7)] px-3 py-2 text-sm text-gray-700">
                    {mensajeCoordenadas}
                  </p>
                )}

                {destinoEntusiasmo === "mi-espacio" && (
                  <div className="space-y-6">
                    {cargandoProyecto && (
                      <p className="text-sm text-gray-600">Cargando tu proyecto...</p>
                    )}

                    <div className="space-y-3 rounded-[2rem] border-[3px] border-[var(--accent)] bg-gradient-to-br from-white to-[rgba(207,145,48,0.06)] p-5 shadow-[0_8px_0_0_rgba(207,145,48,0.18)]">
                      <div className="space-y-1">
                        <p className="workspace-eyebrow">✦ Siempre visible</p>
                        <h3 className="text-2xl font-bold tracking-tight">Tu pitch</h3>
                        <p className="workspace-inline-note">
                          Así te ven en la mesa
                        </p>
                      </div>

                      {pitchSignedUrl && (
                        <div className="mx-auto max-w-[220px]">
                          {proyecto?.pitch_mime_type?.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={pitchSignedUrl}
                              alt="Tu pitch"
                              className="w-full rounded-xl border border-[var(--line)]"
                            />
                          ) : (
                            <VideoEmbed src={pitchSignedUrl} title="Tu pitch" />
                          )}
                        </div>
                      )}

                      <GrabadorVideo
                        onVideoListo={handleArchivoPitch}
                        disabled={subiendoPitch}
                        maxSegundos={90}
                      />

                      {mensajePitch && (
                        <p className="text-sm text-gray-700">{mensajePitch}</p>
                      )}

                      {archivoPitch && (
                        <button
                          type="button"
                          disabled={subiendoPitch}
                          onClick={() => void handleSubirPitch()}
                          className="workspace-button"
                        >
                          {subiendoPitch
                            ? estadoSubidaPitch || "Subiendo..."
                            : proyecto?.pitch_storage_path
                              ? "Volver a grabarlo"
                              : "Guardar pitch"}
                        </button>
                      )}
                    </div>

                    {aportesRecibidos.length > 0 && (
                      <div className="space-y-2">
                        <p className="workspace-eyebrow">Te dejaron un aporte</p>
                        {aportesRecibidos.map((aporte, indice) => {
                          const colores = [
                            "border-amber-300 bg-amber-50",
                            "border-sky-300 bg-sky-50",
                            "border-rose-300 bg-rose-50",
                            "border-emerald-300 bg-emerald-50",
                          ]
                          const color = colores[indice % colores.length]

                          return (
                            <div
                              key={aporte.id}
                              className={`rounded-2xl rounded-tl-sm border-2 px-4 py-3 text-sm ${color}`}
                            >
                              <p className="text-gray-800">{aporte.contenido}</p>
                              <p className="mt-1 text-xs text-gray-500">
                                {aporte.autor_nombre || aporte.autor_email}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Reservado para Fase B: barras de actividad reales
                        una vez que Producciones exista y dé señal. */}
                    <div className="space-y-1 rounded-full border-2 border-dashed border-[var(--line-strong)] bg-white/50 px-6 py-4">
                      <p className="workspace-eyebrow">♪ Tu ritmo</p>
                      <p className="text-sm italic text-gray-500">
                        Acá vas a ver tu actividad de las últimas semanas
                        apenas empieces a cargar producciones.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
                      <button
                        type="button"
                        onClick={() => setCoordenadasAbiertas((v) => !v)}
                        className="flex w-full items-center justify-between gap-3 text-left"
                      >
                        <span className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-300 bg-white text-base">
                            🧭
                          </span>
                          <span>
                            <span className="block text-lg font-bold tracking-tight text-sky-900">
                              Coordenadas
                            </span>
                            <span className="text-sm text-sky-700">
                              {coordenadasSinDefinir} todavía sin definir
                            </span>
                          </span>
                        </span>
                        <span aria-hidden className="text-sky-500">
                          {coordenadasAbiertas ? "▲" : "▼"}
                        </span>
                      </button>

                      {coordenadasAbiertas && (
                        <div className="mt-4 space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-2">
                              <span className="text-sm font-medium text-gray-700">
                                Proyecto sobre el que querés trabajar (qué)
                              </span>
                              <textarea
                                className="workspace-field min-h-24"
                                value={coordenadas.que}
                                onChange={(e) =>
                                  setCoordenadas((prev) => ({ ...prev, que: e.target.value }))
                                }
                              />
                            </label>
                            <label className="space-y-2">
                              <span className="text-sm font-medium text-gray-700">
                                Objetivo concreto que querés alcanzar (para qué)
                              </span>
                              <textarea
                                className="workspace-field min-h-24"
                                value={coordenadas.paraQue}
                                onChange={(e) =>
                                  setCoordenadas((prev) => ({ ...prev, paraQue: e.target.value }))
                                }
                              />
                            </label>
                            <label className="space-y-2 md:col-span-2">
                              <span className="text-sm font-medium text-gray-700">
                                Problema y solución
                              </span>
                              <textarea
                                className="workspace-field min-h-24"
                                value={coordenadas.problemaSolucion}
                                onChange={(e) =>
                                  setCoordenadas((prev) => ({
                                    ...prev,
                                    problemaSolucion: e.target.value,
                                  }))
                                }
                              />
                            </label>
                            <label className="space-y-2">
                              <span className="text-sm font-medium text-gray-700">
                                Una habilidad que quieras desarrollar
                              </span>
                              <textarea
                                className="workspace-field min-h-24"
                                value={coordenadas.habilidadADesarrollar}
                                onChange={(e) =>
                                  setCoordenadas((prev) => ({
                                    ...prev,
                                    habilidadADesarrollar: e.target.value,
                                  }))
                                }
                              />
                            </label>
                            <label className="space-y-2">
                              <span className="text-sm font-medium text-gray-700">
                                Algo que te entusiasme mucho en la vida
                              </span>
                              <textarea
                                className="workspace-field min-h-24"
                                value={coordenadas.queTeEntusiasma}
                                onChange={(e) =>
                                  setCoordenadas((prev) => ({
                                    ...prev,
                                    queTeEntusiasma: e.target.value,
                                  }))
                                }
                              />
                            </label>
                          </div>

                          <div className="workspace-panel-soft space-y-3">
                            <h3 className="text-lg font-semibold">Resultados</h3>
                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="space-y-2">
                                <span className="text-sm font-medium text-gray-700">
                                  Semanal
                                </span>
                                <textarea
                                  className="workspace-field min-h-20"
                                  value={coordenadas.resultadoSemanal}
                                  onChange={(e) =>
                                    setCoordenadas((prev) => ({
                                      ...prev,
                                      resultadoSemanal: e.target.value,
                                    }))
                                  }
                                />
                              </label>
                              <label className="space-y-2">
                                <span className="text-sm font-medium text-gray-700">
                                  Mensual
                                </span>
                                <textarea
                                  className="workspace-field min-h-20"
                                  value={coordenadas.resultadoMensual}
                                  onChange={(e) =>
                                    setCoordenadas((prev) => ({
                                      ...prev,
                                      resultadoMensual: e.target.value,
                                    }))
                                  }
                                />
                              </label>
                              <label className="space-y-2">
                                <span className="text-sm font-medium text-gray-700">
                                  Trimestral
                                </span>
                                <textarea
                                  className="workspace-field min-h-20"
                                  value={coordenadas.resultadoTrimestral}
                                  onChange={(e) =>
                                    setCoordenadas((prev) => ({
                                      ...prev,
                                      resultadoTrimestral: e.target.value,
                                    }))
                                  }
                                />
                              </label>
                              <label className="space-y-2">
                                <span className="text-sm font-medium text-gray-700">
                                  Anual
                                </span>
                                <textarea
                                  className="workspace-field min-h-20"
                                  value={coordenadas.resultadoAnual}
                                  onChange={(e) =>
                                    setCoordenadas((prev) => ({
                                      ...prev,
                                      resultadoAnual: e.target.value,
                                    }))
                                  }
                                />
                              </label>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={guardandoCoordenadas}
                            onClick={() => void guardarCoordenadas()}
                            className="workspace-button"
                          >
                            {guardandoCoordenadas ? "Guardando..." : "Guardar coordenadas"}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 rounded-[1.75rem] border-2 border-violet-200 bg-violet-50/50 p-4">
                      <div className="space-y-1">
                        <p className="workspace-eyebrow text-violet-500">🎨 Producciones</p>
                        <h3 className="text-lg font-bold tracking-tight text-violet-900">
                          Lo que vas armando
                        </h3>
                        <p className="workspace-inline-note">
                          Imágenes, textos, canciones — vos elegís qué mostrar
                          en la mesa común.
                        </p>
                      </div>

                      {mensajeProduccion && (
                        <p className="text-sm text-gray-700">{mensajeProduccion}</p>
                      )}

                      <div className="space-y-3">
                        {producciones.map((item) => (
                          <div
                            key={item.id}
                            className="space-y-2 rounded-xl border border-violet-200 bg-white/80 p-3"
                          >
                            <div className="flex items-center gap-2">
                              <span aria-hidden>
                                {item.tipo === "imagen"
                                  ? "🖼️"
                                  : item.tipo === "audio"
                                    ? "🎵"
                                    : "📝"}
                              </span>
                              <span className="text-sm font-medium">
                                {item.titulo || (item.tipo === "texto" ? "" : item.tipo)}
                              </span>
                            </div>

                            {item.tipo === "imagen" && item.signedUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.signedUrl}
                                alt={item.titulo || "Producción"}
                                className="max-h-48 rounded-lg border border-violet-100 object-contain"
                              />
                            )}

                            {item.tipo === "audio" && item.signedUrl && (
                              <audio controls src={item.signedUrl} className="w-full">
                                Tu navegador no soporta audio.
                              </audio>
                            )}

                            {item.tipo === "texto" && item.contenido && (
                              <p className="whitespace-pre-wrap text-sm text-gray-700">
                                {item.contenido}
                              </p>
                            )}

                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => void alternarVisibilidadProduccion(item.id, item.visible)}
                                className={`flex items-center gap-1 text-xs font-semibold ${
                                  item.visible ? "text-[var(--accent-strong)]" : "text-gray-500"
                                }`}
                              >
                                {item.visible ? "👁️ En la mesa común" : "🔒 Solo lo ves vos"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void eliminarProduccion(item.id)}
                                className="text-xs text-red-500 underline"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        ))}
                        {producciones.length === 0 && (
                          <p className="text-sm text-gray-600">Todavía no subiste nada.</p>
                        )}
                      </div>

                      <div className="space-y-2 rounded-xl border border-dashed border-violet-300 bg-white/60 p-3">
                        <div className="flex flex-wrap gap-2">
                          {(["texto", "imagen", "audio"] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTipoNuevaProduccion(t)}
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                tipoNuevaProduccion === t
                                  ? "border-violet-500 bg-violet-100 text-violet-800"
                                  : "border-violet-200 bg-white text-violet-500"
                              }`}
                            >
                              {t === "texto" ? "📝 Texto" : t === "imagen" ? "🖼️ Imagen" : "🎵 Audio"}
                            </button>
                          ))}
                        </div>

                        <input
                          className="workspace-field"
                          placeholder="Título (opcional)"
                          value={tituloProduccion}
                          onChange={(e) => setTituloProduccion(e.target.value)}
                        />

                        {tipoNuevaProduccion === "texto" ? (
                          <textarea
                            className="workspace-field min-h-20"
                            placeholder="Escribí tu producción..."
                            value={textoProduccion}
                            onChange={(e) => setTextoProduccion(e.target.value)}
                          />
                        ) : tipoNuevaProduccion === "audio" ? (
                          <div className="space-y-2">
                            <GrabadorAudio
                              onAudioListo={setArchivoProduccion}
                              maxSegundos={300}
                            />
                            <p className="text-xs text-gray-500">o subí un archivo ya grabado:</p>
                            <input type="file" accept="audio/*" onChange={handleArchivoProduccion} />
                          </div>
                        ) : (
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleArchivoProduccion}
                          />
                        )}

                        <button
                          type="button"
                          disabled={guardandoProduccion}
                          onClick={() => void crearProduccion()}
                          className="workspace-button-secondary"
                        >
                          {guardandoProduccion ? "Guardando..." : "Agregar producción"}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-[1.75rem] border-2 border-amber-200 bg-amber-50/50 p-4">
                      <div className="space-y-1">
                        <p className="workspace-eyebrow text-amber-600">📋 Tareas semanales</p>
                        <h3 className="text-lg font-bold tracking-tight text-amber-900">
                          Lo que te proponés esta semana
                        </h3>
                      </div>

                      {mensajeTarea && (
                        <p className="text-sm text-gray-700">{mensajeTarea}</p>
                      )}

                      <div className="space-y-2">
                        {tareas.map((tarea) => (
                          <label
                            key={tarea.id}
                            className="flex items-center gap-3 rounded-xl border border-amber-200 bg-white/80 px-3 py-2"
                          >
                            <input
                              type="checkbox"
                              checked={tarea.completada}
                              onChange={() => void alternarTareaCompletada(tarea.id, tarea.completada)}
                            />
                            <span
                              className={`text-sm ${
                                tarea.completada ? "text-gray-400 line-through" : "text-gray-800"
                              }`}
                            >
                              {tarea.contenido}
                            </span>
                          </label>
                        ))}
                        {tareas.length === 0 && (
                          <p className="text-sm text-gray-600">
                            Todavía no cargaste tareas para esta semana.
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <input
                          className="workspace-field"
                          placeholder="Nueva tarea de la semana..."
                          value={nuevaTarea}
                          onChange={(e) => setNuevaTarea(e.target.value)}
                        />
                        <button
                          type="button"
                          disabled={guardandoTarea}
                          onClick={() => void agregarTarea()}
                          className="workspace-button-secondary shrink-0"
                        >
                          {guardandoTarea ? "..." : "Agregar"}
                        </button>
                      </div>
                    </div>

                    {esAdmin && (
                      <div className="space-y-3 rounded-2xl border-2 border-dashed border-[var(--accent-strong)] bg-[rgba(154,98,24,0.05)] p-4">
                        <div className="space-y-1">
                          <p className="workspace-eyebrow">Solo admin</p>
                          <h3 className="text-lg font-semibold">
                            Dejar un aporte
                          </h3>
                          <p className="workspace-inline-note">
                            Se muestra como una nota de color en el espacio de
                            esa persona.
                          </p>
                        </div>

                        {mensajeAporte && (
                          <p className="text-sm text-gray-700">{mensajeAporte}</p>
                        )}

                        <input
                          className="workspace-field"
                          placeholder="Email del participante"
                          value={aporteDestinatario}
                          onChange={(e) => setAporteDestinatario(e.target.value)}
                        />
                        <textarea
                          className="workspace-field min-h-20"
                          placeholder="Tu aporte..."
                          value={aporteContenido}
                          onChange={(e) => setAporteContenido(e.target.value)}
                        />
                        <button
                          type="button"
                          disabled={enviandoAporte}
                          onClick={() => void enviarAporte()}
                          className="workspace-button-secondary"
                        >
                          {enviandoAporte ? "Enviando..." : "Enviar aporte"}
                        </button>
                      </div>
                    )}

                    {esAdmin && (
                      <div className="space-y-3 rounded-2xl border-2 border-dashed border-[var(--accent-strong)] bg-[rgba(154,98,24,0.05)] p-4">
                        <div className="space-y-1">
                          <p className="workspace-eyebrow">Solo admin</p>
                          <h3 className="text-lg font-semibold">
                            Gestión de referentes
                          </h3>
                        </div>
                        <CasaTalentosAdminPanel
                          onActualizado={cargarDatosCasaTalentos}
                          storageOwnerKey={draftOwner}
                          uiStoragePrefix={uiStoragePrefix}
                        />
                      </div>
                    )}
                  </div>
                )}

                {destinoEntusiasmo === "cofruto" && (
                  <div className="space-y-6">
                    <div className="workspace-panel-soft space-y-2 py-6 text-center">
                      <p className="text-lg font-semibold">🧺 CoFruto</p>
                      <p className="text-sm text-gray-600">
                        Acá vas a poder visitar proyectos de otros participantes
                        muy pronto. Mientras tanto, acá abajo están los Recursos.
                      </p>
                    </div>
            {esAdmin && (esAdmin || recursosSolapa.length > 0) && (
              <SeccionDesplegable
                titulo="Recursos"
                storageKey={uiKey("seccion:recursos")}
              >
                <div className="space-y-4">
                  {esAdmin && (
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
                        <option value="grabacion">Grabación</option>
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
                        Visible para participante
                      </label>

                      <button
                        type="button"
                        onClick={() => void guardarRecurso()}
                        className="workspace-button-secondary"
                        disabled={
                          guardandoRecurso ||
                          !recursoTitulo.trim() ||
                          !tieneContenidoRecurso({
                            descripcion: recursoDescripcion,
                            url: recursoUrl,
                          })
                        }
                      >
                        {guardandoRecurso ? "Guardando..." : "Guardar recurso"}
                      </button>
                    </div>
                  )}

                  {recursosSolapa.length === 0 ? (
                    <p className="text-gray-600">
                      Todavía no hay recursos cargados para CasaTalentos.
                    </p>
                  ) : (
                    recursosSolapa.map((item) => {
                      if (esAdmin && "titulo" in item && recursoEditandoId === item.id) {
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
                          titulo={"titulo" in item ? item.titulo : item.nombre || "Recurso"}
                          descripcion={item.descripcion}
                          recursoTipo={
                            "recurso_tipo" in item ? item.recurso_tipo : item.tipo
                          }
                          url={item.url}
                          footer={
                            esAdmin ? (
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={"visible" in item ? item.visible : true}
                                    onChange={(e) =>
                                      void cambiarVisibleRecurso(item.id, e.target.checked)
                                    }
                                  />
                                  Visible para participante
                                </label>

                                <div className="flex gap-3 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      "titulo" in item && iniciarEdicionRecurso(item)
                                    }
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
                    })
                  )}
                </div>
              </SeccionDesplegable>
            )}

            {!esAdmin && recursosSolapa.length > 0 && (
              <SeccionDesplegable
                titulo="Recursos"
                storageKey={uiKey("seccion:recursos")}
              >
                <div className="space-y-4">
                  {recursosSolapa.map((item) =>
                    item.url ? (
                      <RecursoCard
                        key={item.id}
                        titulo={"titulo" in item ? item.titulo : item.nombre || "Recurso"}
                        descripcion={item.descripcion}
                        recursoTipo={
                          "recurso_tipo" in item ? item.recurso_tipo : item.tipo
                        }
                        url={item.url}
                      />
                    ) : (
                      <RecursoCard
                        key={item.id}
                        titulo={"titulo" in item ? item.titulo : item.nombre || "Recurso"}
                        descripcion={item.descripcion}
                        recursoTipo={
                          "recurso_tipo" in item ? item.recurso_tipo : item.tipo
                        }
                        url={item.url}
                      />
                    )
                  )}
                </div>
              </SeccionDesplegable>
            )}
                  </div>
                )}
              </div>
            ) : (
              <div className="workspace-panel-soft space-y-2 py-10 text-center">
                <p className="text-lg font-semibold">🌱 Entusiasmento se está terminando de armar</p>
                <p className="text-sm text-gray-600">
                  Muy pronto vas a poder entrar a tu espacio. Te avisamos apenas esté listo.
                </p>
              </div>
            )}




          </div>
        )}
      </main>
  )
}
