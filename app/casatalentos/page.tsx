"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import PagoMensualCard from "@/components/pagos/PagoMensualCard"
import SeccionDesplegable from "@/components/SeccionDesplegable"
import VideoEmbed from "@/components/VideoEmbed"
import GrabadorVideo from "@/components/casatalentos/GrabadorVideo"
import GrabadorAudio from "@/components/casatalentos/GrabadorAudio"
import ConsentimientoMeetButton from "@/components/consentimientos/ConsentimientoMeetButton"
import { useActivityAccess } from "@/components/auth/useActivityAccess"
import EditorMensajeAdmin from "@/components/espacios/EditorMensajeAdmin"
import type { EditorMensajeAdminHandle } from "@/components/espacios/EditorMensajeAdmin"
import { isDevelopmentPreviewEnabled } from "@/lib/dev-flags"
import { tieneAccesoEntusiasmento } from "@/lib/entusiasmo-acceso"
import { supabase } from "@/lib/supabase"
import WorkspaceHero from "@/components/ui/WorkspaceHero"
import Hora24Input from "@/components/ui/Hora24Input"
import HoraEnZonaLocal from "@/components/ui/HoraEnZonaLocal"
import { usePersistentState } from "@/hooks/usePersistentState"
import { useSessionDraft } from "@/hooks/useSessionDraft"
import RecursoCard from "@/components/recursos/RecursoCard"
import { tieneContenidoRecurso } from "@/lib/recursos"
import InstalarApp from "@/components/InstalarApp"
import MensajesAgente from "@/components/entusiasmo/MensajesAgente"
import Buscador from "@/components/entusiasmo/Buscador"

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

type ProyectoEntusiasmo = {
  id: number
  participante_email: string
  participante_nombre: string | null
  nombre: string | null
  que: string | null
  para_que: string | null
  problema_solucion: string | null
  resultado_semanal: string | null
  resultado_mensual: string | null
  resultado_trimestral: string | null
  resultado_anual: string | null
  habilidad_a_desarrollar: string | null
  que_te_entusiasma: string | null
  que_te_frena: string | null
  pitch_contenido: string | null
  pitch_storage_path: string | null
  pitch_mime_type: string | null
  pitch_actualizado_at: string | null
  agente_recordatorio_texto: string | null
  agente_recordatorio_generado_at: string | null
  suma_puntos_grupales: boolean
}

type CoordenadasForm = {
  nombre: string
  que: string
  paraQue: string
  problemaSolucion: string
  resultadoSemanal: string
  resultadoMensual: string
  resultadoTrimestral: string
  resultadoAnual: string
  habilidadADesarrollar: string
  queTeEntusiasma: string
  queTeFrena: string
  pitchContenido: string
}

const COORDENADAS_VACIAS: CoordenadasForm = {
  nombre: "",
  que: "",
  paraQue: "",
  problemaSolucion: "",
  resultadoSemanal: "",
  resultadoMensual: "",
  resultadoTrimestral: "",
  resultadoAnual: "",
  habilidadADesarrollar: "",
  queTeEntusiasma: "",
  queTeFrena: "",
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

type PuntosGrupales = {
  total: number
  umbrales: { umbral: number; alcanzado: boolean }[]
  proximoUmbral: number | null
  porcentajeHaciaProximo: number
  desglose: { email: string; nombre: string; puntos: number }[]
}

type AporteItem = {
  id: number
  autor_nombre: string | null
  autor_email: string | null
  contenido: string
  campo: string | null
  fragmento: string | null
  version_id: number | null
  tarea_version_id: number | null
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
  fecha: string | null
  hora: string | null
  prioridad: string | null
  serie_id: number | null
  diaSemana: number | null
  created_at: string
}

type ProduccionCofruto = {
  id: number
  tipo: string
  titulo: string | null
  contenido: string | null
  signedUrl: string | null
}

type PuestoCofruto = {
  email: string
  nombre: string
  esPropio: boolean
  pitchSignedUrl: string | null
  pitchMimeType: string | null
  producciones: ProduccionCofruto[]
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
const STORAGE_MENSAJES_LEIDOS_CASATALENTOS = "casatalentos_mensajes_leidos"
const STORAGE_RECORDATORIO_AGENTE_VISTO = "entusiasmo_recordatorio_agente_visto"
const CAMPOS_COORDENADAS: Array<keyof CoordenadasForm> = [
  "nombre",
  "que",
  "paraQue",
  "problemaSolucion",
  "resultadoMensual",
  "resultadoTrimestral",
  "resultadoAnual",
  "habilidadADesarrollar",
  "queTeEntusiasma",
  "queTeFrena",
]
// Las versiones anteriores se guardan con el nombre de columna de la base
// (snake_case), pero el formulario usa camelCase — este mapa traduce entre
// los dos.
const COLUMNA_POR_CAMPO_COORDENADAS: Record<keyof CoordenadasForm, string> = {
  nombre: "nombre",
  que: "que",
  paraQue: "para_que",
  problemaSolucion: "problema_solucion",
  resultadoSemanal: "resultado_semanal",
  resultadoMensual: "resultado_mensual",
  resultadoTrimestral: "resultado_trimestral",
  resultadoAnual: "resultado_anual",
  habilidadADesarrollar: "habilidad_a_desarrollar",
  queTeEntusiasma: "que_te_entusiasma",
  queTeFrena: "que_te_frena",
  pitchContenido: "pitch_contenido",
}
const CAMPOS_COORDENADAS_PRINCIPALES: Array<{
  campo: keyof CoordenadasForm
  etiqueta: string
  colSpan?: boolean
}> = [
  { campo: "nombre", etiqueta: "Nombre del proyecto" },
  { campo: "que", etiqueta: "¿Qué es? Definición." },
  {
    campo: "paraQue",
    etiqueta: "¿Para qué sirve? ¿Qué misión cumple en el mundo?",
  },
  {
    campo: "problemaSolucion",
    etiqueta: "Problema que resuelve (agujero). Solución que brinda (corcho).",
    colSpan: true,
  },
  {
    campo: "habilidadADesarrollar",
    etiqueta: "Talento/s que reconocés en vos y cuáles querés desarrollar",
  },
  { campo: "queTeEntusiasma", etiqueta: "¿Qué te entusiasma en la vida? ¡Chispa!" },
  { campo: "queTeFrena", etiqueta: "¿Qué te frena?" },
]
const CAMPOS_COORDENADAS_RESULTADOS: Array<{
  campo: keyof CoordenadasForm
  etiqueta: string
}> = [
  { campo: "resultadoAnual", etiqueta: "Anual" },
  { campo: "resultadoTrimestral", etiqueta: "Trimestral" },
  { campo: "resultadoMensual", etiqueta: "Mensual" },
]

const DIAS_SEMANA_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

const formatearFechaHoraTarea = (fecha: string | null, hora: string | null) => {
  if (!fecha) return hora ? hora.slice(0, 5) : ""

  const [anio, mes, dia] = fecha.split("-").map(Number)
  const fechaUTC = new Date(Date.UTC(anio, mes - 1, dia))
  const diaSemana = DIAS_SEMANA_CORTO[fechaUTC.getUTCDay()]
  const fechaTexto = `${diaSemana} ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`

  return hora ? `${fechaTexto} · ${hora.slice(0, 5)}` : fechaTexto
}

const RECURSOS_PRUEBA_CASATALENTOS: Recurso[] = [
  {
    id: 999001,
    slug: "biblioteca_grabaciones_casatalentos",
    nombre: "Biblioteca de grabaciones Entusiasmento",
    descripcion: "Modo prueba",
    tipo: "biblioteca",
    proveedor: "google_drive",
  },
  {
    id: 999002,
    slug: "dispositivo_videos_casatalentos",
    nombre: "Dispositivo semanal de videos Entusiasmento",
    descripcion: "Modo prueba",
    tipo: "dinamica",
    proveedor: "interno",
  },
  {
    id: 999003,
    slug: "reunion_semanal_casatalentos",
    nombre: "Reunión semanal Entusiasmento",
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
    hourCycle: "h23",
  })
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

  const [mensajesGenerales, setMensajesGenerales] = useState<MensajeGeneral[]>([])
  const [participantesActivosCasaTalentos, setParticipantesActivosCasaTalentos] = useState<
    { email: string; nombre: string }[]
  >([])

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
  const [proyecto, setProyecto] = useState<ProyectoEntusiasmo | null>(null)
  const [pitchSignedUrl, setPitchSignedUrl] = useState<string | null>(null)
  const [cargandoProyecto, setCargandoProyecto] = useState(false)
  const [coordenadas, setCoordenadas] = useState<CoordenadasForm>(COORDENADAS_VACIAS)
  const [coordenadasAbiertas, setCoordenadasAbiertas] = useState(false)
  const [guardandoCoordenadas, setGuardandoCoordenadas] = useState(false)
  const [mensajeCoordenadas, setMensajeCoordenadas] = useState("")
  const [versionesCoordenadas, setVersionesCoordenadas] = useState<
    Record<string, Array<{ id: number; contenido: string; created_at: string }>>
  >({})
  const [versionesCargadas, setVersionesCargadas] = useState(false)
  const [versionesCampoAbierto, setVersionesCampoAbierto] = useState<Record<string, boolean>>({})
  const [historialTareasAbierto, setHistorialTareasAbierto] = useState(false)
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
  const [puntosGrupales, setPuntosGrupales] = useState<PuntosGrupales | null>(null)
  const [desglosePuntosAbierto, setDesglosePuntosAbierto] = useState(false)
  const [guardandoSumaPuntos, setGuardandoSumaPuntos] = useState(false)
  const [mensajeSumaPuntos, setMensajeSumaPuntos] = useState("")
  const [aportesRecibidos, setAportesRecibidos] = useState<AporteItem[]>([])
  const [hayAportesNuevos, setHayAportesNuevos] = useState(false)
  const [novedadesPorParticipante, setNovedadesPorParticipante] = useState<
    Record<string, boolean>
  >({})
  const [camposNuevosViendo, setCamposNuevosViendo] = useState<Set<string>>(new Set())
  const [produccionesNuevasViendo, setProduccionesNuevasViendo] = useState<Set<number>>(
    new Set()
  )
  const [tareasNuevasViendo, setTareasNuevasViendo] = useState<Set<number>>(new Set())
  const [mensajeAporte, setMensajeAporte] = useState("")
  const [valoracionesAbiertas, setValoracionesAbiertas] = useState(false)
  const [viendoEmail, setViendoEmail] = useState<string | null>(null)
  const [campoConSeleccion, setCampoConSeleccion] = useState<string | null>(null)
  const [textoSeleccionado, setTextoSeleccionado] = useState("")
  const [comentandoCampo, setComentandoCampo] = useState<string | null>(null)
  const [contenidoNotaAncla, setContenidoNotaAncla] = useState("")
  const [guardandoNotaAncla, setGuardandoNotaAncla] = useState(false)
  const [aporteAbiertoId, setAporteAbiertoId] = useState<number | null>(null)
  const [producciones, setProducciones] = useState<ProduccionItem[]>([])
  const [tituloProduccion, setTituloProduccion] = useState("")
  const [textoProduccion, setTextoProduccion] = useState("")
  const [archivoProduccion, setArchivoProduccion] = useState<File | null>(null)
  const produccionFileInputRef = useRef<HTMLInputElement | null>(null)
  const [tipoNuevaProduccion, setTipoNuevaProduccion] = useState<
    "texto" | "imagen" | "audio" | "video" | "link"
  >("texto")
  const [guardandoProduccion, setGuardandoProduccion] = useState(false)
  const [mensajeProduccion, setMensajeProduccion] = useState("")
  const [tareas, setTareas] = useState<TareaItem[]>([])
  const [nuevaTarea, setNuevaTarea] = useState("")
  const [nuevaTareaFecha, setNuevaTareaFecha] = useState("")
  const [nuevaTareaHora, setNuevaTareaHora] = useState("")
  const [nuevaTareaRepite, setNuevaTareaRepite] = useState(false)
  const [nuevaTareaDiaSemana, setNuevaTareaDiaSemana] = useState(1)
  const [cancelandoTareaId, setCancelandoTareaId] = useState<number | null>(null)
  const [guardandoTarea, setGuardandoTarea] = useState(false)
  const [mensajeTarea, setMensajeTarea] = useState("")
  const [editandoTareaId, setEditandoTareaId] = useState<number | null>(null)
  const [edicionTareaFecha, setEdicionTareaFecha] = useState("")
  const [edicionTareaHora, setEdicionTareaHora] = useState("")
  const [guardandoEdicionTarea, setGuardandoEdicionTarea] = useState(false)
  const [editandoContenidoTareaId, setEditandoContenidoTareaId] = useState<number | null>(null)
  const [edicionTareaContenido, setEdicionTareaContenido] = useState("")
  const [guardandoEdicionContenidoTarea, setGuardandoEdicionContenidoTarea] = useState(false)
  const [versionesTareas, setVersionesTareas] = useState<
    Record<number, Array<{ id: number; contenido: string; created_at: string }>>
  >({})
  const [versionesTareasCargadas, setVersionesTareasCargadas] = useState(false)
  const [versionesTareaAbierta, setVersionesTareaAbierta] = useState<Record<number, boolean>>({})
  const [puestosCofruto, setPuestosCofruto] = useState<PuestoCofruto[]>([])
  const [cargandoCofruto, setCargandoCofruto] = useState(false)
  const [puestoAmpliadoEmail, setPuestoAmpliadoEmail] = useState<string | null>(null)
  const [imagenAmpliada, setImagenAmpliada] = useState<{ url: string; titulo: string } | null>(null)

  const tareasCompletadas = tareas.filter((t) => t.completada).length
  const porcentajeRitmo =
    tareas.length > 0 ? Math.round((tareasCompletadas / tareas.length) * 100) : 0
  const tareasPendientesLista = tareas.filter((t) => !t.completada)
  // Las completadas nunca se acumulan en la lista principal — quedan todas
  // juntas en una pestaña desplegable aparte.
  const tareasCompletadasOrdenadas = tareas
    .filter((t) => t.completada)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const [mensajeExito, setMensajeExito] = useState("")
  const [mensajeError, setMensajeError] = useState("")
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
  const [recordatorioAgenteVisto, setRecordatorioAgenteVisto] = useState<Record<string, string>>({})
  const editorNuevoMensajeRef = useRef<EditorMensajeAdminHandle | null>(null)
  const editorEdicionMensajeRef = useRef<EditorMensajeAdminHandle | null>(null)
  const editorRespuestaRef = useRef<Record<number, EditorMensajeAdminHandle | null>>({})
  useEffect(() => {
    setMounted(true)
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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_RECORDATORIO_AGENTE_VISTO)
      if (!raw) return
      setRecordatorioAgenteVisto(JSON.parse(raw) as Record<string, string>)
    } catch {
      return
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_RECORDATORIO_AGENTE_VISTO,
        JSON.stringify(recordatorioAgenteVisto)
      )
    } catch {
      return
    }
  }, [recordatorioAgenteVisto])

  const cargarDatosCasaTalentos = async () => {
    try {
      const res = await fetch(
        MODO_PRUEBA ? "/api/casatalentos/listar?preview=1" : "/api/casatalentos/listar"
      )
      const data = await leerRespuestaJson<{
        mensajesGenerales?: MensajeGeneral[]
        error?: string
      }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudieron cargar los videos.")
        return
      }

      setMensajesGenerales(data.mensajesGenerales || [])
    } catch {
      setMensajeError("Error cargando datos de Entusiasmento.")
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
      const query = viendoEmail ? `?email=${encodeURIComponent(viendoEmail)}` : ""
      const res = await fetch(`/api/entusiasmo/proyecto${query}`)
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
        nombre: cargado?.nombre || "",
        que: cargado?.que || "",
        paraQue: cargado?.para_que || "",
        problemaSolucion: cargado?.problema_solucion || "",
        resultadoSemanal: cargado?.resultado_semanal || "",
        resultadoMensual: cargado?.resultado_mensual || "",
        resultadoTrimestral: cargado?.resultado_trimestral || "",
        resultadoAnual: cargado?.resultado_anual || "",
        habilidadADesarrollar: cargado?.habilidad_a_desarrollar || "",
        queTeEntusiasma: cargado?.que_te_entusiasma || "",
        queTeFrena: cargado?.que_te_frena || "",
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
  }, [mounted, viendoEmail])

  // Admin-only: marca/desmarca si la persona que se está viendo (solapa)
  // suma sus acciones hacia la meta grupal de "reunión extra" — pensado
  // para quienes vienen de Mentorías, que usan las herramientas de
  // Entusiasmento pero no participan de esas reuniones.
  const cambiarSumaPuntosGrupales = async (valor: boolean) => {
    if (!viendoEmail) return

    try {
      setGuardandoSumaPuntos(true)
      setMensajeSumaPuntos("")

      const res = await fetch("/api/entusiasmo/proyecto", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participanteEmail: viendoEmail,
          sumaPuntosGrupales: valor,
        }),
      })

      const data = await leerRespuestaJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeSumaPuntos(data.error || "No se pudo guardar.")
        return
      }

      await cargarProyecto()
    } catch {
      setMensajeSumaPuntos("Error guardando la configuración.")
    } finally {
      setGuardandoSumaPuntos(false)
    }
  }

  useEffect(() => {
    if (!mounted) return

    let cancelado = false

    const cargarPuntosGrupales = async () => {
      try {
        const res = await fetch("/api/entusiasmo/puntos")
        const data = await leerRespuestaJson<PuntosGrupales & { ok?: boolean }>(res)
        if (!res.ok || cancelado) return
        setPuntosGrupales(data)
      } catch {
        if (!cancelado) setPuntosGrupales(null)
      }
    }

    void cargarPuntosGrupales()

    return () => {
      cancelado = true
    }
  }, [mounted])

  const cargarAportesRecibidos = async () => {
    try {
      const query = viendoEmail ? `?email=${encodeURIComponent(viendoEmail)}` : ""
      const res = await fetch(`/api/entusiasmo/aportes${query}`)
      const data = await leerRespuestaJson<{
        aportes?: AporteItem[]
        hayAportesNuevos?: boolean
      }>(res)
      setAportesRecibidos(data.aportes || [])
      setHayAportesNuevos(Boolean(data.hayAportesNuevos))
    } catch {
      setAportesRecibidos([])
    }
  }

  useEffect(() => {
    if (mounted) {
      void cargarAportesRecibidos()
    }
  }, [mounted, viendoEmail])

  // Marcar como leídos los aportes propios al ver "Mi espacio" — con un
  // pequeño retraso, así el punto de "nuevo" alcanza a mostrarse un
  // momento en vez de aparecer y apagarse en el mismo render (Mi espacio
  // es la pestaña por defecto, así que sin este margen nunca se llegaría
  // a ver).
  useEffect(() => {
    if (!mounted || viendoEmail || destinoEntusiasmo !== "mi-espacio" || !hayAportesNuevos) {
      return
    }

    const timeoutId = setTimeout(() => {
      setHayAportesNuevos(false)
      void (async () => {
        await fetch("/api/entusiasmo/lecturas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
        window.dispatchEvent(new Event("entusiasmo-lectura-actualizada"))
      })()
    }, 3000)

    return () => clearTimeout(timeoutId)
  }, [mounted, viendoEmail, destinoEntusiasmo, hayAportesNuevos])

  const cargarVersionesCoordenadas = async () => {
    try {
      const query = viendoEmail ? `?email=${encodeURIComponent(viendoEmail)}` : ""
      const res = await fetch(`/api/entusiasmo/coordenadas-versiones${query}`)
      const data = await leerRespuestaJson<{
        versiones?: Array<{ id: number; campo: string; contenido: string; created_at: string }>
      }>(res)

      const agrupadas: Record<
        string,
        Array<{ id: number; contenido: string; created_at: string }>
      > = {}

      for (const version of data.versiones || []) {
        if (!agrupadas[version.campo]) agrupadas[version.campo] = []
        agrupadas[version.campo].push({
          id: version.id,
          contenido: version.contenido,
          created_at: version.created_at,
        })
      }

      setVersionesCoordenadas(agrupadas)
    } catch {
      setVersionesCoordenadas({})
    } finally {
      setVersionesCargadas(true)
    }
  }

  useEffect(() => {
    if (mounted && coordenadasAbiertas) {
      setVersionesCargadas(false)
      void cargarVersionesCoordenadas()
    }
  }, [mounted, coordenadasAbiertas, viendoEmail])

  const cargarProducciones = async () => {
    try {
      const query = viendoEmail ? `?email=${encodeURIComponent(viendoEmail)}` : ""
      const res = await fetch(`/api/entusiasmo/producciones${query}`)
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
  }, [mounted, viendoEmail])

  const handleArchivoProduccion = (e: React.ChangeEvent<HTMLInputElement>) => {
    setArchivoProduccion(e.target.files?.[0] || null)
    setMensajeProduccion("")
  }

  const crearProduccion = async () => {
    setMensajeProduccion("")

    try {
      setGuardandoProduccion(true)

      if (tipoNuevaProduccion === "texto" || tipoNuevaProduccion === "link") {
        const valor = textoProduccion.trim()

        if (!valor) {
          setMensajeProduccion(
            tipoNuevaProduccion === "link"
              ? "Pegá un link antes de guardar."
              : "Escribí algo antes de guardar."
          )
          return
        }

        const contenidoFinal =
          tipoNuevaProduccion === "link" && !/^https?:\/\//i.test(valor)
            ? `https://${valor}`
            : valor

        const res = await fetch("/api/entusiasmo/producciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: tipoNuevaProduccion,
            titulo: tituloProduccion,
            contenido: contenidoFinal,
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
      const query = viendoEmail ? `?email=${encodeURIComponent(viendoEmail)}` : ""
      const res = await fetch(`/api/entusiasmo/tareas${query}`)
      const data = await leerRespuestaJson<{ tareas?: TareaItem[] }>(res)
      setTareas(data.tareas || [])
    } catch {
      setTareas([])
    }
  }

  const cargarVersionesTareas = async () => {
    try {
      const query = viendoEmail ? `?email=${encodeURIComponent(viendoEmail)}` : ""
      const res = await fetch(`/api/entusiasmo/tareas-versiones${query}`)
      const data = await leerRespuestaJson<{
        versiones?: Array<{ id: number; tarea_id: number; contenido: string; created_at: string }>
      }>(res)

      const agrupadas: Record<
        number,
        Array<{ id: number; contenido: string; created_at: string }>
      > = {}

      for (const version of data.versiones || []) {
        if (!agrupadas[version.tarea_id]) agrupadas[version.tarea_id] = []
        agrupadas[version.tarea_id].push({
          id: version.id,
          contenido: version.contenido,
          created_at: version.created_at,
        })
      }

      setVersionesTareas(agrupadas)
    } catch {
      setVersionesTareas({})
    } finally {
      setVersionesTareasCargadas(true)
    }
  }

  useEffect(() => {
    if (mounted) {
      void cargarTareas()
      void cargarVersionesTareas()
    }
  }, [mounted, viendoEmail])

  const cargarCofruto = async () => {
    try {
      setCargandoCofruto(true)
      const res = await fetch("/api/entusiasmo/cofruto")
      const data = await leerRespuestaJson<{ puestos?: PuestoCofruto[] }>(res)
      setPuestosCofruto(data.puestos || [])
    } catch {
      setPuestosCofruto([])
    } finally {
      setCargandoCofruto(false)
    }
  }

  useEffect(() => {
    if (mounted && destinoEntusiasmo === "cofruto") {
      void cargarCofruto()
    }
  }, [mounted, destinoEntusiasmo])

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
        body: JSON.stringify(
          nuevaTareaRepite
            ? {
                contenido: nuevaTarea,
                hora: nuevaTareaHora,
                repetir: true,
                diaSemana: nuevaTareaDiaSemana,
              }
            : {
                contenido: nuevaTarea,
                fecha: nuevaTareaFecha,
                hora: nuevaTareaHora,
              }
        ),
      })
      const data = await leerRespuestaJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeTarea(data.error || "No se pudo agregar la tarea.")
        return
      }

      setNuevaTarea("")
      setNuevaTareaFecha("")
      setNuevaTareaHora("")
      setNuevaTareaRepite(false)
      await cargarTareas()
    } catch {
      setMensajeTarea("Error agregando la tarea.")
    } finally {
      setGuardandoTarea(false)
    }
  }

  const cancelarTarea = async (id: number, alcance: "esta" | "esta_y_proximas") => {
    try {
      await fetch("/api/entusiasmo/tareas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, alcance }),
      })
      setCancelandoTareaId(null)
      await cargarTareas()
    } catch {
      setMensajeTarea("Error cancelando la tarea.")
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

  const cambiarPrioridadTarea = async (id: number, prioridadActual: string | null, prioridad: string) => {
    const nuevaPrioridad = prioridadActual === prioridad ? null : prioridad

    // Optimista: se ve el cambio al toque, sin esperar la vuelta del servidor.
    setTareas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, prioridad: nuevaPrioridad } : t))
    )

    try {
      const res = await fetch("/api/entusiasmo/tareas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, prioridad: nuevaPrioridad }),
      })

      if (!res.ok) {
        throw new Error("No se pudo actualizar la prioridad.")
      }
    } catch {
      // Revierte el cambio optimista si falló de verdad.
      setTareas((prev) =>
        prev.map((t) => (t.id === id ? { ...t, prioridad: prioridadActual } : t))
      )
      setMensajeTarea("No se pudo actualizar la prioridad.")
    }
  }

  const abrirEdicionFechaHoraTarea = (tarea: TareaItem) => {
    setEditandoTareaId(tarea.id)
    setEdicionTareaFecha(tarea.fecha || "")
    setEdicionTareaHora(tarea.hora || "")
    setMensajeTarea("")
  }

  const cancelarEdicionFechaHoraTarea = () => {
    setEditandoTareaId(null)
    setEdicionTareaFecha("")
    setEdicionTareaHora("")
  }

  const guardarEdicionFechaHoraTarea = async (id: number) => {
    try {
      setGuardandoEdicionTarea(true)
      setMensajeTarea("")

      const res = await fetch("/api/entusiasmo/tareas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          fecha: edicionTareaFecha,
          hora: edicionTareaHora,
        }),
      })

      if (!res.ok) {
        const data = await leerRespuestaJson<{ error?: string }>(res)
        setMensajeTarea(data.error || "No se pudo actualizar la tarea.")
        return
      }

      setEditandoTareaId(null)
      setEdicionTareaFecha("")
      setEdicionTareaHora("")
      await cargarTareas()
    } catch {
      setMensajeTarea("Error actualizando la tarea.")
    } finally {
      setGuardandoEdicionTarea(false)
    }
  }

  const abrirEdicionContenidoTarea = (tarea: TareaItem) => {
    setEditandoContenidoTareaId(tarea.id)
    setEdicionTareaContenido(tarea.contenido)
    setMensajeTarea("")
  }

  const cancelarEdicionContenidoTarea = () => {
    setEditandoContenidoTareaId(null)
    setEdicionTareaContenido("")
  }

  const guardarEdicionContenidoTarea = async (id: number) => {
    if (!edicionTareaContenido.trim()) {
      setMensajeTarea("La tarea no puede quedar vacía.")
      return
    }

    try {
      setGuardandoEdicionContenidoTarea(true)
      setMensajeTarea("")

      const res = await fetch("/api/entusiasmo/tareas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, contenido: edicionTareaContenido.trim() }),
      })

      if (!res.ok) {
        const data = await leerRespuestaJson<{ error?: string }>(res)
        setMensajeTarea(data.error || "No se pudo actualizar la tarea.")
        return
      }

      setEditandoContenidoTareaId(null)
      setEdicionTareaContenido("")
      // El texto viejo (con los aportes que tenía) recién queda archivado en
      // el servidor con este guardado — hay que refrescar las dos cosas
      // para que "Ver versiones anteriores" lo muestre ya mismo.
      await cargarTareas()
      await cargarVersionesTareas()
      await cargarAportesRecibidos()
    } catch {
      setMensajeTarea("Error actualizando la tarea.")
    } finally {
      setGuardandoEdicionContenidoTarea(false)
    }
  }

  const renderizarFilaTarea = (tarea: TareaItem) => {
    const fechaHoraTexto = formatearFechaHoraTarea(tarea.fecha, tarea.hora)
    // El admin viendo a otro participante solo puede comentar, nunca editar
    // — se ignora cualquier estado de edición que pudiera haber quedado de
    // antes de cambiar de solapa.
    const editando = !viendoEmail && editandoTareaId === tarea.id

    return (
      <div
        key={tarea.id}
        className="space-y-2 rounded-xl border border-amber-200 bg-white/80 px-3 py-2"
      >
        <div className="flex items-center gap-3">
          {viendoEmail ? (
            <div className="flex flex-1 items-center gap-3">
              <input
                type="checkbox"
                aria-label="Marcar como completada"
                checked={tarea.completada}
                disabled
                title="El admin solo puede comentar, no modificar las tareas de un participante"
              />
              <div className="min-w-0 flex-1">{renderizarContenidoTareaComentable(tarea)}</div>
              {tarea.serie_id && tarea.diaSemana !== null && (
                <span
                  className="shrink-0 text-xs text-amber-600"
                  title={`Se repite todos los ${DIAS_SEMANA_CORTO[tarea.diaSemana]}`}
                >
                  🔁 {DIAS_SEMANA_CORTO[tarea.diaSemana]}
                </span>
              )}
              {tareasNuevasViendo.has(tarea.id) && (
                <span
                  aria-label="Tarea nueva"
                  title="Nueva o cambió desde la última vez que la viste"
                  className="h-2 w-2 shrink-0 rounded-full bg-rose-500"
                />
              )}
            </div>
          ) : editandoContenidoTareaId === tarea.id ? (
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <input
                className="workspace-field flex-1"
                value={edicionTareaContenido}
                onChange={(e) => setEdicionTareaContenido(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                disabled={guardandoEdicionContenidoTarea}
                onClick={() => void guardarEdicionContenidoTarea(tarea.id)}
                className="workspace-button-secondary text-xs disabled:opacity-60"
              >
                {guardandoEdicionContenidoTarea ? "..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={cancelarEdicionContenidoTarea}
                className="text-xs text-gray-500 underline"
              >
                Cancelar
              </button>
            </div>
          ) : (
            // Checkbox separado del texto (no un <label> envolviendo todo) a
            // propósito: el texto ahora puede traer botones de comentario
            // (💬) por dentro, y adentro de un <label> esos clicks también
            // togglearían el checkbox por el comportamiento nativo del tag.
            <div className="flex flex-1 items-center gap-3">
              <input
                type="checkbox"
                aria-label="Marcar como completada"
                checked={tarea.completada}
                onChange={() => void alternarTareaCompletada(tarea.id, tarea.completada)}
              />
              <span
                className={`min-w-0 flex-1 text-sm ${
                  tarea.completada ? "text-gray-400 line-through" : "text-gray-800"
                }`}
              >
                {renderizarSegmentosConAportes(
                  tarea.contenido,
                  aportesRecibidos.filter(
                    (a) =>
                      a.campo === campoDeTarea(tarea.id) &&
                      a.fragmento &&
                      (a.tarea_version_id ?? null) === null
                  )
                )}
              </span>
              <button
                type="button"
                onClick={() => abrirEdicionContenidoTarea(tarea)}
                aria-label="Editar texto de la tarea"
                title="Editar texto de la tarea"
                className="shrink-0 text-xs text-amber-600 underline"
              >
                ✎
              </button>
              {tarea.serie_id && tarea.diaSemana !== null && (
                <span
                  className="shrink-0 text-xs text-amber-600"
                  title={`Se repite todos los ${DIAS_SEMANA_CORTO[tarea.diaSemana]}`}
                >
                  🔁 {DIAS_SEMANA_CORTO[tarea.diaSemana]}
                </span>
              )}
              {tareasNuevasViendo.has(tarea.id) && (
                <span
                  aria-label="Tarea nueva"
                  title="Nueva o cambió desde la última vez que la viste"
                  className="h-2 w-2 shrink-0 rounded-full bg-rose-500"
                />
              )}
            </div>
          )}

          {!editando && (
            <>
              {fechaHoraTexto && (
                <span className="shrink-0 text-xs text-amber-700">{fechaHoraTexto}</span>
              )}
              {!viendoEmail && (
                <button
                  type="button"
                  onClick={() => abrirEdicionFechaHoraTarea(tarea)}
                  className="shrink-0 text-xs text-amber-600 underline"
                >
                  {fechaHoraTexto ? "Editar" : "+ Fecha"}
                </button>
              )}
            </>
          )}

          <div className="flex shrink-0 items-center gap-1">
            {(["verde", "amarillo", "rojo"] as const).map((color) => (
              <button
                key={color}
                type="button"
                disabled={Boolean(viendoEmail)}
                onClick={() => void cambiarPrioridadTarea(tarea.id, tarea.prioridad, color)}
                className={`h-4 w-4 rounded-full border transition disabled:cursor-default ${
                  tarea.prioridad === color
                    ? {
                        verde: "border-emerald-600 bg-emerald-500",
                        amarillo: "border-amber-500 bg-amber-400",
                        rojo: "border-red-600 bg-red-500",
                      }[color]
                    : {
                        verde: "border-emerald-300 bg-transparent hover:bg-emerald-100",
                        amarillo: "border-amber-300 bg-transparent hover:bg-amber-100",
                        rojo: "border-red-300 bg-transparent hover:bg-red-100",
                      }[color]
                }`}
              />
            ))}
          </div>
        </div>

        {!viendoEmail && renderizarNotasTarea(tarea.id)}
        {!viendoEmail && renderizarVersionesTarea(tarea.id)}

        {tarea.serie_id && !viendoEmail && (
          <div>
            {cancelandoTareaId === tarea.id ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-600">¿Cancelar la repetición?</span>
                <button
                  type="button"
                  onClick={() => void cancelarTarea(tarea.id, "esta")}
                  className="text-amber-700 underline"
                >
                  Solo esta vez
                </button>
                <button
                  type="button"
                  onClick={() => void cancelarTarea(tarea.id, "esta_y_proximas")}
                  className="text-red-600 underline"
                >
                  Esta y las próximas
                </button>
                <button
                  type="button"
                  onClick={() => setCancelandoTareaId(null)}
                  className="text-gray-500 underline"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCancelandoTareaId(tarea.id)}
                className="text-xs text-gray-500 underline"
              >
                Cancelar repetición
              </button>
            )}
          </div>
        )}

        {editando && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="workspace-field flex-1"
              value={edicionTareaFecha}
              onChange={(e) => setEdicionTareaFecha(e.target.value)}
            />
            <Hora24Input value={edicionTareaHora} onChange={setEdicionTareaHora} />
            <button
              type="button"
              disabled={guardandoEdicionTarea}
              onClick={() => void guardarEdicionFechaHoraTarea(tarea.id)}
              className="workspace-button-secondary text-xs"
            >
              {guardandoEdicionTarea ? "..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={cancelarEdicionFechaHoraTarea}
              className="text-xs text-gray-500 underline"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    )
  }

  const cambiarViendoEmail = (email: string | null) => {
    setViendoEmail(email)
    setCampoConSeleccion(null)
    setTextoSeleccionado("")
    setComentandoCampo(null)
    setContenidoNotaAncla("")
    setAporteAbiertoId(null)
    setMensajeAporte("")
    setEditandoTareaId(null)
    setCancelandoTareaId(null)
    setEditandoContenidoTareaId(null)
    setEdicionTareaContenido("")

    if (email) {
      setNovedadesPorParticipante((prev) => ({ ...prev, [email]: false }))

      // Importante el orden: primero se pide QUÉ es nuevo (con la lectura
      // vieja todavía vigente) y recién después se marca como leído — si
      // fuera al revés, la propia marca borraría lo que se quiere mostrar.
      void (async () => {
        try {
          const res = await fetch(
            `/api/entusiasmo/admin/novedades-detalle?email=${encodeURIComponent(email)}`
          )
          const data = await leerRespuestaJson<{
            campos?: string[]
            produccionesIds?: number[]
            tareasIds?: number[]
          }>(res)
          setCamposNuevosViendo(new Set(data.campos || []))
          setProduccionesNuevasViendo(new Set(data.produccionesIds || []))
          setTareasNuevasViendo(new Set(data.tareasIds || []))
        } catch {
          setCamposNuevosViendo(new Set())
          setProduccionesNuevasViendo(new Set())
          setTareasNuevasViendo(new Set())
        }

        await fetch("/api/entusiasmo/lecturas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participanteEmail: email }),
        })
        window.dispatchEvent(new Event("entusiasmo-lectura-actualizada"))
      })()
    } else {
      setCamposNuevosViendo(new Set())
      setProduccionesNuevasViendo(new Set())
      setTareasNuevasViendo(new Set())
    }
  }

  const manejarSeleccionTexto = (campo: string) => {
    const seleccion = window.getSelection()
    const texto = seleccion ? seleccion.toString().trim() : ""

    if (texto) {
      setCampoConSeleccion(campo)
      setTextoSeleccionado(texto)
    }
  }

  const guardarNotaAncla = async () => {
    if (!viendoEmail || !comentandoCampo || !contenidoNotaAncla.trim()) {
      return
    }

    try {
      setGuardandoNotaAncla(true)
      setMensajeAporte("")

      const res = await fetch("/api/entusiasmo/aportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participanteEmail: viendoEmail,
          contenido: contenidoNotaAncla.trim(),
          campo: comentandoCampo,
          fragmento: textoSeleccionado,
        }),
      })
      const data = await leerRespuestaJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajeAporte(data.error || "No se pudo guardar el comentario.")
        return
      }

      setContenidoNotaAncla("")
      setComentandoCampo(null)
      setCampoConSeleccion(null)
      setTextoSeleccionado("")
      await cargarAportesRecibidos()
    } catch {
      setMensajeAporte("Error guardando el comentario.")
    } finally {
      setGuardandoNotaAncla(false)
    }
  }

  type SegmentoCoordenada = { texto: string; nota?: AporteItem }

  const construirSegmentosResaltados = (
    texto: string,
    notas: AporteItem[]
  ): SegmentoCoordenada[] => {
    const posiciones: Array<{ nota: AporteItem; inicio: number; fin: number }> = []

    for (const nota of notas) {
      if (!nota.fragmento) continue
      const inicio = texto.indexOf(nota.fragmento)
      if (inicio === -1) continue
      const fin = inicio + nota.fragmento.length
      const solapa = posiciones.some((p) => inicio < p.fin && fin > p.inicio)
      if (solapa) continue
      posiciones.push({ nota, inicio, fin })
    }

    posiciones.sort((a, b) => a.inicio - b.inicio)

    const segmentos: SegmentoCoordenada[] = []
    let cursor = 0

    for (const p of posiciones) {
      if (p.inicio > cursor) {
        segmentos.push({ texto: texto.slice(cursor, p.inicio) })
      }
      segmentos.push({ texto: texto.slice(p.inicio, p.fin), nota: p.nota })
      cursor = p.fin
    }

    if (cursor < texto.length) {
      segmentos.push({ texto: texto.slice(cursor) })
    }

    return segmentos
  }

  // Segmentos de texto con el mismo tratamiento en las dos vistas: fragmento
  // resaltado + ícono 💬 + globito que se abre al pasar el mouse o tocarlo.
  // Se usa tanto para el texto vigente (renderizarCampoLectura) como para
  // cada versión archivada (renderizarVersionesCampo) — así un aporte se ve
  // siempre igual, esté sobre el texto actual o sobre uno viejo.
  const renderizarSegmentosConAportes = (texto: string, notas: AporteItem[]) => {
    const segmentos = construirSegmentosResaltados(texto, notas)

    return segmentos.map((seg, i) =>
      seg.nota ? (
        <span key={i} className="group relative inline">
          <span
            className={`rounded px-0.5 transition-colors group-hover:bg-amber-200 ${
              aporteAbiertoId === seg.nota!.id ? "bg-amber-200" : ""
            }`}
          >
            {seg.texto}
          </span>
          <button
            type="button"
            aria-label="Ver comentario"
            onClick={() =>
              setAporteAbiertoId((prev) => (prev === seg.nota!.id ? null : seg.nota!.id))
            }
            className="mx-0.5 cursor-pointer align-middle text-amber-600"
          >
            💬
          </button>
          <span
            className={`absolute bottom-full left-0 z-10 mb-1 hidden w-64 max-w-[80vw] rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2 text-sm normal-case shadow-lg group-hover:block ${
              aporteAbiertoId === seg.nota!.id ? "!block" : ""
            }`}
          >
            <span className="block text-gray-800">{seg.nota!.contenido}</span>
            <span className="mt-1 block text-xs text-gray-500">
              {seg.nota!.autor_nombre || seg.nota!.autor_email} ·{" "}
              {new Date(seg.nota!.created_at).toLocaleDateString("es-AR")}
            </span>
          </span>
        </span>
      ) : (
        <span key={i}>{seg.texto}</span>
      )
    )
  }

  // Botón "💬 Comentar selección" (aparece tras seleccionar texto con el
  // mouse) + el formulario para escribir y guardar el comentario — mismo
  // bloque reutilizado en Coordenadas, Tareas y ahora Producciones/Pitch.
  const renderizarDisparadorComentarSeleccion = (campo: string) => {
    const hayTextoSeleccionadoAca = campoConSeleccion === campo && textoSeleccionado

    if (!hayTextoSeleccionadoAca || comentandoCampo === campo) return null

    return (
      <button
        type="button"
        onClick={() => {
          setComentandoCampo(campo)
          setContenidoNotaAncla("")
          setMensajeAporte("")
        }}
        className="workspace-button-secondary text-xs"
      >
        💬 Comentar selección: &ldquo;
        {textoSeleccionado.length > 40 ? `${textoSeleccionado.slice(0, 40)}…` : textoSeleccionado}
        &rdquo;
      </button>
    )
  }

  // Para campos sin texto para seleccionar (una producción de imagen/audio,
  // el pitch) — un botón directo que abre el mismo formulario, sin pasar
  // por una selección de texto primero (el comentario queda sin fragmento).
  const renderizarBotonDejarAporte = (campo: string) => {
    if (comentandoCampo === campo) return null

    return (
      <button
        type="button"
        onClick={() => {
          setComentandoCampo(campo)
          setCampoConSeleccion(null)
          setTextoSeleccionado("")
          setContenidoNotaAncla("")
          setMensajeAporte("")
        }}
        className="workspace-button-secondary text-xs"
      >
        💬 Dejar un aporte
      </button>
    )
  }

  const renderizarFormularioAporte = (campo: string) => {
    if (comentandoCampo !== campo) return null

    return (
      <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50/60 p-3">
        {textoSeleccionado && (
          <p className="text-xs text-gray-600">Sobre: &ldquo;{textoSeleccionado}&rdquo;</p>
        )}
        {mensajeAporte && <p className="text-xs text-red-600">{mensajeAporte}</p>}
        <textarea
          className="workspace-field min-h-16"
          placeholder="Tu comentario..."
          value={contenidoNotaAncla}
          onChange={(e) => setContenidoNotaAncla(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={guardandoNotaAncla || !contenidoNotaAncla.trim()}
            onClick={() => void guardarNotaAncla()}
            className="workspace-button-secondary disabled:opacity-60"
          >
            {guardandoNotaAncla ? "Guardando..." : "Guardar comentario"}
          </button>
          <button
            type="button"
            onClick={() => {
              setComentandoCampo(null)
              setCampoConSeleccion(null)
              setTextoSeleccionado("")
            }}
            className="text-xs text-gray-500 underline"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  const renderizarNotasCampo = (campo: keyof CoordenadasForm) => {
    // Solo los comentarios todavía sobre el texto vigente (sin versión
    // asignada) — los que ya quedaron atados a una versión archivada se ven
    // ahí, con el globito, en vez de acá también (evita el duplicado que
    // mostraba el mismo aporte dos veces).
    const notas = aportesRecibidos.filter(
      (a) => a.campo === campo && (a.version_id ?? null) === null
    )

    if (notas.length === 0) return null

    return (
      <div className="space-y-1 pt-1">
        {notas.map((n) => (
          <div
            key={n.id}
            className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-gray-700"
          >
            {n.fragmento && (
              <p className="italic text-gray-500">sobre: &ldquo;{n.fragmento}&rdquo;</p>
            )}
            <p>💬 {n.contenido}</p>
            <p className="text-gray-500">— {n.autor_nombre || n.autor_email}</p>
          </div>
        ))}
      </div>
    )
  }

  const renderizarVersionesCampo = (campo: keyof CoordenadasForm) => {
    const columna = COLUMNA_POR_CAMPO_COORDENADAS[campo]
    const versiones = versionesCoordenadas[columna] || []

    if (!versionesCargadas || versiones.length === 0) return null

    const abierto = Boolean(versionesCampoAbierto[columna])

    return (
      <div className="pt-1">
        <button
          type="button"
          onClick={() =>
            setVersionesCampoAbierto((prev) => ({ ...prev, [columna]: !prev[columna] }))
          }
          className="text-xs text-gray-500 underline"
        >
          {abierto ? "Ocultar" : "Ver"} versiones anteriores ({versiones.length})
        </button>

        {abierto && (
          <div className="mt-1 space-y-1">
            {versiones.map((v) => {
              const comentariosDeEstaVersion = aportesRecibidos.filter(
                (a) => a.campo === campo && a.version_id === v.id
              )
              const comentariosConFragmento = comentariosDeEstaVersion.filter((c) => c.fragmento)
              const comentariosSinFragmento = comentariosDeEstaVersion.filter((c) => !c.fragmento)

              return (
                <div
                  key={v.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600"
                >
                  <p className="whitespace-pre-wrap">
                    {renderizarSegmentosConAportes(v.contenido, comentariosConFragmento)}
                  </p>
                  <p className="mt-1 text-gray-400">
                    {new Date(v.created_at).toLocaleString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hourCycle: "h23",
                    })}
                  </p>

                  {comentariosSinFragmento.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-gray-200 pt-2">
                      {comentariosSinFragmento.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-gray-700"
                        >
                          <p>💬 {c.contenido}</p>
                          <p className="text-gray-500">
                            — {c.autor_nombre || c.autor_email}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const renderizarCampoLectura = (
    campo: keyof CoordenadasForm,
    etiqueta: string,
    valor: string
  ) => {
    // Solo los comentarios que siguen sobre el texto vigente (sin versión
    // asignada todavía) se resaltan acá — los que quedaron atados a una
    // versión anterior se muestran junto a esa versión, en
    // renderizarVersionesCampo, para no intentar calzarlos contra un texto
    // que ya cambió.
    const notasDelCampo = aportesRecibidos.filter(
      // "?? null" normaliza el caso en que la columna version_id todavía no
      // existe (llega undefined en vez de null) al mismo comportamiento que
      // un comentario sin versión asignada — así no deja de mostrarse nada
      // mientras la migración no esté corrida.
      (a) => a.campo === campo && a.fragmento && (a.version_id ?? null) === null
    )
    const esNuevo = camposNuevosViendo.has(COLUMNA_POR_CAMPO_COORDENADAS[campo])

    return (
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700">
          {esNuevo && (
            <span
              aria-label="Cambió recientemente"
              title="Cambió desde la última vez que lo viste"
              className="h-2 w-2 shrink-0 rounded-full bg-rose-500"
            />
          )}
          {etiqueta}
        </span>
        <p
          className="workspace-field min-h-24 cursor-text whitespace-pre-wrap"
          onMouseUp={() => manejarSeleccionTexto(campo)}
        >
          {valor ? (
            renderizarSegmentosConAportes(valor, notasDelCampo)
          ) : (
            <span className="italic text-gray-400">Sin definir todavía.</span>
          )}
        </p>

        {renderizarDisparadorComentarSeleccion(campo)}
        {renderizarFormularioAporte(campo)}

        {renderizarVersionesCampo(campo)}
      </div>
    )
  }

  // Mismo mecanismo de comentarios anclados que Coordenadas (campo +
  // fragmento en entusiasmo_aportes), reutilizando exactamente el mismo
  // estado — "campo" acá es un identificador propio de la tarea
  // ("tarea:<id>"), no uno de los campos fijos de Coordenadas, pero la
  // columna siempre fue texto libre así que no hace falta tocar el backend.
  const campoDeTarea = (tareaId: number) => `tarea:${tareaId}`

  const renderizarNotasTarea = (tareaId: number) => {
    // Solo los comentarios todavía sobre el texto vigente — los que ya
    // quedaron atados a una versión archivada de la tarea se ven ahí, con
    // el globito (renderizarVersionesTarea), para no repetir el mismo
    // aporte dos veces.
    const notas = aportesRecibidos.filter(
      (a) => a.campo === campoDeTarea(tareaId) && (a.tarea_version_id ?? null) === null
    )

    if (notas.length === 0) return null

    return (
      <div className="space-y-1">
        {notas.map((n) => (
          <div
            key={n.id}
            className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-gray-700"
          >
            {n.fragmento && (
              <p className="italic text-gray-500">sobre: &ldquo;{n.fragmento}&rdquo;</p>
            )}
            <p>💬 {n.contenido}</p>
            <p className="text-gray-500">— {n.autor_nombre || n.autor_email}</p>
          </div>
        ))}
      </div>
    )
  }

  // Mismo mecanismo que campoDeTarea, para Producciones — sin versionado
  // (hoy no existe forma de editar el contenido de una producción, así que
  // no hace falta ningún "atado a versión archivada").
  const campoDeProduccion = (produccionId: number) => `produccion:${produccionId}`

  // El pitch es único por persona (no tiene id propio como una producción),
  // así que el campo es un literal fijo — el admin no tiene texto para
  // seleccionar (es video/imagen), por eso usa renderizarBotonDejarAporte
  // en vez del flujo de selección.
  const CAMPO_PITCH = "pitch"

  const renderizarNotasPitch = () => {
    const notas = aportesRecibidos.filter((a) => a.campo === CAMPO_PITCH)

    if (notas.length === 0) return null

    return (
      <div className="space-y-1">
        {notas.map((n) => (
          <div
            key={n.id}
            className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-gray-700"
          >
            <p>💬 {n.contenido}</p>
            <p className="text-gray-500">— {n.autor_nombre || n.autor_email}</p>
          </div>
        ))}
      </div>
    )
  }

  const renderizarNotasProduccion = (produccionId: number) => {
    const notas = aportesRecibidos.filter((a) => a.campo === campoDeProduccion(produccionId))

    if (notas.length === 0) return null

    return (
      <div className="space-y-1">
        {notas.map((n) => (
          <div
            key={n.id}
            className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-gray-700"
          >
            {n.fragmento && (
              <p className="italic text-gray-500">sobre: &ldquo;{n.fragmento}&rdquo;</p>
            )}
            <p>💬 {n.contenido}</p>
            <p className="text-gray-500">— {n.autor_nombre || n.autor_email}</p>
          </div>
        ))}
      </div>
    )
  }

  const renderizarVersionesTarea = (tareaId: number) => {
    const versiones = versionesTareas[tareaId] || []

    if (!versionesTareasCargadas || versiones.length === 0) return null

    const abierto = Boolean(versionesTareaAbierta[tareaId])

    return (
      <div className="pt-1">
        <button
          type="button"
          onClick={() =>
            setVersionesTareaAbierta((prev) => ({ ...prev, [tareaId]: !prev[tareaId] }))
          }
          className="text-xs text-gray-500 underline"
        >
          {abierto ? "Ocultar" : "Ver"} versiones anteriores ({versiones.length})
        </button>

        {abierto && (
          <div className="mt-1 space-y-1">
            {versiones.map((v) => {
              const comentariosDeEstaVersion = aportesRecibidos.filter(
                (a) => a.campo === campoDeTarea(tareaId) && a.tarea_version_id === v.id
              )
              const comentariosConFragmento = comentariosDeEstaVersion.filter((c) => c.fragmento)
              const comentariosSinFragmento = comentariosDeEstaVersion.filter((c) => !c.fragmento)

              return (
                <div
                  key={v.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600"
                >
                  <p className="whitespace-pre-wrap">
                    {renderizarSegmentosConAportes(v.contenido, comentariosConFragmento)}
                  </p>
                  <p className="mt-1 text-gray-400">
                    {new Date(v.created_at).toLocaleString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hourCycle: "h23",
                    })}
                  </p>

                  {comentariosSinFragmento.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-gray-200 pt-2">
                      {comentariosSinFragmento.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-gray-700"
                        >
                          <p>💬 {c.contenido}</p>
                          <p className="text-gray-500">— {c.autor_nombre || c.autor_email}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const renderizarContenidoTareaComentable = (tarea: TareaItem) => {
    const campo = campoDeTarea(tarea.id)
    // Mismo criterio que Coordenadas: solo los comentarios todavía sobre el
    // texto vigente (sin versión asignada) se resaltan acá — los que ya
    // quedaron atados a una versión archivada de la tarea se ven junto a
    // esa versión (ver renderizarVersionesTarea).
    const notasDelCampo = aportesRecibidos.filter(
      (a) => a.campo === campo && a.fragmento && (a.tarea_version_id ?? null) === null
    )

    return (
      <div className="space-y-2">
        <p
          className={`cursor-text text-sm ${
            tarea.completada ? "text-gray-400 line-through" : "text-gray-800"
          }`}
          onMouseUp={() => manejarSeleccionTexto(campo)}
        >
          {renderizarSegmentosConAportes(tarea.contenido, notasDelCampo)}
        </p>

        {renderizarDisparadorComentarSeleccion(campo)}
        {renderizarFormularioAporte(campo)}

        {renderizarVersionesTarea(tarea.id)}
      </div>
    )
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

      if (coordenadasAbiertas) {
        void cargarVersionesCoordenadas()
        // Los comentarios que estaban sobre el texto vigente acaban de
        // quedar atados a la versión que se archiva recién ahora — sin este
        // refetch, el panel de versiones seguiría mostrándolos como si
        // siguieran "en vivo" hasta la próxima recarga.
        void cargarAportesRecibidos()
      }
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

  const handleEliminarPitch = async () => {
    if (!window.confirm("¿Eliminar tu pitch? Vas a quedar sin pitch hasta que grabes uno nuevo.")) {
      return
    }

    setMensajePitch("")

    try {
      setSubiendoPitch(true)
      setEstadoSubidaPitch("Eliminando pitch...")

      const res = await fetch("/api/entusiasmo/pitch/confirmar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await leerRespuestaJson<{ error?: string }>(res)

      if (!res.ok) {
        setMensajePitch(data.error || "No se pudo eliminar el pitch.")
        return
      }

      setProyecto((prev) =>
        prev
          ? {
              ...prev,
              pitch_storage_path: null,
              pitch_mime_type: null,
              pitch_actualizado_at: null,
            }
          : prev
      )
      setPitchSignedUrl(null)
      setArchivoPitch(null)
      setMensajePitch("Pitch eliminado.")
    } catch {
      setMensajePitch("Error eliminando el pitch.")
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

  useEffect(() => {
    if (!mounted || !esAdmin) return

    let cancelado = false

    const cargarNovedades = async () => {
      try {
        const res = await fetch("/api/entusiasmo/admin/novedades")
        const data = await leerRespuestaJson<{
          novedades?: Record<string, boolean>
        }>(res)

        if (!res.ok || cancelado) return

        setNovedadesPorParticipante(data.novedades || {})
      } catch {
        if (!cancelado) setNovedadesPorParticipante({})
      }
    }

    void cargarNovedades()

    return () => {
      cancelado = true
    }
  }, [esAdmin, mounted])

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

  const claveRecordatorioAgente = viendoEmail || storageEmail
  const recordatorioAgenteNoLeido = Boolean(
    proyecto?.agente_recordatorio_texto &&
      proyecto?.agente_recordatorio_generado_at &&
      recordatorioAgenteVisto[claveRecordatorioAgente] !==
        proyecto.agente_recordatorio_generado_at
  )

  const marcarRecordatorioAgenteComoVisto = () => {
    if (!proyecto?.agente_recordatorio_generado_at) return
    setRecordatorioAgenteVisto((prev) => ({
      ...prev,
      [claveRecordatorioAgente]: proyecto.agente_recordatorio_generado_at as string,
    }))
  }

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

  const nombrePitchMostrado = viendoEmail
    ? participantesActivosCasaTalentos.find((p) => p.email === viendoEmail)?.nombre ||
      viendoEmail
    : nombre

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
        <InstalarApp />
        <WorkspaceHero title="Entusiasmento" subtitle="Espacio para Plasmar" />

        {puntosGrupales && (esAdmin || proyecto?.suma_puntos_grupales !== false) && (
          <div className="space-y-3 rounded-[1.5rem] border-2 border-emerald-300 bg-emerald-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="workspace-eyebrow text-emerald-600">🎯 Reunión extra del grupo</p>
                <h3 className="text-lg font-bold tracking-tight text-emerald-900">
                  {puntosGrupales.proximoUmbral
                    ? `${puntosGrupales.total} / ${puntosGrupales.proximoUmbral} puntos`
                    : `¡Las dos reuniones extra de este mes ya están desbloqueadas! (${puntosGrupales.total} pts)`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDesglosePuntosAbierto((v) => !v)}
                className="text-xs text-emerald-700 underline"
              >
                {desglosePuntosAbierto ? "Ocultar" : "Ver"} quién aportó
              </button>
            </div>

            <div className="h-3 w-full overflow-hidden rounded-full bg-white/80">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${puntosGrupales.porcentajeHaciaProximo}%` }}
              />
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-emerald-800">
              {puntosGrupales.umbrales.map((u) => (
                <span key={u.umbral} className={u.alcanzado ? "font-semibold" : ""}>
                  {u.alcanzado ? "✓" : "○"} {u.umbral} pts
                </span>
              ))}
            </div>

            {desglosePuntosAbierto && (
              <div className="space-y-1 border-t border-emerald-200 pt-2">
                {puntosGrupales.desglose.length === 0 ? (
                  <p className="text-xs text-emerald-700">
                    Todavía nadie sumó puntos este mes.
                  </p>
                ) : (
                  puntosGrupales.desglose.map((d) => (
                    <div
                      key={d.email}
                      className="flex items-center justify-between text-xs text-emerald-800"
                    >
                      <span>{d.nombre}</span>
                      <span className="font-semibold">{d.puntos} pts</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {esAdmin && viendoEmail && (
              <div className="space-y-1 border-t border-emerald-200 pt-2">
                <label className="flex items-center gap-2 text-xs text-emerald-800">
                  <input
                    type="checkbox"
                    checked={proyecto?.suma_puntos_grupales !== false}
                    disabled={guardandoSumaPuntos}
                    onChange={(e) => void cambiarSumaPuntosGrupales(e.target.checked)}
                  />
                  {nombrePitchMostrado} suma puntos para la reunión grupal
                </label>
                {mensajeSumaPuntos && (
                  <p className="text-xs text-red-600">{mensajeSumaPuntos}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {proximoEncuentro && (
            <div className="inline-flex items-center gap-3 rounded-full border border-[var(--accent)] bg-white/90 px-4 py-2 shadow-sm">
              <span className="text-xs text-gray-600">
                {formatearFecha(proximoEncuentro.fecha)} ·{" "}
                <HoraEnZonaLocal
                  fecha={proximoEncuentro.fecha}
                  hora={proximoEncuentro.hora}
                />
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

          {recordatorioAgenteNoLeido && (
            <button
              type="button"
              onClick={() => {
                document
                  .getElementById("tareas-semanales-seccion")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }}
              className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--accent)] bg-[rgba(255,247,225,0.9)] px-4 py-2 shadow-[0_0_16px_rgba(207,145,48,0.45)] transition hover:shadow-[0_0_22px_rgba(207,145,48,0.6)]"
            >
              <span aria-hidden style={{ fontSize: "1.2rem" }}>✨</span>
              <span className="text-xs font-semibold text-[var(--accent-strong)]">
                Tenés un destello nuevo
              </span>
              <span className="workspace-badge-unread">1</span>
            </button>
          )}
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
                Para usar Entusiasmento necesitás tener tu acceso activo.
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

            {tieneAccesoEntusiasmento(storageEmail, esAdmin) ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDestinoEntusiasmo("mi-espacio")}
                    className={`relative rounded-[1.5rem] border-2 px-4 py-4 text-left transition ${
                      destinoEntusiasmo === "mi-espacio"
                        ? "border-[var(--accent)] bg-[rgba(207,145,48,0.1)] shadow-[0_6px_0_0_rgba(207,145,48,0.25)]"
                        : "border-[var(--line)] bg-white/70"
                    }`}
                  >
                    {hayAportesNuevos && (
                      <span
                        aria-label="Nuevo aporte"
                        title="Tenés un aporte nuevo"
                        className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-rose-500"
                      />
                    )}
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

                {esAdmin && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => cambiarViendoEmail(null)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        !viendoEmail
                          ? "border-[var(--accent)] bg-[rgba(207,145,48,0.12)] text-[var(--accent-strong)]"
                          : "border-[var(--line)] bg-white/70 text-gray-600"
                      }`}
                    >
                      Yo
                    </button>
                    {participantesActivosCasaTalentos
                      .filter((p) => p.email !== storageEmail)
                      .map((p) => (
                        <button
                          key={p.email}
                          type="button"
                          onClick={() => cambiarViendoEmail(p.email)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                            viendoEmail === p.email
                              ? "border-[var(--accent)] bg-[rgba(207,145,48,0.12)] text-[var(--accent-strong)]"
                              : "border-[var(--line)] bg-white/70 text-gray-600"
                          }`}
                        >
                          {novedadesPorParticipante[p.email] && (
                            <span
                              aria-label="Actividad nueva"
                              title="Avanzó algo nuevo"
                              className="h-2 w-2 rounded-full bg-rose-500"
                            />
                          )}
                          {p.nombre || p.email}
                        </button>
                      ))}
                  </div>
                )}

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

                    <MensajesAgente participanteEmail={viendoEmail} />
                    <Buscador participanteEmail={viendoEmail} />

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="workspace-eyebrow">✦ Siempre visible</p>
                        <h3 className="text-2xl font-bold tracking-tight">
                          {viendoEmail ? "Su pitch" : "Tu pitch"}
                        </h3>
                      </div>

                      <div className="flex flex-col items-start gap-5 md:flex-row">
                        <div className="relative mx-auto aspect-[9/16] w-full max-w-[220px] shrink-0 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#f9d976] via-[#c98b1b] to-[#8a5b0f] p-[3px] shadow-[0_10px_28px_rgba(154,98,24,0.3)] md:mx-0">
                          <div className="relative h-full w-full overflow-hidden rounded-[1.75rem] bg-black">
                            {pitchSignedUrl ? (
                              proyecto?.pitch_mime_type?.startsWith("image/") ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={pitchSignedUrl}
                                  alt="Pitch"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <VideoEmbed
                                  src={pitchSignedUrl}
                                  title="Pitch"
                                  className="h-full w-full object-cover"
                                />
                              )
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#2a2a2a] to-[#0f0f0f] px-6 text-center">
                                <span className="text-4xl">✦</span>
                                <p className="text-xs text-white/70">
                                  {viendoEmail
                                    ? "Todavía no subió su pitch."
                                    : "Todavía no grabaste tu pitch."}
                                </p>
                              </div>
                            )}

                            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#f9d976] via-[#c98b1b] to-[#8a5b0f] p-[2px]">
                                <span className="flex h-full w-full items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                                  {(nombrePitchMostrado || "?").trim().charAt(0).toUpperCase()}
                                </span>
                              </span>
                              <span className="truncate text-sm font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
                                {nombrePitchMostrado}
                              </span>
                            </div>

                            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                              <p className="text-xs font-medium text-white/90">
                                ✦ Así te ven en la mesa
                              </p>
                            </div>
                          </div>
                        </div>

                        {!viendoEmail && (
                          <div className="w-full flex-1 space-y-2">
                            <GrabadorVideo
                              onVideoListo={handleArchivoPitch}
                              disabled={subiendoPitch}
                              maxSegundos={90}
                              permitirArchivo={false}
                            />

                            {mensajePitch && (
                              <p className="text-sm text-gray-700">{mensajePitch}</p>
                            )}

                            {archivoPitch && (
                              <button
                                type="button"
                                disabled={subiendoPitch}
                                onClick={() => void handleSubirPitch()}
                                className="workspace-button-primary w-full"
                              >
                                {subiendoPitch
                                  ? estadoSubidaPitch || "Subiendo..."
                                  : proyecto?.pitch_storage_path
                                    ? "Volver a grabarlo"
                                    : "Guardar pitch"}
                              </button>
                            )}

                            {proyecto?.pitch_storage_path && (
                              <button
                                type="button"
                                disabled={subiendoPitch}
                                onClick={() => void handleEliminarPitch()}
                                className="text-sm text-red-600 underline disabled:opacity-60"
                              >
                                Eliminar pitch
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {viendoEmail && (
                        <div className="space-y-2">
                          {renderizarBotonDejarAporte(CAMPO_PITCH)}
                          {renderizarFormularioAporte(CAMPO_PITCH)}
                        </div>
                      )}
                      {!viendoEmail && renderizarNotasPitch()}
                    </div>

                    {aportesRecibidos.filter((a) => !a.campo).length > 0 && (
                      <div className="space-y-2">
                        <p className="workspace-eyebrow">
                          {viendoEmail ? "Aportes generales" : "Te dejaron un aporte"}
                        </p>
                        {aportesRecibidos.filter((a) => !a.campo).map((aporte, indice) => {
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
                            <span className="inline-flex items-center gap-1.5 text-lg font-bold tracking-tight text-sky-900">
                              Coordenadas
                              {camposNuevosViendo.size > 0 && (
                                <span
                                  aria-label="Hay cambios nuevos"
                                  title="Hay cambios nuevos"
                                  className="h-2.5 w-2.5 rounded-full bg-rose-500"
                                />
                              )}
                            </span>
                            <span className="block text-sm text-sky-700">
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
                          {viendoEmail ? (
                            <>
                              <div className="grid gap-4 md:grid-cols-2">
                                {CAMPOS_COORDENADAS_PRINCIPALES.map(({ campo, etiqueta, colSpan }) => (
                                  <div key={campo} className={colSpan ? "md:col-span-2" : ""}>
                                    {renderizarCampoLectura(campo, etiqueta, coordenadas[campo])}
                                  </div>
                                ))}
                              </div>

                              <div className="workspace-panel-soft space-y-3">
                                <h3 className="text-lg font-semibold">Resultados</h3>
                                <div className="grid gap-4 md:grid-cols-2">
                                  {CAMPOS_COORDENADAS_RESULTADOS.map(({ campo, etiqueta }) => (
                                    <div key={campo}>
                                      {renderizarCampoLectura(campo, etiqueta, coordenadas[campo])}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="grid gap-4 md:grid-cols-2">
                                {CAMPOS_COORDENADAS_PRINCIPALES.map(({ campo, etiqueta, colSpan }) => (
                                  <label
                                    key={campo}
                                    className={`space-y-2 ${colSpan ? "md:col-span-2" : ""}`}
                                  >
                                    <span className="text-sm font-medium text-gray-700">
                                      {etiqueta}
                                    </span>
                                    <textarea
                                      className="workspace-field min-h-24"
                                      value={coordenadas[campo]}
                                      onChange={(e) =>
                                        setCoordenadas((prev) => ({
                                          ...prev,
                                          [campo]: e.target.value,
                                        }))
                                      }
                                    />
                                    {renderizarNotasCampo(campo)}
                                    {renderizarVersionesCampo(campo)}
                                  </label>
                                ))}
                              </div>

                              <div className="workspace-panel-soft space-y-3">
                                <h3 className="text-lg font-semibold">Resultados</h3>
                                <div className="grid gap-4 md:grid-cols-2">
                                  {CAMPOS_COORDENADAS_RESULTADOS.map(({ campo, etiqueta }) => (
                                    <label key={campo} className="space-y-2">
                                      <span className="text-sm font-medium text-gray-700">
                                        {etiqueta}
                                      </span>
                                      <textarea
                                        className="workspace-field min-h-20"
                                        value={coordenadas[campo]}
                                        onChange={(e) =>
                                          setCoordenadas((prev) => ({
                                            ...prev,
                                            [campo]: e.target.value,
                                          }))
                                        }
                                      />
                                      {renderizarNotasCampo(campo)}
                                      {renderizarVersionesCampo(campo)}
                                    </label>
                                  ))}
                                </div>
                              </div>

                              <p className="text-xs text-amber-700">
                                ⚠️ No olvides guardar tus actualizaciones — los cambios no se
                                guardan solos.
                              </p>

                              <button
                                type="button"
                                disabled={guardandoCoordenadas}
                                onClick={() => void guardarCoordenadas()}
                                className="workspace-button-primary disabled:opacity-60"
                              >
                                {guardandoCoordenadas ? "Guardando..." : "Guardar coordenadas"}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div
                      id="tareas-semanales-seccion"
                      className="space-y-3 rounded-[1.75rem] border-2 border-amber-200 bg-amber-50/50 p-4"
                    >
                      <div className="space-y-1">
                        <p className="workspace-eyebrow text-amber-600">📋 Tareas semanales</p>
                        <h3 className="inline-flex items-center gap-1.5 text-lg font-bold tracking-tight text-amber-900">
                          Lo que te proponés esta semana
                          {tareasNuevasViendo.size > 0 && (
                            <span
                              aria-label="Hay tareas nuevas"
                              title="Hay tareas nuevas"
                              className="h-2.5 w-2.5 rounded-full bg-rose-500"
                            />
                          )}
                        </h3>
                      </div>

                      {proyecto?.agente_recordatorio_texto && (
                        <div className="flex items-start justify-between gap-3 rounded-2xl border-2 border-[var(--accent)] bg-[rgba(255,247,225,0.9)] p-4 shadow-[0_0_16px_rgba(207,145,48,0.3)]">
                          <div className="space-y-1">
                            <p className="workspace-eyebrow text-[var(--accent-strong)]">✨ Destello de la semana</p>
                            <p className="text-sm text-gray-800">{proyecto.agente_recordatorio_texto}</p>
                          </div>
                          {!viendoEmail &&
                            (recordatorioAgenteNoLeido ? (
                              <button
                                type="button"
                                onClick={marcarRecordatorioAgenteComoVisto}
                                className="shrink-0 text-xs text-gray-500 underline"
                              >
                                Ya lo vi
                              </button>
                            ) : (
                              <span className="shrink-0 text-xs text-emerald-600">✓ Visto</span>
                            ))}
                        </div>
                      )}

                      {tareas.length > 0 && (
                        <div className="space-y-1">
                          <p className="workspace-eyebrow">♪ Tu ritmo</p>
                          <div className="h-3 w-full overflow-hidden rounded-full bg-white/80">
                            <div
                              className="h-full rounded-full bg-[var(--accent)] transition-all"
                              style={{ width: `${porcentajeRitmo}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500">
                            {tareasCompletadas} de {tareas.length} tareas realizadas (
                            {porcentajeRitmo}%)
                          </p>
                        </div>
                      )}

                      {mensajeTarea && (
                        <p className="text-sm text-gray-700">{mensajeTarea}</p>
                      )}

                      <div className="space-y-2">
                        {tareasPendientesLista.map(renderizarFilaTarea)}
                        {tareasPendientesLista.length === 0 && (
                          <p className="text-sm text-gray-600">
                            {tareas.length === 0
                              ? "Todavía no cargaste tareas para esta semana."
                              : "Completaste todo lo que tenías pendiente. ✨"}
                          </p>
                        )}
                      </div>

                      {tareasCompletadasOrdenadas.length > 0 && (
                        <div className="space-y-2 border-t border-amber-200 pt-2">
                          <button
                            type="button"
                            onClick={() => setHistorialTareasAbierto((v) => !v)}
                            className="text-xs text-gray-500 underline"
                          >
                            {historialTareasAbierto ? "Ocultar" : "Ver"} completadas (
                            {tareasCompletadasOrdenadas.length})
                          </button>

                          {historialTareasAbierto && (
                            <div className="space-y-2">
                              {tareasCompletadasOrdenadas.map(renderizarFilaTarea)}
                            </div>
                          )}
                        </div>
                      )}

                      {!viendoEmail && (
                        <div className="space-y-2">
                          <input
                            className="workspace-field"
                            placeholder="Nueva tarea de la semana..."
                            value={nuevaTarea}
                            onChange={(e) => setNuevaTarea(e.target.value)}
                          />
                          <label className="flex items-center gap-2 text-xs text-gray-600">
                            <input
                              type="checkbox"
                              checked={nuevaTareaRepite}
                              onChange={(e) => setNuevaTareaRepite(e.target.checked)}
                            />
                            🔁 Repetir todas las semanas
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {nuevaTareaRepite ? (
                              <select
                                className="workspace-field flex-1"
                                value={nuevaTareaDiaSemana}
                                onChange={(e) => setNuevaTareaDiaSemana(Number(e.target.value))}
                              >
                                {DIAS_SEMANA_CORTO.map((dia, indice) => (
                                  <option key={dia} value={indice}>
                                    Todos los {dia}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="date"
                                className="workspace-field flex-1"
                                value={nuevaTareaFecha}
                                onChange={(e) => setNuevaTareaFecha(e.target.value)}
                              />
                            )}
                            <Hora24Input
                              value={nuevaTareaHora}
                              onChange={setNuevaTareaHora}
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
                          <p className="text-xs text-gray-500">
                            {nuevaTareaRepite
                              ? "Se va a crear una tarea nueva cada semana, ese día."
                              : "Fecha y hora son opcionales."}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 rounded-[1.75rem] border-2 border-violet-200 bg-violet-50/50 p-4">
                      <div className="space-y-1">
                        <p className="workspace-eyebrow text-violet-500">🎨 Producciones</p>
                        <h3 className="inline-flex items-center gap-1.5 text-lg font-bold tracking-tight text-violet-900">
                          Lo que vas armando
                          {produccionesNuevasViendo.size > 0 && (
                            <span
                              aria-label="Hay producciones nuevas"
                              title="Hay producciones nuevas"
                              className="h-2.5 w-2.5 rounded-full bg-rose-500"
                            />
                          )}
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
                                    : item.tipo === "video"
                                      ? "🎬"
                                      : item.tipo === "link"
                                        ? "🔗"
                                        : "📝"}
                              </span>
                              <span className="text-sm font-medium">
                                {item.titulo ||
                                  (item.tipo === "texto" ? "" : item.tipo === "link" ? "Link" : item.tipo)}
                              </span>
                              {produccionesNuevasViendo.has(item.id) && (
                                <span
                                  aria-label="Producción nueva"
                                  title="Nueva desde la última vez que la viste"
                                  className="h-2 w-2 shrink-0 rounded-full bg-rose-500"
                                />
                              )}
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

                            {item.tipo === "video" && item.signedUrl && (
                              <video
                                controls
                                src={item.signedUrl}
                                className="max-h-64 w-full rounded-lg border border-violet-100"
                              >
                                Tu navegador no soporta video.
                              </video>
                            )}

                            {item.tipo === "link" && item.contenido && (
                              <a
                                href={item.contenido}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="break-all text-sm text-[var(--accent-strong)] underline"
                              >
                                {item.contenido}
                              </a>
                            )}

                            {item.tipo === "texto" && item.contenido && (
                              viendoEmail ? (
                                <p
                                  className="cursor-text whitespace-pre-wrap text-sm text-gray-700"
                                  onMouseUp={() => manejarSeleccionTexto(campoDeProduccion(item.id))}
                                >
                                  {renderizarSegmentosConAportes(
                                    item.contenido,
                                    aportesRecibidos.filter(
                                      (a) => a.campo === campoDeProduccion(item.id)
                                    )
                                  )}
                                </p>
                              ) : (
                                <p className="whitespace-pre-wrap text-sm text-gray-700">
                                  {item.contenido}
                                </p>
                              )
                            )}

                            {viendoEmail && item.tipo === "texto" && (
                              <>
                                {renderizarDisparadorComentarSeleccion(campoDeProduccion(item.id))}
                                {renderizarFormularioAporte(campoDeProduccion(item.id))}
                              </>
                            )}
                            {viendoEmail && item.tipo !== "texto" && (
                              <>
                                {renderizarBotonDejarAporte(campoDeProduccion(item.id))}
                                {renderizarFormularioAporte(campoDeProduccion(item.id))}
                              </>
                            )}
                            {!viendoEmail && renderizarNotasProduccion(item.id)}

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

                      {!viendoEmail && (
                        <div className="space-y-2 rounded-xl border border-dashed border-violet-300 bg-white/60 p-3">
                          <div className="flex flex-wrap gap-2">
                            {(["texto", "imagen", "audio", "video", "link"] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => {
                                  setTipoNuevaProduccion(t)
                                  setArchivoProduccion(null)
                                  setTextoProduccion("")
                                }}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                  tipoNuevaProduccion === t
                                    ? "border-violet-500 bg-violet-100 text-violet-800"
                                    : "border-violet-200 bg-white text-violet-500"
                                }`}
                              >
                                {t === "texto"
                                  ? "📝 Texto"
                                  : t === "imagen"
                                    ? "🖼️ Imagen"
                                    : t === "audio"
                                      ? "🎵 Audio"
                                      : t === "video"
                                        ? "🎬 Video"
                                        : "🔗 Link"}
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
                              key="texto"
                              className="workspace-field min-h-20"
                              placeholder="Escribí tu producción..."
                              value={textoProduccion}
                              onChange={(e) => setTextoProduccion(e.target.value)}
                            />
                          ) : tipoNuevaProduccion === "audio" ? (
                            <div key="audio" className="space-y-2">
                              <GrabadorAudio
                                onAudioListo={setArchivoProduccion}
                                maxSegundos={300}
                              />
                              <p className="text-xs text-gray-500">o subí un archivo ya grabado:</p>
                              <input
                                ref={produccionFileInputRef}
                                type="file"
                                accept="audio/*"
                                className="hidden"
                                onChange={handleArchivoProduccion}
                              />
                              <button
                                type="button"
                                onClick={() => produccionFileInputRef.current?.click()}
                                className="workspace-button-ghost text-xs"
                              >
                                📎 Seleccionar archivo
                              </button>
                              {archivoProduccion && (
                                <p className="text-xs text-gray-500">{archivoProduccion.name}</p>
                              )}
                            </div>
                          ) : tipoNuevaProduccion === "video" ? (
                            <div key="video" className="space-y-1">
                              <input
                                ref={produccionFileInputRef}
                                type="file"
                                accept="video/*"
                                className="hidden"
                                onChange={handleArchivoProduccion}
                              />
                              <button
                                type="button"
                                onClick={() => produccionFileInputRef.current?.click()}
                                className="workspace-button-ghost text-xs"
                              >
                                📎 Seleccionar archivo
                              </button>
                              {archivoProduccion && (
                                <p className="text-xs text-gray-500">{archivoProduccion.name}</p>
                              )}
                              <p className="text-xs text-gray-500">Subí un video liviano (hasta 50MB).</p>
                            </div>
                          ) : tipoNuevaProduccion === "link" ? (
                            <div key="link" className="space-y-1">
                              <input
                                type="url"
                                className="workspace-field"
                                placeholder="https://..."
                                value={textoProduccion}
                                onChange={(e) => setTextoProduccion(e.target.value)}
                              />
                              <p className="text-xs text-gray-500">
                                Un link a tu web, Instagram, YouTube, o lo que quieras mostrar. Usá el título de arriba para aclarar de qué es (ej. &quot;Instagram&quot;).
                              </p>
                            </div>
                          ) : (
                            <div key="imagen" className="space-y-1">
                              <input
                                ref={produccionFileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleArchivoProduccion}
                              />
                              <button
                                type="button"
                                onClick={() => produccionFileInputRef.current?.click()}
                                className="workspace-button-ghost text-xs"
                              >
                                📎 Seleccionar archivo
                              </button>
                              {archivoProduccion && (
                                <p className="text-xs text-gray-500">{archivoProduccion.name}</p>
                              )}
                            </div>
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
                      )}
                    </div>

                  </div>
                )}

                {destinoEntusiasmo === "cofruto" && (
                  <div className="space-y-6">
                    <div className="workspace-panel-soft space-y-2 py-6 text-center">
                      <p className="text-lg font-semibold">🧺 CoFruto</p>
                      <p className="text-sm text-gray-600">
                        La mesa común — lo que cada uno eligió mostrar.
                      </p>
                    </div>

                    {cargandoCofruto && (
                      <p className="text-sm text-gray-600">Cargando la mesa común...</p>
                    )}

                    {!cargandoCofruto && puestosCofruto.length === 0 && (
                      <p className="workspace-inline-note text-center">
                        Todavía nadie mostró nada en la mesa común.
                      </p>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {puestosCofruto.map((puesto) => (
                        <button
                          type="button"
                          key={puesto.email}
                          onClick={() => setPuestoAmpliadoEmail(puesto.email)}
                          className={`space-y-3 rounded-2xl border-2 p-3 text-left transition hover:shadow-[0_6px_20px_rgba(16,185,129,0.15)] ${
                            puesto.esPropio
                              ? "border-[var(--accent)] bg-[rgba(207,145,48,0.06)]"
                              : "border-emerald-200 bg-white/70"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-sm">
                              🌿
                            </span>
                            <span className="truncate text-sm font-bold tracking-tight text-emerald-900">
                              {puesto.nombre}
                              {puesto.esPropio && (
                                <span className="ml-1 text-xs font-semibold text-[var(--accent-strong)]">
                                  (vos)
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            {puesto.pitchSignedUrl && (
                              <div className="relative aspect-[9/16] w-[92px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#f9d976] via-[#c98b1b] to-[#8a5b0f] p-[2px]">
                                <div className="relative h-full w-full overflow-hidden rounded-[0.6rem] bg-black">
                                  {puesto.pitchMimeType?.startsWith("image/") ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={puesto.pitchSignedUrl}
                                      alt={`Pitch de ${puesto.nombre}`}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <VideoEmbed
                                      src={puesto.pitchSignedUrl}
                                      title={`Pitch de ${puesto.nombre}`}
                                      className="h-full w-full object-cover"
                                    />
                                  )}
                                  <span className="pointer-events-none absolute bottom-1 left-1 text-[10px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">
                                    ✦
                                  </span>
                                </div>
                              </div>
                            )}

                            {puesto.producciones.length > 0 && (
                              <div className="grid flex-1 grid-cols-2 gap-1.5">
                                {puesto.producciones.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-emerald-100 bg-emerald-50/60 p-1 text-center"
                                    title={item.titulo || undefined}
                                  >
                                    {item.tipo === "imagen" && item.signedUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={item.signedUrl}
                                        alt={item.titulo || "Producción"}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : item.tipo === "audio" ? (
                                      <span className="text-lg" aria-hidden>
                                        🎵
                                      </span>
                                    ) : item.tipo === "video" ? (
                                      <span className="text-lg" aria-hidden>
                                        🎬
                                      </span>
                                    ) : item.tipo === "link" ? (
                                      <span className="text-lg" aria-hidden>
                                        🔗
                                      </span>
                                    ) : (
                                      <p className="line-clamp-4 text-[10px] leading-tight text-gray-700">
                                        {item.contenido || item.titulo}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>

                    {puestoAmpliadoEmail && (() => {
                      const puesto = puestosCofruto.find((p) => p.email === puestoAmpliadoEmail)
                      if (!puesto) return null
                      return (
                        <div
                          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(24,32,42,0.55)] p-4"
                          onClick={() => setPuestoAmpliadoEmail(null)}
                        >
                          <div
                            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[1.8rem] border border-emerald-200 bg-white p-6 shadow-[0_20px_60px_rgba(16,60,40,0.25)]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-base">
                                  🌿
                                </span>
                                <h3 className="text-lg font-bold tracking-tight text-emerald-900">
                                  {puesto.nombre}
                                  {puesto.esPropio && (
                                    <span className="ml-1 text-sm font-semibold text-[var(--accent-strong)]">
                                      (vos)
                                    </span>
                                  )}
                                </h3>
                              </div>
                              <button
                                type="button"
                                onClick={() => setPuestoAmpliadoEmail(null)}
                                className="rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
                              >
                                Cerrar
                              </button>
                            </div>

                            <div className="flex flex-col gap-6 sm:flex-row">
                              {puesto.pitchSignedUrl && (
                                <div className="relative aspect-[9/16] w-full max-w-[260px] shrink-0 self-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#f9d976] via-[#c98b1b] to-[#8a5b0f] p-[3px] sm:self-start sm:mx-0 mx-auto">
                                  <div className="relative h-full w-full overflow-hidden rounded-[1rem] bg-black">
                                    {puesto.pitchMimeType?.startsWith("image/") ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={puesto.pitchSignedUrl}
                                        alt={`Pitch de ${puesto.nombre}`}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <VideoEmbed
                                        src={puesto.pitchSignedUrl}
                                        title={`Pitch de ${puesto.nombre}`}
                                        className="h-full w-full object-cover"
                                      />
                                    )}
                                    <span className="pointer-events-none absolute bottom-2 left-2 text-sm text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">
                                      ✦ Pitch
                                    </span>
                                  </div>
                                </div>
                              )}

                              {puesto.producciones.length > 0 && (
                                <div className="grid flex-1 content-start grid-cols-2 gap-3 self-start">
                                  {puesto.producciones.map((item) => (
                                    <div
                                      key={item.id}
                                      className={`flex flex-col items-center justify-center overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/60 p-2 text-center ${
                                        item.tipo === "imagen" ? "aspect-square" : "min-h-[140px]"
                                      }`}
                                    >
                                      {item.tipo === "imagen" && item.signedUrl ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setImagenAmpliada({
                                              url: item.signedUrl!,
                                              titulo: item.titulo || "Producción",
                                            })
                                          }}
                                          className="group relative h-full w-full cursor-zoom-in"
                                        >
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={item.signedUrl}
                                            alt={item.titulo || "Producción"}
                                            className="h-full w-full rounded-lg object-cover"
                                          />
                                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 text-transparent transition group-hover:bg-black/30 group-hover:text-white">
                                            🔍 Ampliar
                                          </span>
                                        </button>
                                      ) : item.tipo === "audio" && item.signedUrl ? (
                                        <div className="flex w-full flex-col items-center gap-2 p-2">
                                          <span className="text-2xl" aria-hidden>
                                            🎵
                                          </span>
                                          {item.titulo && (
                                            <p className="text-xs font-semibold text-gray-700">
                                              {item.titulo}
                                            </p>
                                          )}
                                          <audio controls src={item.signedUrl} className="w-full" />
                                        </div>
                                      ) : item.tipo === "video" && item.signedUrl ? (
                                        <div className="flex w-full flex-col items-center gap-2 p-2">
                                          {item.titulo && (
                                            <p className="text-xs font-semibold text-gray-700">
                                              {item.titulo}
                                            </p>
                                          )}
                                          <video controls src={item.signedUrl} className="w-full rounded-lg" />
                                        </div>
                                      ) : item.tipo === "link" && item.contenido ? (
                                        <div className="flex w-full flex-col items-center gap-2 p-2">
                                          <span className="text-2xl" aria-hidden>
                                            🔗
                                          </span>
                                          {item.titulo && (
                                            <p className="text-xs font-semibold text-gray-700">
                                              {item.titulo}
                                            </p>
                                          )}
                                          <a
                                            href={item.contenido}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="break-all text-xs text-[var(--accent-strong)] underline"
                                          >
                                            {item.contenido}
                                          </a>
                                        </div>
                                      ) : (
                                        <div className="p-2">
                                          {item.titulo && (
                                            <p className="mb-1 text-xs font-semibold text-gray-700">
                                              {item.titulo}
                                            </p>
                                          )}
                                          <p className="text-sm leading-snug text-gray-700">
                                            {item.contenido}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {!puesto.pitchSignedUrl && puesto.producciones.length === 0 && (
                                <p className="workspace-inline-note">
                                  Todavía no mostró nada en la mesa.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {imagenAmpliada && (
                      <div
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
                        onClick={() => setImagenAmpliada(null)}
                      >
                        <button
                          type="button"
                          onClick={() => setImagenAmpliada(null)}
                          className="absolute right-4 top-4 rounded-full border border-white/40 px-3 py-1 text-sm text-white hover:bg-white/10"
                        >
                          Cerrar
                        </button>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imagenAmpliada.url}
                          alt={imagenAmpliada.titulo}
                          className="max-h-[85vh] max-w-full rounded-lg object-contain"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}

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
                      Todavía no hay recursos cargados para Entusiasmento.
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
