"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import PagoMensualCard from "@/components/pagos/PagoMensualCard"
import BibliotecaGrabaciones from "@/components/BibliotecaGrabaciones"
import SeccionDesplegable from "@/components/SeccionDesplegable"
import AgendaActividad from "@/components/agenda/AgendaActividad"
import GrabadorVideo from "@/components/casatalentos/GrabadorVideo"
import HDRActividad from "@/components/hdr/HDRActividad"
import { useActivityAccess } from "@/components/auth/useActivityAccess"
import CasaTalentosAdminPanel, {
  CasaTalentosAdminResumenBlock,
} from "@/components/casatalentos/CasaTalentosAdminPanel"
import EditorMensajeAdmin from "@/components/espacios/EditorMensajeAdmin"
import type { EditorMensajeAdminHandle } from "@/components/espacios/EditorMensajeAdmin"
import { isDevelopmentPreviewEnabled } from "@/lib/dev-flags"
import { obtenerPartesArgentina } from "@/lib/fechas"
import { supabase } from "@/lib/supabase"
import WorkspaceHero from "@/components/ui/WorkspaceHero"

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

const MODO_PRUEBA = isDevelopmentPreviewEnabled()
const STORAGE_MENSAJES_LEIDOS_CASATALENTOS = "casatalentos_mensajes_leidos"
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
  const [subsolapaDispositivo, setSubsolapaDispositivo] = useState<
    "referentes" | "videos" | "evaluacion"
  >("referentes")
  const [numeroDia, setNumeroDia] = useState<number>(0)
  const [ahoraArgentina, setAhoraArgentina] = useState(() =>
    obtenerAhoraArgentinaCliente()
  )

  const [mensajeExito, setMensajeExito] = useState("")
  const [mensajeError, setMensajeError] = useState("")
  const [subiendoVideo, setSubiendoVideo] = useState(false)
  const [estadoSubidaVideo, setEstadoSubidaVideo] = useState("")
  const [eligiendo, setEligiendo] = useState(false)

  const [comentariosDraft, setComentariosDraft] = useState<Record<number, string>>({})
  const [comentandoVideoId, setComentandoVideoId] = useState<number | null>(null)
  const [mensajeGeneralDraft, setMensajeGeneralDraft] = useState("")
  const [mensajeGeneralDraftHtml, setMensajeGeneralDraftHtml] = useState("")
  const [asuntoMensajeGeneralDraft, setAsuntoMensajeGeneralDraft] = useState("")
  const [respuestasDraft, setRespuestasDraft] = useState<Record<number, string>>({})
  const [respuestasDraftHtml, setRespuestasDraftHtml] = useState<Record<number, string>>({})
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
  const esAdmin = session?.user?.role === "admin"

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

    const lista = Array.from(mapa.values()).map((item) => {
      const participoEligiendo = participantesQueEligieron.has(item.clave)
      const elegible = item.subioLunes && item.subioMiercoles && participoEligiendo

      return {
        ...item,
        participoEligiendo,
        elegible,
      }
    })

    lista.sort((a, b) => {
      if (a.elegible !== b.elegible) return a.elegible ? -1 : 1
      if (b.totalVotos !== a.totalVotos) return b.totalVotos - a.totalVotos
      return a.nombre.localeCompare(b.nombre)
    })

    return lista
  }, [videosSemana, votosSemana, votosPorVideo])

  const top3 = useMemo(() => rankingParticipantes.slice(0, 3), [rankingParticipantes])

  const ganadorSemana = useMemo(() => {
    const elegibles = rankingParticipantes.filter((p) => p.elegible)
    if (elegibles.length === 0) return null

    const maxVotos = elegibles[0].totalVotos
    const empatados = elegibles.filter((p) => p.totalVotos === maxVotos)

    if (empatados.length > 1) {
      return { empate: true as const, votos: maxVotos, participantes: empatados }
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
        const aportesRecibidos = comentariosSemana.filter((comentario) =>
          idsVideosParticipante.has(comentario.video_id)
        ).length
        const aportesRealizados = comentariosSemana.filter(
          (comentario) => claveVotante({
            votante_email: comentario.autor_email || null,
            votante_nombre: comentario.autor_nombre,
          }) === participante.clave
        ).length

        return {
          ...participante,
          videoRepresentativo,
          aportesRecibidos,
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
            votos: top3[0].totalVotos,
          }
        : null

    return {
      videos: videos.length,
      votos: votos.length,
      comentarios: comentarios.length,
      anfitrion,
    }
  }, [comentarios.length, top3, videos.length, votos.length])

  const handleArchivo = (file: File | null) => {
    setMensajeExito("")
    setMensajeError("")

    if (!file) {
      setArchivo(null)
      return
    }

    if (!file.type.startsWith("video/")) {
      setMensajeError("El archivo debe ser un video.")
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setMensajeError("El video es muy pesado. Máximo 50MB para este MVP.")
      return
    }

    setArchivo(file)
    setMensajeExito(`Video listo para subir: ${file.name}`)
  }

  const handleCargarVideo = async () => {
    setMensajeExito("")
    setMensajeError("")
    setEstadoSubidaVideo("")

    if (!archivo) {
      setMensajeError("Primero graba o elige un video.")
      return
    }

    try {
      setSubiendoVideo(true)
      setEstadoSubidaVideo("Preparando subida...")

      const participanteNombre = nombreParticipante || nombre || "Participante"
      const tituloVideo = titulo || `Video ${nombreDiaActual}`

      const prepararRes = await fetch("/api/casatalentos/preparar-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participanteNombre,
          titulo: tituloVideo,
          fileName: archivo.name,
          mimeType: archivo.type,
          fileSize: archivo.size,
        }),
      })

      const preparacion = await leerRespuestaJson<PrepararUploadResponse>(prepararRes)

      if (!prepararRes.ok) {
        setMensajeError(preparacion.error || "No se pudo preparar la subida del video.")
        return
      }

      if (
        !preparacion.bucket ||
        !preparacion.storagePath ||
        !preparacion.signedToken
      ) {
        setMensajeError("La preparación de subida vino incompleta.")
        return
      }

      if (preparacion.maxBytes && archivo.size > preparacion.maxBytes) {
        setMensajeError("El video es muy pesado. Máximo 50MB.")
        return
      }

      setEstadoSubidaVideo("Subiendo video...")

      const { error: uploadError } = await supabase.storage
        .from(preparacion.bucket)
        .uploadToSignedUrl(
          preparacion.storagePath,
          preparacion.signedToken,
          archivo,
          {
            contentType: archivo.type,
            upsert: false,
          }
        )

      if (uploadError) {
        setMensajeError(
          uploadError.message ||
            "No se pudo subir el video al storage. Probá nuevamente con buena conexión."
        )
        return
      }

      setEstadoSubidaVideo("Confirmando video...")

      const confirmarRes = await fetch("/api/casatalentos/confirmar-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participanteNombre,
          titulo: tituloVideo,
          storagePath: preparacion.storagePath,
          mimeType: archivo.type,
          fileSize: archivo.size,
          diaClave: preparacion.diaClave,
          fechaSemana: preparacion.fechaSemana,
        }),
      })

      const data = await leerRespuestaJson<{
        video?: VideoItem
        error?: string
      }>(confirmarRes)

      if (!confirmarRes.ok) {
        setMensajeError(data.error || "No se pudo confirmar el video.")
        return
      }

      setArchivo(null)
      setTitulo("")
      setNombreParticipante("")

      setMensajeExito("Video subido correctamente.")
      await cargarDatosCasaTalentos()
    } catch (error) {
      setMensajeError("Hubo un problema al cargar el video.")
      console.error(error)
    } finally {
      setEstadoSubidaVideo("")
      setSubiendoVideo(false)
    }
  }

  const handleElegir = async () => {
    setMensajeExito("")
    setMensajeError("")

    if (elegidoSeleccionado === null) {
      setMensajeError("Seleccioná un proceso para evaluar.")
      return
    }

    if (bloquearNuevaEvaluacion) {
      setMensajeError("Ya realizaste tu evaluación esta semana.")
      return
    }

    const videoElegido = videosSemana.find((v) => v.id === elegidoSeleccionado)
    if (!videoElegido) {
      setMensajeError("El proceso seleccionado no pertenece a la semana activa.")
      return
    }

    try {
      setEligiendo(true)
      setMensajeExito("Guardando evaluación...")

      const res = await fetch("/api/casatalentos/votar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId: elegidoSeleccionado,
          votanteNombre: nombre,
          votanteEmail: email || null,
        }),
      })

      const data = await leerRespuestaJson<{
        error?: string
      }>(res)

      if (!res.ok) {
        setMensajeExito("")
        setMensajeError(data.error || "No se pudo guardar la evaluación.")
        return
      }

      setMensajeExito("Evaluación guardada correctamente.")
      await cargarDatosCasaTalentos()
    } catch (error) {
      console.error("Error al elegir:", error)
      setMensajeExito("")
      setMensajeError("Hubo un problema al guardar la evaluación.")
    } finally {
      setEligiendo(false)
    }
  }

  const handleComentar = async (videoId: number) => {
    const contenido = (comentariosDraft[videoId] || "").trim()

    setMensajeExito("")
    setMensajeError("")

    if (!contenido) {
      setMensajeError("Escribe un aporte antes de enviarlo.")
      return
    }

    try {
      setComentandoVideoId(videoId)

      const res = await fetch("/api/casatalentos/comentar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId,
          autorNombre: nombre,
          autorEmail: email || null,
          contenido,
        }),
      })

      const raw = await res.text()
      let data: { error?: string } = {}

      try {
        data = raw ? JSON.parse(raw) : {}
      } catch {
        data = {
          error: `Respuesta no válida del servidor: ${raw || "vacía"}`,
        }
      }

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo guardar el aporte.")
        return
      }

      setComentariosDraft((prev) => ({
        ...prev,
        [videoId]: "",
      }))

      setMensajeExito("Aporte guardado correctamente.")
      await cargarDatosCasaTalentos()
    } catch (error) {
      console.error("Error comentando:", error)
      setMensajeError("Hubo un problema al guardar el aporte.")
    } finally {
      setComentandoVideoId(null)
    }
  }

  const handleLimpiarVideos = async () => {
    setMensajeExito("")
    setMensajeError("")

    try {
      const res = await fetch("/api/casatalentos/limpiar", {
        method: "POST",
      })

      const data = await leerRespuestaJson<{
        error?: string
      }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudieron limpiar los datos.")
        return
      }

      setVideoAbierto(null)
      setElegidoSeleccionado(null)
      setArchivo(null)
      setMensajeExito("Se limpiaron los videos, elecciones y aportes.")
      await cargarDatosCasaTalentos()
    } catch {
      setMensajeError("Error limpiando datos.")
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
          eyebrow="Coworking creativo"
          title="CasaTalentos"
          subtitle="Preparando tu acceso al espacio de producción compartida."
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
          eyebrow="Coworking creativo"
          title="CasaTalentos"
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
          eyebrow={esAdmin ? "Coordinación creativa" : "CoWorking"}
          title={esAdmin ? "Admin CasaTalentos" : "CasaTalentos"}
          subtitle={
            esAdmin
              ? "Administrá referentes, reuniones, grabaciones y el dispositivo semanal desde un mismo lugar."
              : "Espacio para habitar tus creaciones"
          }
          logoSrc="/casatalentos-logo.png"
          logoAlt="Logo CasaTalentos"
          logoClassName="!h-44 !w-44"
          logoBlendClassName="mix-blend-multiply"
        >
          <div className="flex flex-wrap gap-3">
            <span className="workspace-chip">Talento</span>
            <span className="workspace-chip">Palabra</span>
            <span className="workspace-chip">Producción</span>
            <span className="workspace-chip">Propósito</span>
          </div>
        </WorkspaceHero>

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
          {esAdmin && (
            <section className="space-y-3">
              <div className="workspace-panel-soft space-y-2">
                <p className="workspace-eyebrow">Administracion de CasaTalentos</p>
                <h2 className="text-xl font-semibold tracking-[-0.02em]">
                  Coordinacion del espacio
                </h2>
                <p className="workspace-inline-note text-[var(--foreground)]">
                  Aqui administras referentes, grabaciones y el seguimiento general
                  del espacio sin salir de CasaTalentos.
                </p>
              </div>

              <CasaTalentosAdminPanel onActualizado={cargarDatosCasaTalentos} />
            </section>
          )}

          {(esAdmin || tieneRecurso("reunion_semanal_casatalentos")) && (
            <SeccionDesplegable titulo="Reunión semanal">
              <AgendaActividad
                actividadSlug="casatalentos"
                tituloSeccion="Próximo encuentro de CasaTalentos"
                mostrarSoloProximo
              />
            </SeccionDesplegable>
          )}

          {(esAdmin || tieneRecurso("dispositivo_videos_casatalentos")) && (
            <SeccionDesplegable titulo="Dispositivo CasaTalentos">
              <div className="space-y-6">
                {esAdmin && <CasaTalentosAdminResumenBlock resumen={resumenAdmin} />}

                <div className="workspace-panel-soft space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">Semana activa</h3>
                    <p className="workspace-inline-note">
                      Semana del {formatearFecha(semanaEnUso)}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-xl border border-[var(--line)] bg-[rgba(255,251,244,0.92)] p-3">
                      <p className="workspace-eyebrow !text-[0.62rem]">
                        Hoy
                      </p>
                      <p className="mt-1 font-medium">{nombreDiaActual}</p>
                    </div>
                    <div className="rounded-xl border border-[var(--line)] bg-[rgba(255,251,244,0.92)] p-3">
                      <p className="workspace-eyebrow !text-[0.62rem]">
                        Videos
                      </p>
                      <p className="mt-1 font-medium">{resumenSemana.videos}</p>
                    </div>
                    <div className="rounded-xl border border-[var(--line)] bg-[rgba(255,251,244,0.92)] p-3">
                      <p className="workspace-eyebrow !text-[0.62rem]">
                        Participantes
                      </p>
                      <p className="mt-1 font-medium">{resumenSemana.participantes}</p>
                    </div>
                    <div className="rounded-xl border border-[var(--line)] bg-[rgba(255,251,244,0.92)] p-3">
                      <p className="workspace-eyebrow !text-[0.62rem]">
                        Aportes
                      </p>
                      <p className="mt-1 font-medium">{resumenSemana.comentarios}</p>
                    </div>
                  </div>
                </div>

                {esAdmin && participantesSinVideoLunes.length > 0 && (
                  <div className="workspace-panel-soft space-y-3 border border-[#E8B4B4] bg-[#FFF6F6]">
                    <h3 className="text-lg font-semibold text-[#8A2D2D]">
                      Seguimiento del lunes
                    </h3>
                    <div className="space-y-2 text-sm text-[#7A1F1F]">
                      {participantesSinVideoLunes.map((participante) => (
                        <p key={participante.email}>
                          {participante.nombre} no envió su video del lunes.
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="workspace-panel-soft space-y-3">
                  <div className="flex flex-wrap gap-2" role="tablist" aria-label="Dispositivo CasaTalentos">
                    {[
                      { id: "referentes", label: "Referentes" },
                      { id: "videos", label: "Videos de la semana" },
                      { id: "evaluacion", label: "Evaluación" },
                    ].map((tab) => {
                      const activo = subsolapaDispositivo === tab.id

                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={activo}
                          onClick={() =>
                            setSubsolapaDispositivo(
                              tab.id as "referentes" | "videos" | "evaluacion"
                            )
                          }
                          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                            activo
                              ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                              : "border-[var(--line)] bg-white/70 text-[var(--foreground)] hover:border-[var(--accent)]"
                          }`}
                        >
                          {tab.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {subsolapaDispositivo === "referentes" && (
                  <div className="space-y-4">
                    <div className="workspace-panel-soft space-y-3">
                      <h3 className="text-lg font-semibold">Referente general</h3>
                      <div className="whitespace-pre-wrap text-[var(--muted)]">
                        {textoReferentesGenerales}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Referente de la semana</h3>

                      {!semanaEnUso && (
                        <p className="text-gray-600">Todavía no hay semana seleccionada.</p>
                      )}

                      {semanaEnUso && !referenteSemanalActual && (
                        <p className="text-gray-600">
                          No hay referente semanal cargado para la semana del {formatearFecha(semanaEnUso)}.
                        </p>
                      )}

                      {referenteSemanalActual && (
                        <div className="workspace-panel-soft space-y-3">
                          <p className="font-medium">{referenteSemanalActual.titulo}</p>

                          {referenteSemanalActual.descripcion && (
                            <p className="whitespace-pre-wrap text-[var(--muted)]">
                              {referenteSemanalActual.descripcion}
                            </p>
                          )}

                          {referenteSemanalActual.video_url && (
                            <video
                              controls
                              src={referenteSemanalActual.video_url}
                              className="w-full rounded-xl border"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {esAdmin && (
                  <div className="workspace-panel-soft space-y-3 border border-[var(--line)] bg-[rgba(255,250,242,0.9)]">
                    <p className="workspace-eyebrow">Participar / Evaluar dispositivo semanal</p>
                    <h3 className="text-lg font-semibold">
                      Tu participacion como admin tambien cuenta
                    </h3>
                    <p className="workspace-inline-note text-[var(--foreground)]">
                      Desde esta misma seccion podes subir tu video cuando
                      corresponda, dejar aportes escritos, realizar la
                      elección/evaluación semanal y seguir el ranking, el top 3 y
                      el ganador sin salir del flujo del dispositivo.
                    </p>
                  </div>
                )}

                {subsolapaDispositivo === "videos" && (
                  <div className="space-y-6">
                    {mostrarBloqueSubida && (
                      <div className="workspace-divider pt-4 space-y-4">
                        <h3 className="text-lg font-semibold">Subir tu video</h3>
                        <p className="workspace-inline-note">
                          Podés grabarlo ahora desde la cámara o elegir un archivo ya guardado. El
                          martes el trabajo pasa por los aportes escritos a los videos del lunes.
                        </p>

                        <input
                          placeholder="Tu nombre"
                          className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.92)] p-3"
                          value={nombreParticipante}
                          onChange={(e) => setNombreParticipante(e.target.value)}
                        />

                        <input
                          placeholder="Título del video"
                          className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.92)] p-3"
                          value={titulo}
                          onChange={(e) => setTitulo(e.target.value)}
                        />

                        <GrabadorVideo
                          onVideoListo={handleArchivo}
                          disabled={subiendoVideo}
                          maxSegundos={65}
                        />

                        {!archivo && (
                          <p className="workspace-inline-note">
                            Cuando el video esté listo, podrás subirlo desde aquí.
                          </p>
                        )}

                        {archivo && (
                          <p className="text-green-700 text-sm">
                            Video listo para subir: <strong>{archivo.name}</strong>
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={handleCargarVideo}
                          disabled={subiendoVideo}
                          className="workspace-button-primary disabled:opacity-60"
                        >
                          {subiendoVideo ? "Subiendo..." : "Subir video"}
                        </button>

                        {estadoSubidaVideo && (
                          <p className="text-sm text-[var(--muted)]">
                            {estadoSubidaVideo}
                          </p>
                        )}

                        {mensajeExito && (
                          <p className="text-green-700 text-sm font-medium">{mensajeExito}</p>
                        )}

                        {mensajeError && (
                          <p className="text-red-700 text-sm font-medium">{mensajeError}</p>
                        )}
                      </div>
                    )}

                    {semanaEnUso === semanaActual && esMartesAportes && (
                      <div className="workspace-panel-soft space-y-3 border border-[#D6C39A] bg-[#FFF6E4]/70">
                        <h3 className="text-lg font-semibold text-[#6D4F17]">
                          Martes de aportes
                        </h3>
                        <p className="workspace-inline-note text-[var(--foreground)]">
                          Hoy no se sube video. El martes está dedicado a escribir aportes sobre los
                          videos del lunes para acompañar la evolución del proceso.
                        </p>
                      </div>
                    )}

                    {semanaEnUso === semanaActual &&
                      Boolean(diaActualClave) &&
                      yaSubioVideoHoy && (
                        <div className="border-t pt-4">
                          <p className="text-sm font-medium text-green-700">
                            Ya cargaste el video de hoy. Podras volver a subir cuando llegue el proximo dia del dispositivo.
                          </p>
                        </div>
                      )}

                    <div className="workspace-divider pt-4 space-y-4">
                      <h3 className="text-lg font-semibold">Videos de la semana</h3>

                      {videosSemana.length === 0 && (
                        <p className="workspace-inline-note">
                          No hay videos cargados para la semana actual.
                        </p>
                      )}

                      {videosSemana.map((video) => {
                        const comentariosDeVideo = comentariosPorVideo.get(video.id) || []
                        const comentarioActual = comentariosDraft[video.id] || ""
                        const abierto = videoAbierto === video.video_url

                        return (
                          <div key={video.id} className="workspace-card-link !rounded-[1.45rem] !p-5 space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <p className="text-lg font-semibold tracking-[-0.02em]">
                                  {video.participante_nombre}
                                </p>
                                <span className="workspace-chip">
                                  {video.dia_clave || video.dia || "Día sin definir"}
                                </span>
                              </div>
                              <p className="workspace-inline-note text-[var(--foreground)]">
                                {video.titulo}
                              </p>
                              <p className="workspace-inline-note text-xs">
                                Día: {video.dia_clave || video.dia || "sin día"}
                              </p>
                              <p className="workspace-inline-note text-xs">
                                Semana: {formatearFecha(video.fecha_semana)}
                              </p>
                            </div>

                            {video.video_url && (
                              <div className="space-y-3">
                                {!abierto && (
                                  <div className="flex items-center gap-4 flex-wrap">
                                    <video
                                      src={video.video_url}
                                      className="h-28 w-28 rounded-[1.6rem] border border-[var(--line)] object-cover"
                                      muted
                                      playsInline
                                      preload="metadata"
                                    />

                                    <button
                                      type="button"
                                      className="workspace-button-secondary"
                                      onClick={() => setVideoAbierto(video.video_url || null)}
                                    >
                                      Ver video
                                    </button>
                                  </div>
                                )}

                                {abierto && (
                                  <div className="space-y-3">
                                    <video
                                      controls
                                      src={video.video_url}
                                      className="w-full max-w-xl rounded-xl border"
                                    />

                                    <button
                                      type="button"
                                      className="workspace-button-secondary"
                                      onClick={() => setVideoAbierto(null)}
                                    >
                                      Ocultar video
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="workspace-divider pt-4 space-y-3">
                              <h4 className="font-semibold">Aportes a este video</h4>

                              {comentariosDeVideo.length === 0 && (
                                <p className="workspace-inline-note">
                                  Todavía no hay aportes para este video.
                                </p>
                              )}

                              {comentariosDeVideo.map((comentario) => (
                                <div key={comentario.id} className="workspace-message-reply space-y-1">
                                  <p className="text-sm font-medium">{comentario.autor_nombre}</p>
                                  <p className="workspace-inline-note text-xs">
                                    {formatearFechaHora(comentario.created_at)}
                                  </p>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                    {comentario.contenido}
                                  </p>
                                </div>
                              ))}

                              <textarea
                                className="workspace-field min-h-[90px]"
                                placeholder="Escribí aquí tu aporte para este video..."
                                value={comentarioActual}
                                onChange={(e) =>
                                  setComentariosDraft((prev) => ({
                                    ...prev,
                                    [video.id]: e.target.value,
                                  }))
                                }
                              />

                              <button
                                type="button"
                                onClick={() => handleComentar(video.id)}
                                disabled={comentandoVideoId === video.id}
                                className="workspace-button-secondary disabled:opacity-60"
                              >
                                {comentandoVideoId === video.id
                                  ? "Guardando aporte..."
                                  : "Enviar aporte"}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                  </div>
                )}

                {subsolapaDispositivo === "evaluacion" && (
                  <div className="workspace-panel-soft space-y-4">
                    <h3 className="text-lg font-semibold">Evaluación</h3>

                    {yaParticipoEvaluacionSemana && (
                      <div className="rounded-2xl border border-[#D6C39A] bg-[#FFF6E4]/80 px-4 py-3 text-sm font-medium text-[#6D4F17]">
                        Gracias por elegir. Los resultados se develarán a las 17 horas.
                      </div>
                    )}

                    {nombreGanadorEntusiasmo && (
                      <div className="rounded-3xl border border-[#D6C39A] bg-[#FFF1C7]/90 px-5 py-4 shadow-sm">
                        <p className="text-lg font-semibold text-[#6D4F17]">
                          {ganadorSemana?.empate
                            ? `¡Felicitaciones ${nombreGanadorEntusiasmo}, se ganaron el Entusiasmo esta semana!`
                            : `¡Felicitaciones ${nombreGanadorEntusiasmo}, te ganaste el Entusiasmo esta semana!`}
                        </p>
                      </div>
                    )}

                    {mostrarEncuestaEvaluacion ? (
                      <div className="space-y-4">
                        {opcionesEvaluacionProceso.length === 0 && (
                          <p className="workspace-inline-note">
                            Todavía no hay procesos disponibles para evaluar esta semana.
                          </p>
                        )}

                        {opcionesEvaluacionProceso.map((participante) => {
                          const videoRepresentativo = participante.videoRepresentativo
                          if (!videoRepresentativo) return null

                          return (
                            <label
                              key={participante.clave}
                              className="block cursor-pointer rounded-2xl border border-[var(--line)] bg-white/70 p-4 transition hover:border-[var(--accent)]"
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="radio"
                                  name="proceso-elegido"
                                  className="mt-1"
                                  checked={elegidoSeleccionado === videoRepresentativo.id}
                                  onChange={() =>
                                    setElegidoSeleccionado(videoRepresentativo.id)
                                  }
                                />
                                <div className="space-y-2">
                                  <p className="font-semibold">{participante.nombre}</p>
                                  <div className="flex flex-wrap gap-2">
                                    <span className="workspace-chip">
                                      Video lunes: {participante.subioLunes ? "sí" : "no"}
                                    </span>
                                    <span className="workspace-chip">
                                      Video miércoles: {participante.subioMiercoles ? "sí" : "no"}
                                    </span>
                                  </div>
                                  <p className="workspace-inline-note text-xs">
                                    Aportes recibidos: {participante.aportesRecibidos}
                                  </p>
                                  <p className="workspace-inline-note text-xs">
                                    Aportes realizados: {participante.aportesRealizados}
                                  </p>
                                  {resultadosVotacionVisibles && (
                                    <p className="workspace-inline-note text-xs">
                                      Elecciones recibidas: {participante.totalVotos}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    ) : bloquearNuevaEvaluacion ? null : !mostrarControlesEvaluacion && !evaluacionCerrada ? (
                      <p className="workspace-inline-note">
                        La elección del proceso semanal se habilita el jueves.
                      </p>
                    ) : mostrarControlesEvaluacion ? (
                      <p className="workspace-inline-note">
                        La evaluación ya fue registrada esta semana.
                      </p>
                    ) : null}

                    <div className="flex gap-3 flex-wrap">
                      {mostrarEncuestaEvaluacion && (
                        <button
                          type="button"
                          onClick={handleElegir}
                          disabled={
                            eligiendo ||
                            elegidoSeleccionado === null ||
                            opcionesEvaluacionProceso.length === 0
                          }
                          className="workspace-button-primary disabled:opacity-60"
                        >
                          {eligiendo ? "Guardando evaluación..." : "Confirmar evaluación"}
                        </button>
                      )}

                      {MODO_PRUEBA && !esAdmin && (
                        <button
                          type="button"
                          onClick={handleLimpiarVideos}
                          className="workspace-button-secondary"
                        >
                          Limpiar prueba
                        </button>
                      )}
                    </div>

                    <div className="workspace-divider pt-4 space-y-4">
                      <h3 className="text-lg font-semibold">Ranking y resultado</h3>

                      {!resultadosVotacionVisibles && (
                        <div className="workspace-panel-soft space-y-2">
                          <p className="font-medium">Evaluación en curso</p>
                          <p className="workspace-inline-note">
                            Hasta el jueves a las 17:00 hs de Argentina no se muestran resultados
                            parciales ni ranking de la semana. El resultado se revela al cierre.
                          </p>
                        </div>
                      )}

                      {resultadosVotacionVisibles && top3.length === 0 && (
                        <p className="workspace-inline-note">
                          Aún no hay evaluación para la semana seleccionada.
                        </p>
                      )}

                      {resultadosVotacionVisibles && top3.length > 0 && (
                        <div className="space-y-4">
                          <div className="space-y-3">
                            {top3.map((item, index) => (
                              <div key={item.clave} className="workspace-card-link !rounded-[1.35rem] !p-4 space-y-1">
                                <p className="font-medium">
                                  {index + 1}. {item.nombre}
                                </p>
                                <p className="workspace-inline-note text-xs">
                                  Elecciones recibidas: {item.totalVotos}
                                </p>
                                <p className="workspace-inline-note text-xs">
                                  Subió lunes y miércoles:{" "}
                                  {item.subioLunes && item.subioMiercoles ? "sí" : "no"}
                                </p>
                                <p className="workspace-inline-note text-xs">
                                  Participó en la elección: {item.participoEligiendo ? "sí" : "no"}
                                </p>
                                <p className="workspace-inline-note text-xs">
                                  Elegible para ganar: {item.elegible ? "sí" : "no"}
                                </p>
                                <div className="mt-3 rounded-2xl border border-[var(--line)] bg-white/60 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                    Quiénes eligieron este proceso
                                  </p>
                                  {(eleccionesPorParticipante.get(item.clave) || []).length > 0 ? (
                                    <div className="mt-2 space-y-1">
                                      {(eleccionesPorParticipante.get(item.clave) || []).map((eleccion) => (
                                        <p key={eleccion.id} className="workspace-inline-note text-xs">
                                          {eleccion.nombre}
                                        </p>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-2 workspace-inline-note text-xs">
                                      Todavía no recibió elecciones.
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="workspace-divider pt-4 space-y-3">
                            <h4 className="text-base font-semibold">Ganador de la semana</h4>

                            {!ganadorSemana && (
                              <p className="workspace-inline-note">
                                No hay ganador definido esta semana. Para ganar hay que subir los
                                videos del lunes y miércoles, y además participar de la
                                elección/evaluación del jueves.
                              </p>
                            )}

                            {ganadorSemana && ganadorSemana.empate && (
                              <div className="space-y-3">
                                <p className="font-medium">
                                  {ganadorSemana.participantes.map((participante) => participante.nombre).join(" y ")}
                                </p>
                                <p className="workspace-inline-note text-xs">
                                  Empate entre procesos elegibles.
                                </p>
                                {ganadorSemana.participantes.map((participante) => (
                                  <div key={participante.clave} className="rounded-2xl border border-[#D6C39A] bg-[#FFF6E4]/75 p-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6D4F17]">
                                      Eligieron a {participante.nombre}
                                    </p>
                                    <div className="mt-2 space-y-1">
                                      {(eleccionesPorParticipante.get(participante.clave) || []).map((eleccion) => (
                                        <p key={eleccion.id} className="workspace-inline-note text-xs">
                                          {eleccion.nombre}
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {ganadorSemana && !ganadorSemana.empate && (
                              <div className="space-y-3">
                                <p className="font-medium">{ganadorSemana.participante.nombre}</p>
                                <p className="workspace-inline-note text-xs">
                                  Elecciones recibidas: {ganadorSemana.participante.totalVotos}
                                </p>
                                <p className="workspace-inline-note text-xs">
                                  Cumplió con subir lunes y miércoles y además participó de la
                                  elección/evaluación del jueves.
                                </p>
                                <div className="rounded-2xl border border-[#D6C39A] bg-[#FFF6E4]/75 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6D4F17]">
                                    Eligieron este proceso
                                  </p>
                                  <div className="mt-2 space-y-1">
                                    {(eleccionesPorParticipante.get(ganadorSemana.participante.clave) || []).map((eleccion) => (
                                      <p key={eleccion.id} className="workspace-inline-note text-xs">
                                        {eleccion.nombre}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {resultadosVotacionVisibles && votosSemana.length > 0 && (
                      <div className="workspace-divider pt-4 space-y-3">
                        <h3 className="text-lg font-semibold">Detalle de elecciones</h3>
                        <div className="space-y-3">
                          {rankingParticipantes
                            .filter((participante) =>
                              (eleccionesPorParticipante.get(participante.clave) || []).length > 0
                            )
                            .map((participante) => (
                              <div key={participante.clave} className="workspace-panel-soft space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-semibold">{participante.nombre}</p>
                                  <span className="workspace-chip">
                                    {participante.totalVotos} elecciones recibidas
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  {(eleccionesPorParticipante.get(participante.clave) || []).map((eleccion) => (
                                    <p key={eleccion.id} className="workspace-inline-note text-xs">
                                      {eleccion.nombre}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SeccionDesplegable>
          )}

          <SeccionDesplegable titulo="Hoja de Ruta">
            <HDRActividad
              actividadSlug="casatalentos"
              actorEmail={email}
            />
          </SeccionDesplegable>

          <SeccionDesplegable titulo={tituloMensajes}>
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

              <div className="workspace-panel-soft space-y-3">
                <div className="space-y-1">
                  <p className="workspace-eyebrow">Nuevo hilo</p>
                  <h3 className="text-lg font-semibold">Nuevo mensaje</h3>
                </div>
                <input
                  className="workspace-field"
                  placeholder="Asunto del mensaje"
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
                    placeholder="Escribí aquí comentarios sobre las reuniones, valoraciones, agradecimientos o algo que quieras compartir..."
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
                    : "Enviar mensaje"}
                </button>
              </div>

              {mensajesRaiz.length === 0 && (
                <p className="text-gray-600">
                  Todavía no hay mensajes generales en CasaTalentos.
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
          </SeccionDesplegable>

          {tieneRecurso("biblioteca_grabaciones_casatalentos") && !esAdmin && (
            <SeccionDesplegable titulo="Biblioteca de grabaciones">
              <BibliotecaGrabaciones
                actividadSlug="casatalentos"
                previewEnabled={MODO_PRUEBA}
              />
            </SeccionDesplegable>
          )}
          </div>
        )}
      </main>
  )
}
