"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAppSession } from "@/components/auth/AppSessionProvider"

type Segmento =
  | "todos_activos"
  | "todos_registrados"
  | "usuarios_inactivos"
  | "casatalentos_activos"
  | "conectando_sentidos_activos"
  | "mentorias_activos"
  | "terapia_activos"
  | "pagos_pendientes"
  | "equipo_interno"
  | "contactos_externos_activos"
  | "contactos_externos_todos"
  | "usuarios_y_contactos_activos"
  | "destinatarios_especificos"
  | "lista_manual"

type TipoComunicacion =
  | "general"
  | "actividad"
  | "pago"
  | "aviso"
  | "newsletter"

type FiltroPagoPendiente =
  | "todos"
  | "mensualidades"
  | "terapias"
  | "comprobantes_en_revision"
  | "rechazados"

type DestinatarioPreview = {
  email: string
  nombreCompleto: string
  actividadSlug?: string | null
  fuente: "usuario_plataforma" | "contacto_externo" | "manual"
  activo: boolean
  razon: string
  tipoPago?: "mensualidad" | "proceso" | "sesion_terapia"
  estadoPago?: "sin_pago" | "en_revision" | "rechazado" | "pendiente_pago"
  monto?: string | number | null
  moneda?: string | null
  detallePago?: string | null
  fechaSesion?: string | null
  fechaVencimiento?: string | null
  reservaId?: number | null
  pagoMensualId?: number | null
  comprobantePendienteAprobacion?: boolean
  recordatorioEnviadoHoy?: boolean
}

type ContactoExterno = {
  id: number
  email: string
  nombre?: string | null
  apellido?: string | null
  telefono?: string | null
  origen?: string | null
  activo?: boolean | null
  notas?: string | null
  created_at?: string | null
}

type ContactoDraft = {
  email: string
  nombre: string
  apellido: string
  telefono: string
  origen: string
  notas: string
}

type HistorialEnvio = {
  id: number
  destinatario_email: string
  destinatario_nombre?: string | null
  actividad_slug?: string | null
  tipo: string
  asunto: string
  estado: string
  error?: string | null
  created_at?: string | null
  sent_at?: string | null
  metadata?: { segmento?: string | null; [key: string]: unknown } | null
}

type Recurrencia = "una_vez" | "semanal" | "mensual" | "intervalo_dias"

type ProgramacionResumen = {
  id: number
  nombre: string
  tipo: string
  asunto: string
  segmento: Segmento
  recurrencia: Recurrencia
  dia_semana: number | null
  dia_mes: number | null
  intervalo_dias: number | null
  hora: string
  modo_disparo: "automatico" | "requiere_aprobacion"
  activo: boolean
  proxima_ejecucion: string
  ultima_ejecucion_at: string | null
  pendiente_aprobacion: boolean
}

type RecibidoResumen = {
  id: number
  remitente_email: string
  remitente_nombre?: string | null
  destinatario_email?: string | null
  asunto?: string | null
  texto?: string | null
  html?: string | null
  leido: boolean
  respondido: boolean
  recibido_at: string
}

const SEGMENTOS: Array<{
  value: Segmento
  label: string
  descripcion: string
  disabled?: boolean
}> = [
  {
    value: "todos_activos",
    label: "Todos los usuarios activos",
    descripcion: "Usuarios activos de la plataforma.",
  },
  {
    value: "todos_registrados",
    label: "Todos los usuarios registrados",
    descripcion: "Usuarios activos e inactivos de la plataforma.",
  },
  {
    value: "usuarios_inactivos",
    label: "Usuarios inactivos",
    descripcion: "Usuarios registrados actualmente inactivos.",
  },
  {
    value: "casatalentos_activos",
    label: "CasaTalentos activos",
    descripcion: "Inscripción activa en CasaTalentos.",
  },
  {
    value: "conectando_sentidos_activos",
    label: "Conectando Sentidos activos",
    descripcion: "Inscripción activa en Conectando Sentidos.",
  },
  {
    value: "mentorias_activos",
    label: "Mentorías activos",
    descripcion: "Inscripción activa en Mentorías.",
  },
  {
    value: "terapia_activos",
    label: "Terapia activos",
    descripcion: "Inscripción activa en Terapia.",
  },
  {
    value: "pagos_pendientes",
    label: "Usuarios con pago pendiente",
    descripcion: "Recordatorios manuales para mensualidades, procesos y terapias pendientes.",
  },
  {
    value: "equipo_interno",
    label: "Equipo interno",
    descripcion: "Admins y colaboradores activos.",
  },
  {
    value: "contactos_externos_activos",
    label: "Contactos externos activos",
    descripcion: "Contactos guardados sin usuario de plataforma.",
  },
  {
    value: "contactos_externos_todos",
    label: "Contactos externos, todos",
    descripcion: "Contactos externos activos e inactivos.",
  },
  {
    value: "usuarios_y_contactos_activos",
    label: "Usuarios + contactos activos",
    descripcion: "Usuarios activos y contactos externos activos deduplicados.",
  },
  {
    value: "destinatarios_especificos",
    label: "Destinatarios específicos",
    descripcion: "Personas elegidas manualmente desde usuarios y contactos.",
  },
  {
    value: "lista_manual",
    label: "Lista manual de emails",
    descripcion: "Emails pegados manualmente para este envío.",
  },
]

const SEGMENTOS_PROHIBIDOS_PARA_PAGO: Segmento[] = [
  "contactos_externos_activos",
  "contactos_externos_todos",
  "usuarios_y_contactos_activos",
  "lista_manual",
]

const TIPOS: Array<{ value: TipoComunicacion; label: string }> = [
  { value: "general", label: "General" },
  { value: "actividad", label: "Actividad" },
  { value: "pago", label: "Pago" },
  { value: "aviso", label: "Aviso" },
  { value: "newsletter", label: "Newsletter" },
]

const FILTROS_PAGO_PENDIENTE: Array<{
  value: FiltroPagoPendiente
  label: string
}> = [
  { value: "todos", label: "Todos los pagos pendientes" },
  { value: "mensualidades", label: "Mensualidades y procesos" },
  { value: "terapias", label: "Terapias pendientes" },
  { value: "comprobantes_en_revision", label: "Comprobantes en revisión" },
  { value: "rechazados", label: "Pagos rechazados" },
]

const ASUNTO_RECORDATORIO_PAGO =
  "Recordatorio de pago pendiente — Entheos"

const CUERPO_RECORDATORIO_PAGO = `Hola {{nombre}},

Te escribimos para recordarte que tenés un pago pendiente en Entheos.

Detalle:
{{detalle_pago}}

Podés regularizarlo ingresando a tu espacio de pagos:

{{link_pagos}}

Una vez acreditado el pago, se habilitará o continuará el acceso correspondiente.

Si ya realizaste el pago, podés responder este correo o subir el comprobante desde la plataforma.

Gracias,
Equipo Entheos`

const ACTIVIDADES = [
  { value: "", label: "Sin actividad específica" },
  { value: "casatalentos", label: "CasaTalentos" },
  { value: "conectando-sentidos", label: "Conectando Sentidos" },
  { value: "mentorias", label: "Mentorías" },
  { value: "terapia", label: "Terapia" },
]

function nombreActividad(slug?: string | null) {
  switch (slug) {
    case "casatalentos":
      return "CasaTalentos"
    case "conectando-sentidos":
      return "Conectando Sentidos"
    case "mentorias":
      return "Mentorías"
    case "terapia":
      return "Terapia"
    default:
      return slug || "General"
  }
}

function estadoClassName(estado: string) {
  if (estado === "enviado") {
    return "border-green-200 bg-green-50 text-green-700"
  }

  if (estado === "error") {
    return "border-red-200 bg-red-50 text-red-700"
  }

  return "border-[var(--line)] bg-white text-gray-600"
}

function fuenteLabel(fuente: DestinatarioPreview["fuente"]) {
  switch (fuente) {
    case "usuario_plataforma":
      return "Usuario"
    case "contacto_externo":
      return "Contacto externo"
    case "manual":
      return "Manual"
  }
}

function tipoPagoLabel(tipo?: DestinatarioPreview["tipoPago"]) {
  switch (tipo) {
    case "mensualidad":
      return "Mensualidad"
    case "proceso":
      return "Proceso"
    case "sesion_terapia":
      return "Sesión de Terapia"
    default:
      return "Pago"
  }
}

function estadoPagoLabel(estado?: DestinatarioPreview["estadoPago"]) {
  switch (estado) {
    case "sin_pago":
      return "Sin pago"
    case "en_revision":
      return "En revisión"
    case "rechazado":
      return "Rechazado"
    case "pendiente_pago":
      return "Pendiente"
    default:
      return "Pendiente"
  }
}

function montoPagoTexto(destinatario: DestinatarioPreview) {
  if (destinatario.monto === null || destinatario.monto === undefined || destinatario.monto === "") {
    return "No informado"
  }
  return `${destinatario.monto}${destinatario.moneda ? ` ${destinatario.moneda}` : ""}`
}

function contactoNombre(contacto: ContactoExterno) {
  return [contacto.nombre, contacto.apellido].filter(Boolean).join(" ") || contacto.email
}

const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
]

const RECURRENCIAS: Array<{ value: Recurrencia; label: string }> = [
  { value: "una_vez", label: "Una vez, en una fecha" },
  { value: "semanal", label: "Todas las semanas, un día fijo" },
  { value: "mensual", label: "Todos los meses, un día fijo" },
  { value: "intervalo_dias", label: "Cada N días" },
]

function recurrenciaLabel(programada: ProgramacionResumen) {
  if (programada.recurrencia === "una_vez") return "Una vez"
  if (programada.recurrencia === "semanal") {
    return `Semanal · ${DIAS_SEMANA[programada.dia_semana ?? 0]}`
  }
  if (programada.recurrencia === "mensual") {
    return `Mensual · día ${programada.dia_mes}`
  }
  return `Cada ${programada.intervalo_dias} días`
}

function fechaHoraLegible(iso?: string | null) {
  if (!iso) return "Sin fecha"
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return iso
  return fecha.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const CONTACTO_DRAFT_INICIAL: ContactoDraft = {
  email: "",
  nombre: "",
  apellido: "",
  telefono: "",
  origen: "",
  notas: "",
}

export default function AdminComunicacionesPage() {
  const { data: session, status } = useAppSession()
  const router = useRouter()
  const esAdmin = session?.user?.role === "admin"

  const [asunto, setAsunto] = useState("")
  const [contenido, setContenido] = useState("")
  const [tipo, setTipo] = useState<TipoComunicacion>("general")
  const [actividadSlug, setActividadSlug] = useState("")
  const [segmento, setSegmento] = useState<Segmento>("todos_activos")
  const [filtroPagoPendiente, setFiltroPagoPendiente] =
    useState<FiltroPagoPendiente>("todos")
  const [emailsManual, setEmailsManual] = useState("")
  const [busquedaDestinatario, setBusquedaDestinatario] = useState("")
  const [resultadosBusqueda, setResultadosBusqueda] = useState<
    DestinatarioPreview[]
  >([])
  const [destinatariosSeleccionados, setDestinatariosSeleccionados] = useState<
    DestinatarioPreview[]
  >([])
  const [buscandoDestinatarios, setBuscandoDestinatarios] = useState(false)
  const [busquedaAdvertencia, setBusquedaAdvertencia] = useState("")
  const [pruebaEmail, setPruebaEmail] = useState(session?.user?.email || "")
  const [preview, setPreview] = useState<DestinatarioPreview[]>([])
  const [previewMensaje, setPreviewMensaje] = useState("")
  const [previewCargando, setPreviewCargando] = useState(false)
  const [destinatariosPagoSeleccionados, setDestinatariosPagoSeleccionados] =
    useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState("")
  const [historial, setHistorial] = useState<HistorialEnvio[]>([])
  const [historialCargando, setHistorialCargando] = useState(false)
  const [filtroEmail, setFiltroEmail] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("")
  const [filtroTipo, setFiltroTipo] = useState("")
  const [contactos, setContactos] = useState<ContactoExterno[]>([])
  const [contactoDraft, setContactoDraft] = useState<ContactoDraft>(
    CONTACTO_DRAFT_INICIAL
  )
  const [contactosCargando, setContactosCargando] = useState(false)
  const [contactosGuardando, setContactosGuardando] = useState(false)
  const [contactosMensaje, setContactosMensaje] = useState("")

  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [modoEnvio, setModoEnvio] = useState<"ahora" | "programar">("ahora")
  const [nombreProgramacion, setNombreProgramacion] = useState("")
  const [recurrencia, setRecurrencia] = useState<Recurrencia>("una_vez")
  const [fechaUnaVez, setFechaUnaVez] = useState("")
  const [diaSemana, setDiaSemana] = useState("1")
  const [diaMes, setDiaMes] = useState("1")
  const [intervaloDias, setIntervaloDias] = useState("7")
  const [horaProgramada, setHoraProgramada] = useState("09:00")
  const [modoDisparo, setModoDisparo] = useState<"automatico" | "requiere_aprobacion">(
    "requiere_aprobacion"
  )
  const [guardandoProgramacion, setGuardandoProgramacion] = useState(false)
  const [mensajeProgramacion, setMensajeProgramacion] = useState("")
  const [programadas, setProgramadas] = useState<ProgramacionResumen[]>([])
  const [programadasCargando, setProgramadasCargando] = useState(false)
  const [accionandoProgramadaId, setAccionandoProgramadaId] = useState<
    number | null
  >(null)

  const [recibidos, setRecibidos] = useState<RecibidoResumen[]>([])
  const [recibidosCargando, setRecibidosCargando] = useState(false)
  const [recibidoExpandidoId, setRecibidoExpandidoId] = useState<number | null>(
    null
  )
  const [cuerposRespuesta, setCuerposRespuesta] = useState<
    Record<number, string>
  >({})
  const [respondiendoId, setRespondiendoId] = useState<number | null>(null)
  const [mensajeRecibidos, setMensajeRecibidos] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [router, status])

  useEffect(() => {
    if (!pruebaEmail && session?.user?.email) {
      setPruebaEmail(session.user.email)
    }
  }, [pruebaEmail, session?.user?.email])

  const segmentoActual = useMemo(
    () => SEGMENTOS.find((item) => item.value === segmento),
    [segmento]
  )

  const tieneDestinatariosEspecificosPendientes =
    segmento === "destinatarios_especificos" &&
    (destinatariosSeleccionados.length > 0 || emailsManual.trim().length > 0)

  const puedeEnviarSegmento =
    segmento === "pagos_pendientes"
      ? destinatariosPagoSeleccionados.length > 0
      : preview.length > 0 || tieneDestinatariosEspecificosPendientes

  const cantidadDestinatariosSegmento = useMemo(() => {
    if (segmento === "pagos_pendientes") {
      return preview.filter((item) =>
        destinatariosPagoSeleccionados.includes(item.email)
      ).length
    }
    return preview.length
  }, [segmento, preview, destinatariosPagoSeleccionados])

  const [contenidoPagoAutocompletado, setContenidoPagoAutocompletado] =
    useState(false)

  useEffect(() => {
    if (segmento === "pagos_pendientes") {
      setTipo("pago")
      setAsunto((valorActual) => {
        if (valorActual.trim()) return valorActual
        setContenidoPagoAutocompletado(true)
        return ASUNTO_RECORDATORIO_PAGO
      })
      setContenido((valorActual) => {
        if (valorActual.trim()) return valorActual
        setContenidoPagoAutocompletado(true)
        return CUERPO_RECORDATORIO_PAGO
      })
      return
    }

    if (contenidoPagoAutocompletado) {
      setAsunto((valorActual) =>
        valorActual === ASUNTO_RECORDATORIO_PAGO ? "" : valorActual
      )
      setContenido((valorActual) =>
        valorActual === CUERPO_RECORDATORIO_PAGO ? "" : valorActual
      )
      setContenidoPagoAutocompletado(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmento])

  const cargarPreview = useCallback(async () => {
    try {
      setPreviewCargando(true)
      setPreviewMensaje("")
      setMensaje("")

      const res = await fetch("/api/admin/comunicaciones/preview-segmento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmento,
          filtroPagoPendiente,
          emailsManual,
          destinatariosSeleccionados,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.deshabilitado) {
        throw new Error(data.error || data.motivo || "No se pudo cargar el segmento.")
      }

      const destinatarios = (data.destinatarios || []) as DestinatarioPreview[]
      setPreview(destinatarios)
      if (segmento === "pagos_pendientes") {
        setDestinatariosPagoSeleccionados(
          destinatarios.map((item) => item.email)
        )
      }
      setPreviewMensaje(`${data.total || 0} destinatario/s encontrados.`)
      return destinatarios
    } catch (error) {
      setPreview([])
      setPreviewMensaje(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el segmento."
      )
      return [] as DestinatarioPreview[]
    } finally {
      setPreviewCargando(false)
    }
  }, [destinatariosSeleccionados, emailsManual, filtroPagoPendiente, segmento])

  const buscarDestinatarios = useCallback(async () => {
    const q = busquedaDestinatario.trim()
    if (q.length < 2) {
      setResultadosBusqueda([])
      setBusquedaAdvertencia("Escribí al menos 2 caracteres para buscar.")
      return
    }

    try {
      setBuscandoDestinatarios(true)
      setBusquedaAdvertencia("")

      const res = await fetch(
        `/api/admin/comunicaciones/buscar-destinatarios?q=${encodeURIComponent(q)}`,
        { cache: "no-store" }
      )
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "No se pudieron buscar destinatarios.")
      }

      setResultadosBusqueda(data.destinatarios || [])
      setBusquedaAdvertencia(data.advertencia || "")
    } catch (error) {
      setResultadosBusqueda([])
      setBusquedaAdvertencia(
        error instanceof Error
          ? error.message
          : "No se pudieron buscar destinatarios."
      )
    } finally {
      setBuscandoDestinatarios(false)
    }
  }, [busquedaDestinatario])

  const cargarContactos = useCallback(async () => {
    try {
      setContactosCargando(true)
      setContactosMensaje("")

      const res = await fetch("/api/admin/comunicaciones/contactos", {
        cache: "no-store",
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "No se pudieron cargar los contactos.")
      }

      setContactos(data.contactos || [])
    } catch (error) {
      setContactosMensaje(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los contactos."
      )
    } finally {
      setContactosCargando(false)
    }
  }, [])

  const cargarHistorial = useCallback(async () => {
    try {
      setHistorialCargando(true)
      const params = new URLSearchParams()
      if (filtroEmail.trim()) params.set("email", filtroEmail.trim())
      if (filtroEstado) params.set("estado", filtroEstado)
      if (filtroTipo) params.set("tipo", filtroTipo)
      params.set("limit", "60")

      const res = await fetch(
        `/api/admin/comunicaciones/historial?${params.toString()}`,
        { cache: "no-store" }
      )
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "No se pudo cargar el historial.")
      }

      setHistorial((data.envios || []) as HistorialEnvio[])
    } catch (error) {
      setMensaje(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el historial."
      )
    } finally {
      setHistorialCargando(false)
    }
  }, [filtroEmail, filtroEstado, filtroTipo])

  const cargarProgramadas = useCallback(async () => {
    try {
      setProgramadasCargando(true)

      const res = await fetch("/api/admin/comunicaciones/programadas", {
        cache: "no-store",
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "No se pudieron cargar las programaciones.")
      }

      setProgramadas((data.programadas || []) as ProgramacionResumen[])
    } catch (error) {
      setMensajeProgramacion(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar las programaciones."
      )
    } finally {
      setProgramadasCargando(false)
    }
  }, [])

  const cargarRecibidos = useCallback(async () => {
    try {
      setRecibidosCargando(true)

      const res = await fetch("/api/admin/comunicaciones/recibidos", {
        cache: "no-store",
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "No se pudieron cargar los emails recibidos.")
      }

      setRecibidos((data.recibidos || []) as RecibidoResumen[])
    } catch (error) {
      setMensajeRecibidos(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los emails recibidos."
      )
    } finally {
      setRecibidosCargando(false)
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated" && esAdmin) {
      void cargarPreview()
      void cargarHistorial()
      void cargarContactos()
      void cargarProgramadas()
      void cargarRecibidos()
    }
  }, [
    cargarContactos,
    cargarHistorial,
    cargarPreview,
    cargarProgramadas,
    cargarRecibidos,
    esAdmin,
    status,
  ])

  const validarContenido = () => {
    if (!asunto.trim()) {
      setMensaje("Completá el asunto.")
      return false
    }

    if (!contenido.trim()) {
      setMensaje("Completá el contenido.")
      return false
    }

    if (
      tipo === "pago" &&
      SEGMENTOS_PROHIBIDOS_PARA_PAGO.includes(segmento)
    ) {
      setMensaje(
        "Los contactos externos no deben usarse para comunicaciones transaccionales de pago."
      )
      return false
    }

    if (
      tipo === "pago" &&
      segmento === "destinatarios_especificos" &&
      preview.some((destinatario) => destinatario.fuente !== "usuario_plataforma")
    ) {
      setMensaje(
        "Los contactos externos o emails manuales no deben usarse para comunicaciones transaccionales de pago."
      )
      return false
    }

    return true
  }

  const enviar = async (modo: "prueba" | "segmento") => {
    if (!validarContenido()) return

    if (modo === "prueba" && !pruebaEmail.trim()) {
      setMensaje("Ingresá un email para la prueba.")
      return
    }

    let destinatariosParaConfirmar = preview
    if (segmento === "pagos_pendientes") {
      destinatariosParaConfirmar = preview.filter((item) =>
        destinatariosPagoSeleccionados.includes(item.email)
      )
    }

    if (modo === "segmento" && destinatariosParaConfirmar.length === 0) {
      if (tieneDestinatariosEspecificosPendientes) {
        destinatariosParaConfirmar = await cargarPreview()
      }

      if (destinatariosParaConfirmar.length === 0) {
        setMensaje("Primero cargá el preview del segmento.")
        return
      }
    }

    if (
      modo === "segmento" &&
      !window.confirm(
        `Vas a enviar esta comunicación a ${destinatariosParaConfirmar.length} destinatario/s. ¿Continuar?`
      )
    ) {
      return
    }

    try {
      setEnviando(true)
      setMensaje("")

      const res = await fetch("/api/admin/comunicaciones/enviar-segmento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asunto,
          texto: contenido,
          tipo,
          actividadSlug: actividadSlug || null,
          segmento,
          filtroPagoPendiente,
          emailsManual,
          destinatariosSeleccionados,
          destinatariosFiltrados:
            segmento === "pagos_pendientes"
              ? destinatariosParaConfirmar.map((item) => ({
                  email: item.email,
                }))
              : [],
          pruebaEmail: modo === "prueba" ? pruebaEmail : null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "No se pudo enviar la comunicación.")
      }

      const resumen = data.resumen || {}
      setMensaje(
        modo === "prueba"
          ? `Prueba enviada. Enviados: ${resumen.enviados || 0}. Errores: ${resumen.errores || 0}.`
          : `Envío finalizado. Enviados: ${resumen.enviados || 0}. Errores: ${resumen.errores || 0}. Omitidos: ${resumen.omitidos || 0}.`
      )
      await cargarHistorial()
    } catch (error) {
      setMensaje(
        error instanceof Error
          ? error.message
          : "No se pudo enviar la comunicación."
      )
    } finally {
      setEnviando(false)
    }
  }

  const crearProgramacion = async () => {
    if (!validarContenido()) return

    if (!nombreProgramacion.trim()) {
      setMensajeProgramacion("Ponele un nombre a la programación.")
      return
    }

    if (
      (recurrencia === "una_vez" || recurrencia === "intervalo_dias") &&
      !fechaUnaVez
    ) {
      setMensajeProgramacion("Elegí la fecha.")
      return
    }

    if (!horaProgramada) {
      setMensajeProgramacion("Elegí la hora.")
      return
    }

    try {
      setGuardandoProgramacion(true)
      setMensajeProgramacion("")

      const res = await fetch("/api/admin/comunicaciones/programadas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombreProgramacion,
          tipo,
          actividadSlug: actividadSlug || null,
          asunto,
          contenido,
          segmento,
          filtroPagoPendiente,
          emailsManual,
          destinatariosSeleccionados,
          recurrencia,
          fechaUnaVez:
            recurrencia === "una_vez" || recurrencia === "intervalo_dias"
              ? fechaUnaVez
              : null,
          diaSemana: recurrencia === "semanal" ? Number(diaSemana) : null,
          diaMes: recurrencia === "mensual" ? Number(diaMes) : null,
          intervaloDias:
            recurrencia === "intervalo_dias" ? Number(intervaloDias) : null,
          hora: horaProgramada,
          modoDisparo,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "No se pudo crear la programación.")
      }

      setMensajeProgramacion("Programación creada correctamente.")
      setNombreProgramacion("")
      await cargarProgramadas()
    } catch (error) {
      setMensajeProgramacion(
        error instanceof Error
          ? error.message
          : "No se pudo crear la programación."
      )
    } finally {
      setGuardandoProgramacion(false)
    }
  }

  const ejecutarAccionProgramada = async (
    id: number,
    accion: "pausar" | "reanudar" | "eliminar" | "aprobar_y_enviar"
  ) => {
    if (accion === "eliminar" && !window.confirm("¿Eliminar esta programación?")) {
      return
    }

    if (
      accion === "aprobar_y_enviar" &&
      !window.confirm("¿Enviar esta comunicación ahora mismo?")
    ) {
      return
    }

    try {
      setAccionandoProgramadaId(id)
      setMensajeProgramacion("")

      const res = await fetch("/api/admin/comunicaciones/programadas/accion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, accion }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "No se pudo ejecutar la acción.")
      }

      if (accion === "aprobar_y_enviar" && data.resumen) {
        setMensajeProgramacion(
          `Enviado. Enviados: ${data.resumen.enviados}. Errores: ${data.resumen.errores}.`
        )
        await cargarHistorial()
      }

      await cargarProgramadas()
    } catch (error) {
      setMensajeProgramacion(
        error instanceof Error ? error.message : "No se pudo ejecutar la acción."
      )
    } finally {
      setAccionandoProgramadaId(null)
    }
  }

  const marcarLeidoRecibido = async (id: number) => {
    try {
      const res = await fetch("/api/admin/comunicaciones/recibidos/accion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, accion: "marcar_leido" }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "No se pudo marcar como leído.")
      }

      await cargarRecibidos()
    } catch (error) {
      setMensajeRecibidos(
        error instanceof Error ? error.message : "No se pudo marcar como leído."
      )
    }
  }

  const responderRecibido = async (id: number) => {
    const cuerpo = (cuerposRespuesta[id] || "").trim()

    if (!cuerpo) {
      setMensajeRecibidos("Escribí una respuesta antes de enviar.")
      return
    }

    try {
      setRespondiendoId(id)
      setMensajeRecibidos("")

      const res = await fetch("/api/admin/comunicaciones/recibidos/accion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, accion: "responder", cuerpo }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "No se pudo enviar la respuesta.")
      }

      setMensajeRecibidos("Respuesta enviada.")
      setCuerposRespuesta((prev) => {
        const siguiente = { ...prev }
        delete siguiente[id]
        return siguiente
      })
      await cargarRecibidos()
    } catch (error) {
      setMensajeRecibidos(
        error instanceof Error ? error.message : "No se pudo enviar la respuesta."
      )
    } finally {
      setRespondiendoId(null)
    }
  }

  const crearContacto = async () => {
    try {
      setContactosGuardando(true)
      setContactosMensaje("")

      const res = await fetch("/api/admin/comunicaciones/contactos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactoDraft),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "No se pudo crear el contacto.")
      }

      setContactoDraft(CONTACTO_DRAFT_INICIAL)
      setContactosMensaje("Contacto externo creado.")
      await cargarContactos()
      if (
        segmento === "contactos_externos_activos" ||
        segmento === "contactos_externos_todos" ||
        segmento === "usuarios_y_contactos_activos"
      ) {
        await cargarPreview()
      }
    } catch (error) {
      setContactosMensaje(
        error instanceof Error
          ? error.message
          : "No se pudo crear el contacto."
      )
    } finally {
      setContactosGuardando(false)
    }
  }

  const agregarDestinatarioSeleccionado = (destinatario: DestinatarioPreview) => {
    setDestinatariosSeleccionados((prev) => {
      if (prev.some((item) => item.email === destinatario.email)) {
        return prev
      }

      return [...prev, destinatario]
    })
  }

  const quitarDestinatarioSeleccionado = (email: string) => {
    setDestinatariosSeleccionados((prev) =>
      prev.filter((item) => item.email !== email)
    )
  }

  const toggleDestinatarioPago = (email: string) => {
    setDestinatariosPagoSeleccionados((prev) =>
      prev.includes(email)
        ? prev.filter((item) => item !== email)
        : [...prev, email]
    )
  }

  const seleccionarTodosPagos = () => {
    setDestinatariosPagoSeleccionados(preview.map((item) => item.email))
  }

  const limpiarSeleccionPagos = () => {
    setDestinatariosPagoSeleccionados([])
  }

  const cambiarEstadoContacto = async (contacto: ContactoExterno) => {
    try {
      setContactosGuardando(true)
      setContactosMensaje("")

      const res = await fetch("/api/admin/comunicaciones/contactos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: contacto.id,
          activo: contacto.activo === false,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el contacto.")
      }

      setContactosMensaje("Contacto externo actualizado.")
      await cargarContactos()
      if (
        segmento === "contactos_externos_activos" ||
        segmento === "contactos_externos_todos" ||
        segmento === "usuarios_y_contactos_activos"
      ) {
        await cargarPreview()
      }
    } catch (error) {
      setContactosMensaje(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el contacto."
      )
    } finally {
      setContactosGuardando(false)
    }
  }

  if (status === "loading") {
    return <main className="workspace-shell">Cargando sesión...</main>
  }

  if (status === "authenticated" && !esAdmin) {
    return (
      <main className="workspace-shell">
        <section className="workspace-panel">
          No tenés permisos para administrar comunicaciones.
        </section>
      </main>
    )
  }

  return (
    <main className="workspace-shell space-y-6">
      <section className="workspace-hero">
        <div className="relative z-10 max-w-3xl space-y-4">
          <p className="workspace-eyebrow">Administración</p>
          <h1 className="workspace-title">Comunicaciones</h1>
          <p className="workspace-subtitle">
            Centro operativo para preparar, previsualizar y enviar mensajes por
            segmentos, manteniendo el historial de cada envío.
          </p>
        </div>
      </section>

      {mensaje && <section className="workspace-panel-soft">{mensaje}</section>}

      <section className="workspace-panel space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { n: 1, label: "Destinatarios" },
              { n: 2, label: "Mensaje" },
              { n: 3, label: "Enviar o programar" },
            ] as const
          ).map((item) => (
            <button
              key={item.n}
              type="button"
              onClick={() => setPaso(item.n)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                paso === item.n
                  ? "border-[var(--sea)] bg-[var(--sea)] text-white"
                  : "border-[var(--line)] bg-white/70 text-gray-600 hover:border-[var(--sea)]"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  paso === item.n ? "bg-white/25" : "bg-[rgba(45,107,122,0.12)]"
                }`}
              >
                {item.n}
              </span>
              {item.label}
            </button>
          ))}
        </div>

        {paso === 1 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="workspace-eyebrow">Paso 1</p>
            <h2 className="workspace-title-sm">¿A quién le escribís?</h2>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">
              Segmento destinatario
            </span>
            <select
              className="workspace-field"
              value={segmento}
              onChange={(e) => setSegmento(e.target.value as Segmento)}
            >
              {SEGMENTOS.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                  disabled={item.disabled}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {segmentoActual && (
            <p className="text-sm text-gray-600">{segmentoActual.descripcion}</p>
          )}

          {segmento === "pagos_pendientes" && (
            <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.7)] p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-800">
                  Recordatorios de pago
                </p>
                <p className="text-sm text-gray-600">
                  Elegí el tipo de deuda, previsualizá destinatarios y quitá manualmente a quienes no quieras incluir.
                </p>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">
                  Tipo de deuda
                </span>
                <select
                  className="workspace-field"
                  value={filtroPagoPendiente}
                  onChange={(e) =>
                    setFiltroPagoPendiente(e.target.value as FiltroPagoPendiente)
                  }
                >
                  {FILTROS_PAGO_PENDIENTE.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {segmento === "destinatarios_especificos" && (
            <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-white/70 p-3">
              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">
                  Buscar usuario o contacto
                </span>
                <div className="flex gap-2">
                  <input
                    className="workspace-field"
                    value={busquedaDestinatario}
                    onChange={(e) => setBusquedaDestinatario(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        void buscarDestinatarios()
                      }
                    }}
                    placeholder="Nombre, apellido o email"
                  />
                  <button
                    type="button"
                    disabled={buscandoDestinatarios}
                    onClick={() => void buscarDestinatarios()}
                    className="workspace-button-secondary !px-3 !py-1.5 text-xs"
                  >
                    {buscandoDestinatarios ? "Buscando..." : "Buscar"}
                  </button>
                </div>
              </label>

              {busquedaAdvertencia && (
                <p className="rounded-xl border border-[var(--line)] bg-[rgba(255,250,242,0.7)] px-3 py-2 text-xs text-gray-600">
                  {busquedaAdvertencia}
                </p>
              )}

              {resultadosBusqueda.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sea)]">
                    Resultados
                  </p>
                  {resultadosBusqueda.map((destinatario) => (
                    <button
                      key={destinatario.email}
                      type="button"
                      onClick={() => agregarDestinatarioSeleccionado(destinatario)}
                      className="w-full rounded-xl border border-[var(--line)] bg-white/80 p-3 text-left text-sm transition hover:border-[var(--sea)]"
                    >
                      <span className="block font-semibold text-gray-800">
                        {destinatario.nombreCompleto || destinatario.email}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {destinatario.email}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-2">
                        <span className="workspace-chip">
                          {fuenteLabel(destinatario.fuente)}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${
                            destinatario.activo
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-red-200 bg-red-50 text-red-700"
                          }`}
                        >
                          {destinatario.activo ? "Activo" : "Inactivo"}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sea)]">
                  Seleccionados
                </p>
                <div className="flex flex-wrap gap-2">
                  {destinatariosSeleccionados.map((destinatario) => (
                    <span
                      key={destinatario.email}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[rgba(255,250,242,0.8)] px-3 py-1 text-xs text-gray-700"
                    >
                      {destinatario.nombreCompleto || destinatario.email}
                      <button
                        type="button"
                        onClick={() =>
                          quitarDestinatarioSeleccionado(destinatario.email)
                        }
                        className="font-semibold text-[rgb(156,69,59)]"
                      >
                        Quitar
                      </button>
                    </span>
                  ))}
                  {destinatariosSeleccionados.length === 0 && (
                    <span className="text-sm text-gray-600">
                      Todavía no seleccionaste destinatarios.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {(segmento === "lista_manual" ||
            segmento === "destinatarios_especificos") && (
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">
                {segmento === "destinatarios_especificos"
                  ? "Emails manuales adicionales"
                  : "Emails manuales"}
              </span>
              <textarea
                className="workspace-field min-h-32"
                value={emailsManual}
                onChange={(e) => setEmailsManual(e.target.value)}
                placeholder="Pegá emails separados por comas, espacios o líneas."
              />
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={previewCargando || segmentoActual?.disabled}
              onClick={() => void cargarPreview()}
              className="workspace-button-secondary !px-3 !py-1.5 text-xs"
            >
              {previewCargando ? "Cargando..." : "Actualizar preview"}
            </button>
            {segmento === "pagos_pendientes" && (
              <>
                <button
                  type="button"
                  onClick={seleccionarTodosPagos}
                  disabled={preview.length === 0}
                  className="workspace-button-secondary !px-3 !py-1.5 text-xs"
                >
                  Seleccionar todos
                </button>
                <button
                  type="button"
                  onClick={limpiarSeleccionPagos}
                  disabled={preview.length === 0}
                  className="workspace-button-secondary !px-3 !py-1.5 text-xs"
                >
                  Limpiar selección
                </button>
              </>
            )}
          </div>

          {previewMensaje && (
            <p className="rounded-xl border border-[var(--line)] bg-[rgba(255,250,242,0.7)] px-3 py-2 text-sm text-gray-700">
              {previewMensaje}
              {segmento === "pagos_pendientes"
                ? ` Seleccionados: ${destinatariosPagoSeleccionados.length}.`
                : ""}
            </p>
          )}

          <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
            {preview.map((destinatario) => (
              <div
                key={destinatario.email}
                className="rounded-xl border border-[var(--line)] bg-white/80 p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">
                      {destinatario.nombreCompleto || destinatario.email}
                    </p>
                    <p className="text-xs text-gray-500">{destinatario.email}</p>
                  </div>
                  {segmento === "pagos_pendientes" && (
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={destinatariosPagoSeleccionados.includes(destinatario.email)}
                        onChange={() => toggleDestinatarioPago(destinatario.email)}
                      />
                      Enviar
                    </label>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="workspace-chip">
                    {fuenteLabel(destinatario.fuente)}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      destinatario.activo
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {destinatario.activo ? "Activo" : "Inactivo"}
                  </span>
                  {destinatario.actividadSlug && (
                    <span className="workspace-chip">
                      {nombreActividad(destinatario.actividadSlug)}
                    </span>
                  )}
                  {segmento === "pagos_pendientes" && (
                    <>
                      <span className="workspace-chip">
                        {tipoPagoLabel(destinatario.tipoPago)}
                      </span>
                      <span className="workspace-chip">
                        {estadoPagoLabel(destinatario.estadoPago)}
                      </span>
                    </>
                  )}
                  <span className="workspace-chip">{destinatario.razon}</span>
                </div>

                {segmento === "pagos_pendientes" && (
                  <div className="mt-3 space-y-1 text-xs text-gray-600">
                    <p>
                      <strong>Monto:</strong> {montoPagoTexto(destinatario)}
                    </p>
                    {destinatario.fechaSesion && (
                      <p>
                        <strong>Sesión:</strong> {destinatario.fechaSesion}
                      </p>
                    )}
                    {destinatario.fechaVencimiento && (
                      <p>
                        <strong>Período:</strong> {destinatario.fechaVencimiento}
                      </p>
                    )}
                    {destinatario.detallePago && (
                      <p>
                        <strong>Detalle:</strong> {destinatario.detallePago}
                      </p>
                    )}
                    {destinatario.recordatorioEnviadoHoy && (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
                        Ya se envió recordatorio hoy.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {preview.length === 0 && (
              <p className="text-sm text-gray-600">
                Cargá el preview para ver destinatarios.
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="workspace-button"
              onClick={() => setPaso(2)}
            >
              Siguiente: Mensaje
            </button>
          </div>
        </div>
        )}

        {paso === 2 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="workspace-eyebrow">Paso 2</p>
            <h2 className="workspace-title-sm">¿Qué les querés decir?</h2>
          </div>

          {contenidoPagoAutocompletado && (
            <p className="workspace-inline-note">
              Asunto y contenido precargados automáticamente para el
              recordatorio de pago — podés editarlos antes de enviar.
            </p>
          )}

          {tipo === "pago" && SEGMENTOS_PROHIBIDOS_PARA_PAGO.includes(segmento) && (
            <p className="workspace-inline-note text-amber-700">
              Este segmento incluye contactos externos: no se puede enviar
              como comunicación de pago. Cambiá el tipo o elegí otro segmento
              antes de enviar.
            </p>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <label className="space-y-2 lg:col-span-2">
              <span className="text-sm font-medium text-gray-700">Asunto</span>
              <input
                className="workspace-field"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                placeholder="Asunto del email"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Tipo</span>
              <select
                className="workspace-field"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoComunicacion)}
              >
                {TIPOS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">
                Actividad relacionada
              </span>
              <select
                className="workspace-field"
                value={actividadSlug}
                onChange={(e) => setActividadSlug(e.target.value)}
              >
                {ACTIVIDADES.map((item) => (
                  <option key={item.value || "general"} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 lg:col-span-2">
              <span className="text-sm font-medium text-gray-700">Contenido</span>
              <textarea
                className="workspace-field min-h-52"
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                placeholder="Podés usar variables como {{nombre}}, {{nombre_completo}}, {{email}}, {{actividad}}, {{detalle_pago}}, {{monto}}, {{link_pagos}}, {{fecha_sesion}} o {{estado_pago}}."
              />
            </label>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.7)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sea)]">
              Preview del contenido
            </p>
            <p className="mt-3 font-semibold text-gray-800">
              {asunto || "Sin asunto"}
            </p>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
              {contenido || "Sin contenido"}
            </pre>
          </div>

          <div className="flex flex-wrap justify-between gap-2">
            <button
              type="button"
              className="workspace-button-secondary"
              onClick={() => setPaso(1)}
            >
              Atrás
            </button>
            <button
              type="button"
              className="workspace-button"
              onClick={() => {
                if (!asunto.trim() || !contenido.trim()) {
                  setMensaje("Completá asunto y contenido antes de continuar.")
                  return
                }
                setMensaje("")
                setPaso(3)
              }}
            >
              Siguiente: Enviar o programar
            </button>
          </div>
        </div>
        )}

        {paso === 3 && (
        <div className="space-y-5">
          <div className="space-y-1">
            <p className="workspace-eyebrow">Paso 3</p>
            <h2 className="workspace-title-sm">Enviar o programar</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setModoEnvio("ahora")}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                modoEnvio === "ahora"
                  ? "border-[var(--sea)] bg-[var(--sea)] text-white"
                  : "border-[var(--line)] bg-white/70 text-gray-600"
              }`}
            >
              Enviar ahora
            </button>
            <button
              type="button"
              onClick={() => setModoEnvio("programar")}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                modoEnvio === "programar"
                  ? "border-[var(--sea)] bg-[var(--sea)] text-white"
                  : "border-[var(--line)] bg-white/70 text-gray-600"
              }`}
            >
              Programar
            </button>
          </div>

          {modoEnvio === "ahora" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">
                      Enviar prueba
                    </span>
                    <input
                      type="email"
                      className="workspace-field"
                      value={pruebaEmail}
                      onChange={(e) => setPruebaEmail(e.target.value)}
                      placeholder="admin@email.com"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={() => void enviar("prueba")}
                    className="workspace-button-secondary"
                  >
                    {enviando ? "Enviando..." : "Enviar prueba"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.7)] p-4">
                <p className="text-sm text-gray-700">
                  Vas a enviar a{" "}
                  <strong>{cantidadDestinatariosSegmento}</strong> destinatario
                  {cantidadDestinatariosSegmento === 1 ? "" : "s"} del segmento
                  elegido en el Paso 1.
                </p>
                <button
                  type="button"
                  disabled={enviando || !puedeEnviarSegmento}
                  onClick={() => void enviar("segmento")}
                  className="workspace-button mt-3"
                >
                  {enviando
                    ? "Enviando..."
                    : `Enviar a ${cantidadDestinatariosSegmento} destinatario${
                        cantidadDestinatariosSegmento === 1 ? "" : "s"
                      }`}
                </button>
              </div>
            </div>
          )}

          {modoEnvio === "programar" && (
            <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-white/70 p-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">
                  Nombre de la programación
                </span>
                <input
                  className="workspace-field"
                  value={nombreProgramacion}
                  onChange={(e) => setNombreProgramacion(e.target.value)}
                  placeholder="Ej: Recordatorio mensual de pago"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">
                  Recurrencia
                </span>
                <select
                  className="workspace-field"
                  value={recurrencia}
                  onChange={(e) => setRecurrencia(e.target.value as Recurrencia)}
                >
                  {RECURRENCIAS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                {(recurrencia === "una_vez" || recurrencia === "intervalo_dias") && (
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">
                      {recurrencia === "una_vez" ? "Fecha" : "Fecha de inicio"}
                    </span>
                    <input
                      type="date"
                      className="workspace-field"
                      value={fechaUnaVez}
                      onChange={(e) => setFechaUnaVez(e.target.value)}
                    />
                  </label>
                )}

                {recurrencia === "semanal" && (
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">
                      Día de la semana
                    </span>
                    <select
                      className="workspace-field"
                      value={diaSemana}
                      onChange={(e) => setDiaSemana(e.target.value)}
                    >
                      {DIAS_SEMANA.map((label, index) => (
                        <option key={label} value={index}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {recurrencia === "mensual" && (
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">
                      Día del mes
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      className="workspace-field"
                      value={diaMes}
                      onChange={(e) => setDiaMes(e.target.value)}
                    />
                  </label>
                )}

                {recurrencia === "intervalo_dias" && (
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">
                      Cada cuántos días
                    </span>
                    <input
                      type="number"
                      min={1}
                      className="workspace-field"
                      value={intervaloDias}
                      onChange={(e) => setIntervaloDias(e.target.value)}
                    />
                  </label>
                )}

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">
                    Hora (Argentina)
                  </span>
                  <input
                    type="time"
                    className="workspace-field"
                    value={horaProgramada}
                    onChange={(e) => setHoraProgramada(e.target.value)}
                  />
                </label>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-700">
                  Cuando llegue el momento
                </span>
                <div className="flex flex-wrap gap-3 text-sm text-gray-700">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="modoDisparo"
                      checked={modoDisparo === "automatico"}
                      onChange={() => setModoDisparo("automatico")}
                    />
                    Enviar automáticamente
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="modoDisparo"
                      checked={modoDisparo === "requiere_aprobacion"}
                      onChange={() => setModoDisparo("requiere_aprobacion")}
                    />
                    Dejar pendiente de aprobación
                  </label>
                </div>
              </div>

              {mensajeProgramacion && (
                <p className="rounded-xl border border-[var(--line)] bg-[rgba(255,250,242,0.7)] px-3 py-2 text-sm text-gray-700">
                  {mensajeProgramacion}
                </p>
              )}

              <button
                type="button"
                disabled={guardandoProgramacion}
                onClick={() => void crearProgramacion()}
                className="workspace-button"
              >
                {guardandoProgramacion ? "Guardando..." : "Guardar programación"}
              </button>
            </div>
          )}

          <div className="flex justify-start">
            <button
              type="button"
              className="workspace-button-secondary"
              onClick={() => setPaso(2)}
            >
              Atrás
            </button>
          </div>
        </div>
        )}
      </section>

      <section className="workspace-panel space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="workspace-eyebrow">Programados</p>
            <h2 className="workspace-title-sm">Envíos programados y recurrentes</h2>
          </div>
          <button
            type="button"
            disabled={programadasCargando}
            onClick={() => void cargarProgramadas()}
            className="workspace-button-secondary"
          >
            {programadasCargando ? "Cargando..." : "Actualizar"}
          </button>
        </div>

        <div className="grid gap-2">
          {programadas.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-[var(--line)] bg-white/75 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <strong>{item.nombre}</strong>
                <span className="workspace-chip">{recurrenciaLabel(item)}</span>
                <span className="workspace-chip">{item.hora}</span>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    item.activo
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-gray-200 bg-gray-50 text-gray-500"
                  }`}
                >
                  {item.activo ? "Activa" : "Pausada"}
                </span>
                <span className="workspace-chip">
                  {item.modo_disparo === "automatico"
                    ? "Automático"
                    : "Requiere aprobación"}
                </span>
                {item.pendiente_aprobacion && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    Pendiente de aprobación
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Asunto: {item.asunto} · Próxima ejecución:{" "}
                {fechaHoraLegible(item.proxima_ejecucion)}
                {item.ultima_ejecucion_at
                  ? ` · Última vez: ${fechaHoraLegible(item.ultima_ejecucion_at)}`
                  : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.pendiente_aprobacion && (
                  <button
                    type="button"
                    disabled={accionandoProgramadaId === item.id}
                    onClick={() =>
                      void ejecutarAccionProgramada(item.id, "aprobar_y_enviar")
                    }
                    className="workspace-button !px-3 !py-1.5 text-xs"
                  >
                    {accionandoProgramadaId === item.id
                      ? "Enviando..."
                      : "Aprobar y enviar ahora"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={accionandoProgramadaId === item.id}
                  onClick={() =>
                    void ejecutarAccionProgramada(
                      item.id,
                      item.activo ? "pausar" : "reanudar"
                    )
                  }
                  className="workspace-button-secondary !px-3 !py-1.5 text-xs"
                >
                  {item.activo ? "Pausar" : "Reanudar"}
                </button>
                <button
                  type="button"
                  disabled={accionandoProgramadaId === item.id}
                  onClick={() => void ejecutarAccionProgramada(item.id, "eliminar")}
                  className="workspace-button-secondary !px-3 !py-1.5 text-xs"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}

          {programadas.length === 0 && (
            <p className="text-sm text-gray-600">
              Todavía no hay envíos programados.
            </p>
          )}
        </div>
      </section>

      <section className="workspace-panel space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="workspace-eyebrow">Bandeja de entrada</p>
            <h2 className="workspace-title-sm">Respuestas recibidas</h2>
            <p className="workspace-inline-note">
              Emails que te respondieron a algo enviado desde Entheos. Al
              responder acá, sale con el mismo formato de Entheos — no como en
              Gmail.
            </p>
          </div>
          <button
            type="button"
            disabled={recibidosCargando}
            onClick={() => void cargarRecibidos()}
            className="workspace-button-secondary"
          >
            {recibidosCargando ? "Cargando..." : "Actualizar"}
          </button>
        </div>

        {mensajeRecibidos && (
          <p className="rounded-xl border border-[var(--line)] bg-[rgba(255,250,242,0.7)] px-3 py-2 text-sm text-gray-700">
            {mensajeRecibidos}
          </p>
        )}

        <div className="grid gap-2">
          {recibidos.map((item) => {
            const expandido = recibidoExpandidoId === item.id

            return (
              <div
                key={item.id}
                className="rounded-xl border border-[var(--line)] bg-white/75 p-3 text-sm"
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => {
                    setRecibidoExpandidoId(expandido ? null : item.id)
                    if (!item.leido) {
                      void marcarLeidoRecibido(item.id)
                    }
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>
                      {item.remitente_nombre || item.remitente_email}
                    </strong>
                    {!item.leido && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        No leído
                      </span>
                    )}
                    {item.respondido && (
                      <span className="workspace-chip">Respondido</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {item.remitente_email} ·{" "}
                    {new Date(item.recibido_at).toLocaleString("es-AR")}
                  </p>
                  <p className="mt-1 text-sm text-gray-700">
                    {item.asunto || "(Sin asunto)"}
                  </p>
                </button>

                {expandido && (
                  <div className="mt-3 space-y-3 border-t border-[var(--line)] pt-3">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700">
                      {item.texto || "(Sin contenido de texto)"}
                    </pre>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-700">
                        Responder
                      </span>
                      <textarea
                        className="workspace-field min-h-28"
                        value={cuerposRespuesta[item.id] || ""}
                        onChange={(e) =>
                          setCuerposRespuesta((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        placeholder="Escribí tu respuesta..."
                      />
                    </label>
                    <button
                      type="button"
                      disabled={respondiendoId === item.id}
                      onClick={() => void responderRecibido(item.id)}
                      className="workspace-button !px-3 !py-1.5 text-xs"
                    >
                      {respondiendoId === item.id
                        ? "Enviando..."
                        : "Enviar respuesta"}
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {recibidos.length === 0 && (
            <p className="text-sm text-gray-600">
              Todavía no llegó ninguna respuesta.
            </p>
          )}
        </div>
      </section>

      <section className="workspace-panel space-y-4">
        <div className="space-y-1">
          <p className="workspace-eyebrow">Contactos externos</p>
          <h2 className="workspace-title-sm">Base externa</h2>
          <p className="workspace-inline-note">
            Contactos sin acceso a plataforma. Usalos para comunicaciones
            generales o newsletters, no para transaccionales de plataforma.
          </p>
        </div>

        {contactosMensaje && (
          <p className="rounded-xl border border-[var(--line)] bg-[rgba(255,250,242,0.7)] px-3 py-2 text-sm text-gray-700">
            {contactosMensaje}
          </p>
        )}

        <div className="grid gap-3 lg:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Email</span>
            <input
              className="workspace-field"
              type="email"
              value={contactoDraft.email}
              onChange={(e) =>
                setContactoDraft((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="contacto@email.com"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Nombre</span>
            <input
              className="workspace-field"
              value={contactoDraft.nombre}
              onChange={(e) =>
                setContactoDraft((prev) => ({ ...prev, nombre: e.target.value }))
              }
              placeholder="Nombre"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Apellido</span>
            <input
              className="workspace-field"
              value={contactoDraft.apellido}
              onChange={(e) =>
                setContactoDraft((prev) => ({
                  ...prev,
                  apellido: e.target.value,
                }))
              }
              placeholder="Apellido"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Teléfono</span>
            <input
              className="workspace-field"
              value={contactoDraft.telefono}
              onChange={(e) =>
                setContactoDraft((prev) => ({
                  ...prev,
                  telefono: e.target.value,
                }))
              }
              placeholder="+54 9 ..."
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Origen</span>
            <input
              className="workspace-field"
              value={contactoDraft.origen}
              onChange={(e) =>
                setContactoDraft((prev) => ({ ...prev, origen: e.target.value }))
              }
              placeholder="Newsletter, evento, referido..."
            />
          </label>
          <label className="space-y-2 lg:col-span-3">
            <span className="text-sm font-medium text-gray-700">Notas</span>
            <textarea
              className="workspace-field min-h-24"
              value={contactoDraft.notas}
              onChange={(e) =>
                setContactoDraft((prev) => ({ ...prev, notas: e.target.value }))
              }
              placeholder="Notas internas"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={contactosGuardando}
            onClick={() => void crearContacto()}
            className="workspace-button-secondary"
          >
            {contactosGuardando ? "Guardando..." : "Crear contacto"}
          </button>
          <button
            type="button"
            disabled={contactosCargando}
            onClick={() => void cargarContactos()}
            className="workspace-button-secondary"
          >
            {contactosCargando ? "Cargando..." : "Actualizar contactos"}
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {contactos.map((contacto) => (
            <div
              key={contacto.id}
              className="rounded-xl border border-[var(--line)] bg-white/75 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <strong>{contactoNombre(contacto)}</strong>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    contacto.activo === false
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-green-200 bg-green-50 text-green-700"
                  }`}
                >
                  {contacto.activo === false ? "Inactivo" : "Activo"}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">{contacto.email}</p>
              {contacto.origen && (
                <p className="mt-1 text-xs text-gray-500">
                  Origen: {contacto.origen}
                </p>
              )}
              {contacto.notas && (
                <p className="mt-2 whitespace-pre-wrap text-xs text-gray-600">
                  {contacto.notas}
                </p>
              )}
              <button
                type="button"
                disabled={contactosGuardando}
                onClick={() => void cambiarEstadoContacto(contacto)}
                className="workspace-button-secondary mt-3 !px-3 !py-1.5 text-xs"
              >
                {contacto.activo === false ? "Activar" : "Desactivar"}
              </button>
            </div>
          ))}

          {contactos.length === 0 && (
            <p className="text-sm text-gray-600">
              Todavía no hay contactos externos cargados.
            </p>
          )}
        </div>
      </section>

      <section className="workspace-panel space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="workspace-eyebrow">Historial</p>
            <h2 className="workspace-title-sm">Últimos envíos</h2>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[640px]">
            <input
              className="workspace-field"
              value={filtroEmail}
              onChange={(e) => setFiltroEmail(e.target.value)}
              placeholder="Filtrar por email"
            />
            <select
              className="workspace-field"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="enviado">Enviado</option>
              <option value="error">Error</option>
              <option value="omitido">Omitido</option>
            </select>
            <select
              className="workspace-field"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="">Todos los tipos</option>
              <option value="general">General</option>
              <option value="actividad">Actividad</option>
              <option value="pago">Pago</option>
              <option value="aviso">Aviso</option>
              <option value="newsletter">Newsletter</option>
              <option value="prueba">Prueba</option>
              <option value="individual">Individual</option>
            </select>
          </div>

          <button
            type="button"
            disabled={historialCargando}
            onClick={() => void cargarHistorial()}
            className="workspace-button-secondary"
          >
            {historialCargando ? "Cargando..." : "Actualizar historial"}
          </button>
        </div>

        <div className="grid gap-2">
          {historial.map((envio) => (
            <div
              key={envio.id}
              className="rounded-xl border border-[var(--line)] bg-white/75 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <strong>{envio.asunto}</strong>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${estadoClassName(envio.estado)}`}
                >
                  {envio.estado}
                </span>
                <span className="workspace-chip">{envio.tipo}</span>
                {envio.actividad_slug && (
                  <span className="workspace-chip">
                    {nombreActividad(envio.actividad_slug)}
                  </span>
                )}
                {envio.metadata?.segmento && (
                  <span className="workspace-chip">
                    {String(envio.metadata.segmento)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {envio.destinatario_nombre || envio.destinatario_email} ·{" "}
                {envio.destinatario_email} ·{" "}
                {envio.sent_at || envio.created_at || "Sin fecha visible"}
              </p>
              {envio.error && (
                <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {envio.error}
                </p>
              )}
            </div>
          ))}

          {historial.length === 0 && (
            <p className="text-sm text-gray-600">
              Todavía no hay envíos para mostrar.
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
