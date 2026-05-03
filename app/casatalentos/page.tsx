"use client"

import { useEffect, useMemo, useState } from "react"
import PagoMensualCard from "@/components/pagos/PagoMensualCard"
import BibliotecaGrabaciones from "@/components/BibliotecaGrabaciones"
import SeccionDesplegable from "@/components/SeccionDesplegable"
import AgendaActividad from "@/components/agenda/AgendaActividad"
import GrabadorVideo from "@/components/casatalentos/GrabadorVideo"
import { useActivityAccess } from "@/components/auth/useActivityAccess"
import CasaTalentosAdminPanel, {
  CasaTalentosAdminResumenBlock,
} from "@/components/casatalentos/CasaTalentosAdminPanel"
import { isDevelopmentPreviewEnabled } from "@/lib/dev-flags"
import { obtenerPartesArgentina } from "@/lib/fechas"
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
  created_at?: string
  updated_at?: string
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

function ordenDia(dia?: string | null) {
  switch (normalizarClaveDia(dia)) {
    case "lunes":
      return 1
    case "martes":
      return 2
    case "miercoles":
      return 3
    default:
      return 99
  }
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

  const [archivo, setArchivo] = useState<File | null>(null)
  const [titulo, setTitulo] = useState("")
  const [nombreParticipante, setNombreParticipante] = useState("")
  const [videoAbierto, setVideoAbierto] = useState<string | null>(null)
  const [elegidoSeleccionado, setElegidoSeleccionado] = useState<number | null>(null)
  const [numeroDia, setNumeroDia] = useState<number>(0)
  const [ahoraArgentina, setAhoraArgentina] = useState(() =>
    obtenerAhoraArgentinaCliente()
  )

  const [mensajeExito, setMensajeExito] = useState("")
  const [mensajeError, setMensajeError] = useState("")
  const [semanaSeleccionada, setSemanaSeleccionada] = useState("")
  const [subiendoVideo, setSubiendoVideo] = useState(false)
  const [eligiendo, setEligiendo] = useState(false)

  const [comentariosDraft, setComentariosDraft] = useState<Record<number, string>>({})
  const [comentandoVideoId, setComentandoVideoId] = useState<number | null>(null)
  const [participanteHistorialSeleccionado, setParticipanteHistorialSeleccionado] =
    useState("todos")
  const [mensajeGeneralDraft, setMensajeGeneralDraft] = useState("")
  const [asuntoMensajeGeneralDraft, setAsuntoMensajeGeneralDraft] = useState("")
  const [respuestasDraft, setRespuestasDraft] = useState<Record<number, string>>({})
  const [respondiendoMensajeId, setRespondiendoMensajeId] = useState<number | null>(null)
  const [mensajeEditandoId, setMensajeEditandoId] = useState<number | null>(null)
  const [mensajeEditandoAsunto, setMensajeEditandoAsunto] = useState("")
  const [mensajeEditandoContenido, setMensajeEditandoContenido] = useState("")
  const [guardandoMensajeGeneral, setGuardandoMensajeGeneral] = useState(false)
  const [mensajesAbiertos, setMensajesAbiertos] = useState<Record<number, boolean>>({})
  const [mensajesLeidos, setMensajesLeidos] = useState<Record<number, string>>({})
  const esAdmin = session?.user?.role === "admin"

  useEffect(() => {
    setMounted(true)
    const actualizarTiempo = () => {
      const ahora = obtenerAhoraArgentinaCliente()
      setAhoraArgentina(ahora)
      setNumeroDia(ahora.numeroDia)
    }

    actualizarTiempo()
    const interval = window.setInterval(actualizarTiempo, 60000)

    return () => window.clearInterval(interval)
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

  const semanasDisponibles = useMemo(() => {
    const desdeVideos = videos
      .map((v) => normalizarFechaSemana(v.fecha_semana))
      .filter((v): v is string => Boolean(v))

    const desdeReferentes = referentesSemanales
      .map((r) => normalizarFechaSemana(r.fecha_semana))
      .filter((v): v is string => Boolean(v))

    const unicas = Array.from(
      new Set([semanaActual, ...desdeVideos, ...desdeReferentes].filter(Boolean))
    )
    return unicas.sort((a, b) => b.localeCompare(a))
  }, [referentesSemanales, semanaActual, videos])

  useEffect(() => {
    if (!semanaSeleccionada && semanasDisponibles.length > 0) {
      setSemanaSeleccionada(semanasDisponibles[0])
    }
  }, [semanasDisponibles, semanaSeleccionada])

  useEffect(() => {
    if (!esAdmin && semanaSeleccionada !== semanaActual) {
      setSemanaSeleccionada(semanaActual)
    }
  }, [esAdmin, semanaActual, semanaSeleccionada])

  const semanaEnUso = esAdmin ? semanaSeleccionada : semanaActual

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
      mapa.set(voto.video_id, (mapa.get(voto.video_id) || 0) + 1)
    }
    return mapa
  }, [votosSemana])

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
          videos: [],
      }

      if (video.dia_clave) {
        actual.dias.add(normalizarClaveDia(video.dia_clave))
      }

      actual.totalVotos += votosPorVideo.get(video.id) || 0
      actual.videos.push(video)
      mapa.set(clave, actual)
    }

    const participantesQueEligieron = new Set(votosSemana.map((v) => claveVotante(v)))

    const lista = Array.from(mapa.values()).map((item) => {
      const subioTres =
        item.dias.has("lunes") &&
        item.dias.has("martes") &&
        item.dias.has("miercoles")

      const participoEligiendo = participantesQueEligieron.has(item.clave)
      const elegible = subioTres && participoEligiendo

      return {
        ...item,
        subioTres,
        participoEligiendo,
        elegible,
      }
    })

    lista.sort((a, b) => {
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
      return { empate: true as const, votos: maxVotos }
    }

    return { empate: false as const, participante: empatados[0] }
  }, [rankingParticipantes])

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

    const esMiercolesArgentina = ahoraArgentina.weekday === "Wed"
    const minutosActuales = ahoraArgentina.hour * 60 + ahoraArgentina.minute
    const horarioRevelacion = 22 * 60

    if (!esMiercolesArgentina) {
      return ahoraArgentina.numeroDia === 0 || ahoraArgentina.numeroDia > 3
    }

    return minutosActuales >= horarioRevelacion
  }, [
    ahoraArgentina.hour,
    ahoraArgentina.minute,
    ahoraArgentina.numeroDia,
    ahoraArgentina.weekday,
    esAdmin,
    semanaActual,
    semanaEnUso,
  ])

  const diaActualClave = useMemo(() => {
    switch (numeroDia) {
      case 1:
        return "lunes"
      case 2:
        return "martes"
      case 3:
        return "miercoles"
      default:
        return ""
    }
  }, [numeroDia])

  const historialSemanal = useMemo(() => {
    return semanasDisponibles.map((semana) => {
      const videosDeSemana = videos.filter(
        (video) => normalizarFechaSemana(video.fecha_semana) === semana
      )
      const votosDeSemana = votos.filter(
        (voto) => normalizarFechaSemana(voto.fecha_semana) === semana
      )

      const votosPorVideoSemana = new Map<number, number>()
      for (const voto of votosDeSemana) {
        votosPorVideoSemana.set(voto.video_id, (votosPorVideoSemana.get(voto.video_id) || 0) + 1)
      }

      const mapaParticipantes = new Map<
        string,
        {
          clave: string
          nombre: string
          videos: VideoItem[]
          dias: Set<string>
          totalVotos: number
          participoEligiendo: boolean
        }
      >()

      for (const video of videosDeSemana) {
        const clave = claveParticipante(video)
        const actual =
          mapaParticipantes.get(clave) || {
            clave,
            nombre: video.participante_nombre,
            videos: [],
            dias: new Set<string>(),
            totalVotos: 0,
            participoEligiendo: false,
          }

        actual.videos.push(video)
        if (video.dia_clave || video.dia) {
          actual.dias.add(normalizarClaveDia(video.dia_clave || video.dia))
        }
        actual.totalVotos += votosPorVideoSemana.get(video.id) || 0
        mapaParticipantes.set(clave, actual)
      }

      const participantesQueEligieron = new Set(votosDeSemana.map((voto) => claveVotante(voto)))

      const participantes = Array.from(mapaParticipantes.values()).map((item) => {
        const subioTres =
          item.dias.has("lunes") &&
          item.dias.has("martes") &&
          item.dias.has("miercoles")

        const participoEligiendo = participantesQueEligieron.has(item.clave)
        const elegible = subioTres && participoEligiendo

        return {
          nombre: item.nombre,
          videos: [...item.videos].sort(
            (a, b) => ordenDia(a.dia_clave || a.dia) - ordenDia(b.dia_clave || b.dia)
          ),
          totalVotos: item.totalVotos,
          elegible,
        }
      })

      participantes.sort((a, b) => {
        if (b.totalVotos !== a.totalVotos) return b.totalVotos - a.totalVotos
        return a.nombre.localeCompare(b.nombre)
      })

      const elegibles = participantes.filter((participante) => participante.elegible)
      let ganadorTexto = "No hubo ganador definido"

      if (elegibles.length > 0) {
        const maxVotos = elegibles[0].totalVotos
        const empatados = elegibles.filter((participante) => participante.totalVotos === maxVotos)

        ganadorTexto =
          empatados.length > 1
            ? "Hubo empate entre participantes elegibles"
            : empatados[0]?.nombre || ganadorTexto
      }

      return {
        semana,
        participantes,
        ganadorTexto,
      }
    })
  }, [semanasDisponibles, videos, votos])

  const participantesHistorial = useMemo(() => {
    const mapa = new Map<string, string>()

    for (const semana of historialSemanal) {
      for (const participante of semana.participantes) {
        const clave = participante.nombre.trim().toLowerCase()
        if (clave && !mapa.has(clave)) {
          mapa.set(clave, participante.nombre)
        }
      }
    }

    return Array.from(mapa.entries())
      .map(([clave, nombreParticipante]) => ({
        clave,
        nombre: nombreParticipante,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [historialSemanal])

  const historialAdminFiltrado = useMemo(() => {
    if (participanteHistorialSeleccionado === "todos") {
      return historialSemanal
    }

    return historialSemanal
      .map((semana) => ({
        ...semana,
        participantes: semana.participantes.filter(
          (participante) =>
            participante.nombre.trim().toLowerCase() === participanteHistorialSeleccionado
        ),
      }))
      .filter((semana) => semana.participantes.length > 0)
  }, [historialSemanal, participanteHistorialSeleccionado])

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
    !esAdmin &&
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

    if (!archivo) {
      setMensajeError("Primero graba o elige un video.")
      return
    }

    try {
      setSubiendoVideo(true)

      const formData = new FormData()
      formData.append(
        "participanteNombre",
        nombreParticipante || nombre || "Participante"
      )
      formData.append("participanteEmail", email || "")
      formData.append("titulo", titulo || `Video ${nombreDiaActual}`)
      formData.append("archivo", archivo)

      const res = await fetch("/api/casatalentos/crear-video", {
        method: "POST",
        body: formData,
      })

      const data = await leerRespuestaJson<{
        video?: VideoItem
        error?: string
      }>(res)

      if (!res.ok) {
        setMensajeError(data.error || "No se pudo subir el video.")
        return
      }

      setArchivo(null)
      setTitulo("")
      setNombreParticipante("")

      if (data.video?.fecha_semana) {
        setSemanaSeleccionada(data.video.fecha_semana)
      }

      setMensajeExito("Video subido correctamente.")
      await cargarDatosCasaTalentos()
    } catch (error) {
      setMensajeError("Hubo un problema al cargar el video.")
      console.error(error)
    } finally {
      setSubiendoVideo(false)
    }
  }

  const handleElegir = async () => {
    setMensajeExito("")
    setMensajeError("")

    if (elegidoSeleccionado === null) {
      setMensajeError("Selecciona un video para elegir.")
      return
    }

    const videoElegido = videosSemana.find((v) => v.id === elegidoSeleccionado)
    if (!videoElegido) {
      setMensajeError("El video seleccionado no pertenece a la semana activa.")
      return
    }

    try {
      setEligiendo(true)
      setMensajeExito("Guardando elección...")

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
        setMensajeError(data.error || "No se pudo guardar la elección.")
        return
      }

      setMensajeExito("Elección guardada correctamente.")
      await cargarDatosCasaTalentos()
    } catch (error) {
      console.error("Error al elegir:", error)
      setMensajeExito("")
      setMensajeError("Hubo un problema al elegir.")
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
      setSemanaSeleccionada("")
      setArchivo(null)
      setMensajeExito("Se limpiaron los videos, elecciones y aportes.")
      await cargarDatosCasaTalentos()
    } catch {
      setMensajeError("Error limpiando datos.")
    }
  }

  const handleEnviarMensajeGeneral = async (parentId?: number) => {
    const contenido = parentId
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
      } else {
        setAsuntoMensajeGeneralDraft("")
        setMensajeGeneralDraft("")
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
    const contenido = mensajeEditandoContenido.trim()
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

  const textoReferentesGenerales =
    referentesGenerales?.contenido?.trim() ||
    `Para ser ganador/a de la semana:
+ Subir y participar con tus videos semanales de 1 min., uno por día: lunes, martes y miércoles
+ ¡Elegir el día miércoles entre las 18:30 y las 21:30 hs el video que consideres el más valioso!`

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
          <CasaTalentosAdminPanel
              onActualizado={cargarDatosCasaTalentos}
            />
          )}

          {tieneRecurso("reunion_semanal_casatalentos") && (
            <SeccionDesplegable titulo="Reunión semanal">
              <AgendaActividad
                actividadSlug="casatalentos"
                tituloSeccion="Próximo encuentro de CasaTalentos"
                mostrarSoloProximo
              />
            </SeccionDesplegable>
          )}

          {tieneRecurso("dispositivo_videos_casatalentos") && (
            <SeccionDesplegable titulo="Dispositivo CasaTalentos">
              <div className="space-y-6">
                {esAdmin && <CasaTalentosAdminResumenBlock resumen={resumenAdmin} />}

                <div className="workspace-panel-soft space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">Semana activa</h3>
                    <p className="workspace-inline-note">
                      {semanaSeleccionada
                        ? `Semana del ${formatearFecha(semanaEnUso)}`
                        : "Todavía no hay una semana seleccionada."}
                    </p>
                  </div>

                  {esAdmin && semanasDisponibles.length > 0 && (
                    <select
                      className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.92)] p-3"
                      value={semanaSeleccionada}
                      onChange={(e) => {
                        setSemanaSeleccionada(e.target.value)
                        setElegidoSeleccionado(null)
                        setVideoAbierto(null)
                      }}
                    >
                      {semanasDisponibles.map((semana) => (
                        <option key={semana} value={semana}>
                          Semana del {formatearFecha(semana)}
                        </option>
                      ))}
                    </select>
                  )}

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

                {!esAdmin && (
                  <div className="workspace-panel-soft space-y-3">
                    <h3 className="text-lg font-semibold">Referente general</h3>
                    <div className="whitespace-pre-wrap text-[var(--muted)]">
                      {textoReferentesGenerales}
                    </div>
                  </div>
                )}

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

                {mostrarBloqueSubida && (
                  <div className="workspace-divider pt-4 space-y-4">
                    <h3 className="text-lg font-semibold">Subir tu video</h3>
                    <p className="workspace-inline-note">
                      Puedes grabarlo ahora desde la cámara o elegir un archivo ya guardado.
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

                    {mensajeExito && (
                      <p className="text-green-700 text-sm font-medium">{mensajeExito}</p>
                    )}

                    {mensajeError && (
                      <p className="text-red-700 text-sm font-medium">{mensajeError}</p>
                    )}
                  </div>
                )}

                {!esAdmin &&
                  semanaEnUso === semanaActual &&
                  Boolean(diaActualClave) &&
                  yaSubioVideoHoy && (
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium text-green-700">
                        Ya cargaste el video de hoy. Podrás volver a subir cuando llegue el próximo día del dispositivo.
                      </p>
                    </div>
                  )}

                  <div className="workspace-divider pt-4 space-y-4">
                    <h3 className="text-lg font-semibold">Videos de la semana</h3>

                  {semanasDisponibles.length === 0 && (
                    <p className="workspace-inline-note">Todavía no hay semanas registradas.</p>
                  )}

                  {videosSemana.length === 0 && (
                    <p className="workspace-inline-note">
                      No hay videos cargados para la semana seleccionada.
                    </p>
                  )}

                  {videosSemana.map((video) => {
                    const cantidadVotos = votosPorVideo.get(video.id) || 0
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
                          {resultadosVotacionVisibles ? (
                            <p className="workspace-inline-note text-xs">
                              Elecciones recibidas: {cantidadVotos}
                            </p>
                          ) : (
                            <p className="workspace-inline-note text-xs">
                              Elecciones recibidas: resultado oculto hasta las 22:00 hs de Argentina.
                            </p>
                          )}
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

                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="video-elegido"
                            checked={elegidoSeleccionado === video.id}
                            onChange={() => setElegidoSeleccionado(video.id)}
                          />
                          Elegir este video
                        </label>

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

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleElegir}
                      disabled={eligiendo || elegidoSeleccionado === null}
                      className="workspace-button-primary disabled:opacity-60"
                    >
                      {eligiendo ? "Guardando elección..." : "Confirmar elección"}
                    </button>

                    {!esAdmin && (
                      <button
                        type="button"
                        onClick={handleLimpiarVideos}
                        className="workspace-button-secondary"
                      >
                        Limpiar prueba
                      </button>
                    )}
                  </div>
                </div>

                <div className="workspace-divider pt-4 space-y-4">
                  <h3 className="text-lg font-semibold">Ranking y resultado</h3>

                  {!resultadosVotacionVisibles && (
                    <div className="workspace-panel-soft space-y-2">
                      <p className="font-medium">Votación secreta en curso</p>
                      <p className="workspace-inline-note">
                        Hasta las 22:00 hs de Argentina no se muestran resultados parciales
                        ni ranking de la semana. El resultado se revela al cierre.
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
                              Subió lunes, martes y miércoles: {item.subioTres ? "sí" : "no"}
                            </p>
                            <p className="workspace-inline-note text-xs">
                              Participó eligiendo: {item.participoEligiendo ? "sí" : "no"}
                            </p>
                            <p className="workspace-inline-note text-xs">
                              Elegible para ganar: {item.elegible ? "sí" : "no"}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="workspace-divider pt-4 space-y-3">
                        <h4 className="text-base font-semibold">Ganador de la semana</h4>

                        {!ganadorSemana && (
                          <p className="workspace-inline-note">
                            No hay ganador definido esta semana. Para ganar hay que subir los 3 videos y además participar eligiendo.
                          </p>
                        )}

                        {ganadorSemana && ganadorSemana.empate && (
                          <p className="workspace-inline-note">
                            Hay empate en el primer puesto entre participantes elegibles. No se define ganador automático.
                          </p>
                        )}

                        {ganadorSemana && !ganadorSemana.empate && (
                          <div className="space-y-1">
                            <p className="font-medium">{ganadorSemana.participante.nombre}</p>
                            <p className="workspace-inline-note text-xs">
                              Elecciones recibidas: {ganadorSemana.participante.totalVotos}
                            </p>
                            <p className="workspace-inline-note text-xs">
                              Cumplió con subir lunes, martes y miércoles y además participó eligiendo.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </SeccionDesplegable>
          )}

          {tieneRecurso("dispositivo_videos_casatalentos") && !esAdmin && (
            <SeccionDesplegable titulo="Historial">
              <div className="space-y-6">
                {historialSemanal.length === 0 && (
                  <p className="workspace-inline-note">
                    Todavía no hay semanas anteriores guardadas en el historial.
                  </p>
                )}

                {historialSemanal.map((semana) => (
                  <div key={semana.semana} className="workspace-panel space-y-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1">
                        <p className="workspace-eyebrow">Semana</p>
                        <h3 className="text-xl font-semibold tracking-[-0.02em]">
                          {formatearFecha(semana.semana)}
                        </h3>
                      </div>
                      <div className="workspace-panel-soft !p-3">
                        <p className="workspace-eyebrow !text-[0.62rem]">Resultado</p>
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {semana.ganadorTexto}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                    {semana.participantes.length === 0 && (
                      <p className="workspace-inline-note">No hubo videos cargados en esta semana.</p>
                    )}

                    {semana.participantes.map((participante) => (
                      <div key={`${semana.semana}-${participante.nombre}`} className="workspace-panel-soft space-y-3">
                        <div className="space-y-1">
                          <p className="text-lg font-semibold tracking-[-0.02em]">{participante.nombre}</p>
                          <p className="workspace-inline-note text-xs">
                            Elecciones recibidas: {participante.totalVotos}
                          </p>
                        </div>

                        <div className="space-y-3">
                        {participante.videos.map((video) => (
                          <div key={video.id} className="workspace-card-link !rounded-[1.2rem] !p-3 space-y-2">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <p className="text-sm font-semibold">
                                {video.dia_clave || video.dia || "Día sin definir"}
                              </p>
                              <span className="workspace-chip !text-[0.58rem]">
                                1 minuto
                              </span>
                            </div>
                            {video.titulo && (
                              <p className="workspace-inline-note">{video.titulo}</p>
                            )}

                            {video.video_url && (
                              <video
                                controls
                                src={video.video_url}
                                className="w-full rounded-xl border border-[var(--line)]"
                              />
                            )}
                          </div>
                        ))}
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                ))}
              </div>
            </SeccionDesplegable>
          )}

          {tieneRecurso("dispositivo_videos_casatalentos") && esAdmin && (
            <SeccionDesplegable titulo="Historial">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    Ver historial de
                  </label>
                  <select
                    className="workspace-field"
                    value={participanteHistorialSeleccionado}
                    onChange={(e) => setParticipanteHistorialSeleccionado(e.target.value)}
                  >
                    <option value="todos">Todos los participantes</option>
                    {participantesHistorial.map((participante) => (
                      <option key={participante.clave} value={participante.clave}>
                        {participante.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {historialAdminFiltrado.length === 0 && (
                  <p className="workspace-inline-note">
                    Todavía no hay historial guardado para este participante.
                  </p>
                )}

                {historialAdminFiltrado.map((semana) => (
                  <div key={semana.semana} className="workspace-panel space-y-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1">
                        <p className="workspace-eyebrow">Semana</p>
                        <h3 className="text-xl font-semibold tracking-[-0.02em]">
                          {formatearFecha(semana.semana)}
                        </h3>
                      </div>
                      <div className="workspace-panel-soft !p-3">
                        <p className="workspace-eyebrow !text-[0.62rem]">Resultado</p>
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {semana.ganadorTexto}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                    {semana.participantes.map((participante) => (
                      <div
                        key={`${semana.semana}-${participante.nombre}`}
                        className="workspace-panel-soft space-y-3"
                      >
                        <div className="space-y-1">
                          <p className="text-lg font-semibold tracking-[-0.02em]">
                            {participante.nombre}
                          </p>
                          <p className="workspace-inline-note text-xs">
                            Elecciones recibidas: {participante.totalVotos}
                          </p>
                        </div>

                        <div className="space-y-3">
                        {participante.videos.map((video) => (
                          <div key={video.id} className="workspace-card-link !rounded-[1.2rem] !p-3 space-y-2">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <p className="text-sm font-semibold">
                                {video.dia_clave || video.dia || "Día sin definir"}
                              </p>
                              <span className="workspace-chip !text-[0.58rem]">
                                1 minuto
                              </span>
                            </div>
                            {video.titulo && (
                              <p className="workspace-inline-note">{video.titulo}</p>
                            )}

                            {video.video_url && (
                              <video
                                controls
                                src={video.video_url}
                                className="w-full rounded-xl border border-[var(--line)]"
                              />
                            )}
                          </div>
                        ))}
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                ))}
              </div>
            </SeccionDesplegable>
          )}

          <SeccionDesplegable titulo="Mensajes">
            <div className="space-y-6">
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
                <textarea
                  className="workspace-field min-h-[110px]"
                  placeholder="Escribí aquí comentarios sobre las reuniones, valoraciones, agradecimientos o algo que quieras compartir..."
                  value={mensajeGeneralDraft}
                  onChange={(e) => setMensajeGeneralDraft(e.target.value)}
                />

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
                        <textarea
                          className="workspace-field min-h-[100px]"
                          value={mensajeEditandoContenido}
                          onChange={(e) => setMensajeEditandoContenido(e.target.value)}
                        />
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
                          <div key={respuesta.id} className="workspace-message-reply space-y-1">
                              <p className="text-sm font-medium">{respuesta.autor_nombre}</p>
                              <p className="workspace-inline-note text-xs">
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
