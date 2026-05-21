"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAppSession } from "@/components/auth/AppSessionProvider"
import SeccionDesplegable from "@/components/SeccionDesplegable"
import type {
  ActividadResumen,
  AgendaResumen,
  AlertaResumen,
  EconomiaResumen,
  HistorialPagoResumen,
  PersonaResumen,
} from "@/lib/admin-person-summary"
import {
  normalizarDocumentosNotas,
  serializarDocumentosNotas,
} from "@/lib/documentos-notas"

type Usuario = {
  id: string
  nombre: string
  apellido?: string | null
  email: string
  whatsapp?: string | null
  fecha_cumpleanos?: string | null
  notas_documentos?: unknown
  charla_intro_habilitada?: boolean | null
  role: "admin" | "colaborador" | "participante"
  activo: boolean
  created_at?: string | null
}

type ActividadesFormState = {
  casatalentos: boolean
  "conectando-sentidos": boolean
  mentorias: boolean
  terapia: boolean
}

type FormState = {
  id: string
  nombre: string
  apellido: string
  email: string
  whatsapp: string
  fechaCumpleanos: string
  notasDocumentos: string
  charlaIntroHabilitada: boolean
  role: Usuario["role"]
  activo: boolean
  password: string
  enviarBienvenida: boolean
  actividades: ActividadesFormState
}

type ModalidadOperable =
  | "mensual"
  | "por_sesion"
  | "por_proceso"
  | "becado"
  | "invitado"
  | "sin_cobro"

type MedioSugerido = "transferencia" | "mercado_pago" | "manual" | ""

type EconomiaDraft = {
  monto: string
  moneda: string
  modalidad: ModalidadOperable
  medioSugerido: MedioSugerido
}

type AgendaDraft = {
  fecha: string
  hora: string
  duracion: string
  meetLink: string
  notasDocumentos: string
}

const ACTIVIDADES_FORM_INICIAL: ActividadesFormState = {
  casatalentos: false,
  "conectando-sentidos": false,
  mentorias: false,
  terapia: false,
}

const FORM_INICIAL: FormState = {
  id: "",
  nombre: "",
  apellido: "",
  email: "",
  whatsapp: "",
  fechaCumpleanos: "",
  notasDocumentos: "",
  charlaIntroHabilitada: false,
  role: "participante",
  activo: true,
  password: "",
  enviarBienvenida: true,
  actividades: ACTIVIDADES_FORM_INICIAL,
}

const ACTIVIDADES = [
  { slug: "casatalentos", nombre: "CasaTalentos" },
  { slug: "conectando-sentidos", nombre: "Conectando Sentidos" },
  { slug: "mentorias", nombre: "Mentorías" },
  { slug: "terapia", nombre: "Terapia" },
] as const

const MODALIDADES_OPERABLES: Array<{
  value: ModalidadOperable
  label: string
}> = [
  { value: "mensual", label: "Mensual" },
  { value: "por_sesion", label: "Por sesión" },
  { value: "por_proceso", label: "Por proceso" },
  { value: "becado", label: "Becado" },
  { value: "invitado", label: "Invitado" },
  { value: "sin_cobro", label: "Sin cobro" },
]

const MEDIOS_SUGERIDOS: Array<{
  value: MedioSugerido
  label: string
}> = [
  { value: "", label: "Sin definir" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercado_pago", label: "Mercado Pago" },
  { value: "manual", label: "Manual" },
]

const ACTIVIDADES_INDIVIDUALES = new Set(["mentorias", "terapia"])

function etiquetaRol(role: Usuario["role"]) {
  switch (role) {
    case "admin":
      return "Admin"
    case "colaborador":
      return "Colaborador"
    case "participante":
      return "Participante"
  }
}

function etiquetaEstadoGeneral(
  estado: PersonaResumen["resumen"]["estadoGeneral"]
) {
  switch (estado) {
    case "ok":
      return {
        texto: "OK",
        className:
          "border-[rgba(52,125,89,0.2)] bg-[rgba(52,125,89,0.1)] text-[rgb(52,125,89)]",
      }
    case "atencion":
      return {
        texto: "Atención",
        className:
          "border-[rgba(201,139,27,0.2)] bg-[rgba(201,139,27,0.1)] text-[rgb(154,101,21)]",
      }
    case "inconsistente":
      return {
        texto: "Inconsistente",
        className:
          "border-[rgba(156,69,59,0.2)] bg-[rgba(156,69,59,0.1)] text-[rgb(156,69,59)]",
      }
  }
}

function etiquetaActividadEstado(estado: ActividadResumen["estadoVisible"]) {
  switch (estado) {
    case "activa":
      return "Activa"
    case "charla":
      return "Charla"
    case "inactiva":
      return "Inactiva"
    case "sin_configurar":
      return "Sin configurar"
    case "inconsistente":
      return "Inconsistente"
  }
}

function etiquetaAccesoMotivo(motivo: ActividadResumen["accesoMotivo"]) {
  switch (motivo) {
    case "ok":
      return "Acceso esperado OK"
    case "gracia":
      return "Dentro de gracia"
    case "sin_inscripcion":
      return "Sin inscripción"
    case "sin_honorario":
      return "Sin honorario"
    case "sin_pago":
      return "Sin pago vigente"
    case "bloqueado":
      return "Bloqueado"
    case "charla":
      return "Circuito de charla"
    case "no_aplica":
      return "No aplica"
  }
}

function etiquetaModalidad(modalidad: EconomiaResumen["modalidad"]) {
  switch (modalidad) {
    case "mensual":
      return "Mensual"
    case "por_sesion":
      return "Por sesión"
    case "por_proceso":
      return "Por proceso"
    case "becado":
      return "Becado"
    case "invitado":
      return "Invitado"
    case "sin_cobro":
      return "Sin cobro"
    case "desconocida":
      return "Sin configurar"
  }
}

function normalizarModalidadOperable(
  modalidad?: EconomiaResumen["modalidad"] | string | null
): ModalidadOperable {
  if (
    modalidad === "mensual" ||
    modalidad === "por_sesion" ||
    modalidad === "por_proceso" ||
    modalidad === "becado" ||
    modalidad === "invitado" ||
    modalidad === "sin_cobro"
  ) {
    return modalidad
  }

  return "mensual"
}

function estadoPagoLabel(estado?: string | null) {
  switch (estado) {
    case "pagado":
      return "Pagado"
    case "en_revision":
      return "En revisión"
    case "pendiente":
      return "Pendiente"
    case "rechazado":
      return "Rechazado"
    default:
      return estado || "Sin pago"
  }
}

function medioPagoLabel(medio?: string | null) {
  switch (medio) {
    case "transferencia":
      return "Transferencia"
    case "mercado_pago":
      return "Mercado Pago"
    case "manual":
      return "Manual"
    case "sin_cargo":
      return "Sin cargo"
    default:
      return medio || "Sin definir"
  }
}

function descripcionAlertaNivel(nivel: AlertaResumen["nivel"]) {
  switch (nivel) {
    case "error":
      return "border-[rgba(156,69,59,0.18)] bg-[rgba(156,69,59,0.08)] text-[rgb(156,69,59)]"
    case "warning":
      return "border-[rgba(201,139,27,0.18)] bg-[rgba(201,139,27,0.08)] text-[rgb(154,101,21)]"
    case "info":
      return "border-[rgba(45,107,122,0.18)] bg-[rgba(45,107,122,0.08)] text-[rgb(45,107,122)]"
  }
}

function formatearEncuentro(item: AgendaResumen["proximoEncuentro"]) {
  if (!item?.inicio) return "Sin próximo encuentro"
  return item.inicio
}

function nombreActividad(slug: string) {
  switch (slug) {
    case "casatalentos":
      return "CasaTalentos"
    case "conectando-sentidos":
      return "Conectando Sentidos"
    case "mentorias":
      return "Mentorías"
    case "terapia":
      return "Terapia"
    case "charla-introductoria":
      return "Charla introductoria"
    default:
      return slug
  }
}

function actividadKey(email: string, actividad: string) {
  return `${email}:${actividad}`
}

function crearDraftEconomia(
  economia?: EconomiaResumen | null
): EconomiaDraft {
  return {
    monto: economia?.monto != null ? String(economia.monto) : "",
    moneda: economia?.moneda || "ARS",
    modalidad: normalizarModalidadOperable(economia?.modalidad),
    medioSugerido:
      economia?.medioSugerido === "transferencia" ||
      economia?.medioSugerido === "mercado_pago" ||
      economia?.medioSugerido === "manual"
        ? economia.medioSugerido
        : "",
  }
}

function economiaDraftTieneCambios(
  draft: EconomiaDraft,
  economia?: EconomiaResumen | null
) {
  const base = crearDraftEconomia(economia)

  return (
    String(draft.monto || "").trim() !== String(base.monto || "").trim() ||
    String(draft.moneda || "").trim().toUpperCase() !==
      String(base.moneda || "").trim().toUpperCase() ||
    draft.modalidad !== base.modalidad ||
    draft.medioSugerido !== base.medioSugerido
  )
}

function crearDraftAgenda(): AgendaDraft {
  return {
    fecha: "",
    hora: "",
    duracion: "60",
    meetLink: "",
    notasDocumentos: "",
  }
}

function construirActividadesDesdePersona(persona: PersonaResumen): ActividadesFormState {
  const porSlug = new Map(persona.actividades.map((item) => [item.actividad, item]))
  return {
    casatalentos: Boolean(
      porSlug.get("casatalentos")?.marcadaEnUsuarioActividades ||
        porSlug.get("casatalentos")?.inscripcionActiva
    ),
    "conectando-sentidos": Boolean(
      porSlug.get("conectando-sentidos")?.marcadaEnUsuarioActividades ||
        porSlug.get("conectando-sentidos")?.inscripcionActiva
    ),
    mentorias: Boolean(
      porSlug.get("mentorias")?.marcadaEnUsuarioActividades ||
        porSlug.get("mentorias")?.inscripcionActiva
    ),
    terapia: Boolean(
      porSlug.get("terapia")?.marcadaEnUsuarioActividades ||
        porSlug.get("terapia")?.inscripcionActiva
    ),
  }
}

function InfoItem({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className="text-sm text-gray-800">{value || "—"}</p>
    </div>
  )
}

function BloqueFicha({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white/65 p-4">
      <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--sea)]">
        {titulo}
      </h4>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export default function AdminUsuariosPage() {
  const { data: session, status } = useAppSession()
  const router = useRouter()

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [personas, setPersonas] = useState<PersonaResumen[]>([])
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [mensaje, setMensaje] = useState("")
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [actividadGuardandoKey, setActividadGuardandoKey] = useState<string | null>(
    null
  )
  const [economiaDrafts, setEconomiaDrafts] = useState<
    Record<string, EconomiaDraft>
  >({})
  const [economiaGuardandoKey, setEconomiaGuardandoKey] = useState<string | null>(
    null
  )
  const [economiaMensajes, setEconomiaMensajes] = useState<
    Record<string, { tipo: "exito" | "error" | "info"; texto: string }>
  >({})
  const [pagoGuardandoKey, setPagoGuardandoKey] = useState<string | null>(null)
  const [agendaDrafts, setAgendaDrafts] = useState<Record<string, AgendaDraft>>({})
  const [agendaGuardandoKey, setAgendaGuardandoKey] = useState<string | null>(null)
  const [agendaMensajes, setAgendaMensajes] = useState<
    Record<string, { tipo: "exito" | "error"; texto: string }>
  >({})

  const esAdmin = session?.user?.role === "admin"
  const editando = Boolean(form.id)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [router, status])

  const cargarUsuarios = useCallback(async () => {
    const res = await fetch("/api/admin/usuarios", { cache: "no-store" })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || "No se pudieron cargar los usuarios.")
    }
    setUsuarios(data.usuarios || [])
  }, [])

  const cargarPersonas = useCallback(async () => {
    const res = await fetch("/api/admin/personas/resumen", { cache: "no-store" })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || "No se pudo cargar el resumen de personas.")
    }
    setPersonas(data.personas || [])
  }, [])

  useEffect(() => {
    if (status === "authenticated" && esAdmin) {
      void (async () => {
        try {
          setCargando(true)
          setMensaje("")
          await Promise.all([cargarUsuarios(), cargarPersonas()])
        } catch (error) {
          setMensaje(String(error))
        } finally {
          setCargando(false)
        }
      })()
    }
  }, [cargarPersonas, cargarUsuarios, esAdmin, status])

  const usuarioBasePorEmail = useMemo(() => {
    const mapa = new Map<string, Usuario>()
    for (const usuario of usuarios) {
      mapa.set(usuario.email.trim().toLowerCase(), usuario)
    }
    return mapa
  }, [usuarios])

  const personasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return personas

    return personas.filter((persona) => {
      const actividadTexto = persona.actividades
        .map(
          (item) =>
            `${item.etiqueta} ${item.actividad} ${item.estadoVisible} ${item.accesoMotivo}`
        )
        .join(" ")
        .toLowerCase()

      const alertasTexto = persona.alertas
        .map((item) => `${item.titulo} ${item.detalle}`)
        .join(" ")
        .toLowerCase()

      return (
        persona.perfil.nombre.toLowerCase().includes(q) ||
        persona.perfil.apellido.toLowerCase().includes(q) ||
        persona.perfil.nombreCompleto.toLowerCase().includes(q) ||
        persona.perfil.email.toLowerCase().includes(q) ||
        persona.perfil.role.toLowerCase().includes(q) ||
        actividadTexto.includes(q) ||
        alertasTexto.includes(q) ||
        (persona.perfil.charlaIntroHabilitada &&
          "charla introductoria charla grabacion".includes(q))
      )
    })
  }, [busqueda, personas])

  const gruposPersonas = useMemo(() => {
    const grupos = {
      charlaIntroductoria: [] as PersonaResumen[],
      participantesActivos: [] as PersonaResumen[],
      usuariosSinActividad: [] as PersonaResumen[],
      equipoInterno: [] as PersonaResumen[],
      usuariosInactivos: [] as PersonaResumen[],
    }

    for (const persona of personasFiltradas) {
      if (!persona.perfil.activo) {
        grupos.usuariosInactivos.push(persona)
        continue
      }

      if (persona.perfil.role === "admin" || persona.perfil.role === "colaborador") {
        grupos.equipoInterno.push(persona)
        continue
      }

      if (persona.perfil.charlaIntroHabilitada) {
        grupos.charlaIntroductoria.push(persona)
        continue
      }

      if (persona.resumen.actividadesActivas > 0) {
        grupos.participantesActivos.push(persona)
        continue
      }

      grupos.usuariosSinActividad.push(persona)
    }

    return grupos
  }, [personasFiltradas])

  const limpiarForm = () => {
    setForm({
      ...FORM_INICIAL,
      actividades: { ...ACTIVIDADES_FORM_INICIAL },
    })
  }

  const recargarTodo = useCallback(async () => {
    await Promise.all([cargarUsuarios(), cargarPersonas()])
  }, [cargarPersonas, cargarUsuarios])

  const actualizarDraftEconomia = useCallback(
    (
      email: string,
      actividad: string,
      patch: Partial<EconomiaDraft>,
      economiaBase?: EconomiaResumen | null
    ) => {
      const key = actividadKey(email, actividad)
      setEconomiaDrafts((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || crearDraftEconomia(economiaBase)),
          ...patch,
        },
      }))
    },
    []
  )

  const obtenerDraftEconomia = useCallback(
    (email: string, actividad: string, economiaBase?: EconomiaResumen | null) => {
      const key = actividadKey(email, actividad)
      return economiaDrafts[key] || crearDraftEconomia(economiaBase)
    },
    [economiaDrafts]
  )

  const actualizarDraftAgenda = useCallback(
    (email: string, actividad: string, patch: Partial<AgendaDraft>) => {
      const key = actividadKey(email, actividad)
      setAgendaDrafts((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || crearDraftAgenda()),
          ...patch,
        },
      }))
    },
    []
  )

  const obtenerDraftAgenda = useCallback(
    (email: string, actividad: string) => {
      const key = actividadKey(email, actividad)
      return agendaDrafts[key] || crearDraftAgenda()
    },
    [agendaDrafts]
  )

  const editarUsuario = (usuario: Usuario, persona?: PersonaResumen) => {
    const resumen = persona || personas.find((item) => item.email === usuario.email.trim().toLowerCase())
    setForm({
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido || "",
      email: usuario.email,
      whatsapp: usuario.whatsapp || "",
      fechaCumpleanos: usuario.fecha_cumpleanos || "",
      notasDocumentos: serializarDocumentosNotas(usuario.notas_documentos),
      charlaIntroHabilitada: usuario.charla_intro_habilitada === true,
      role: usuario.role,
      activo: usuario.activo,
      password: "",
      enviarBienvenida: false,
      actividades: resumen ? construirActividadesDesdePersona(resumen) : { ...ACTIVIDADES_FORM_INICIAL },
    })
    setMensaje("Editando usuario. Dejá la clave de acceso vacía si no querés cambiarla.")
  }

  const guardarUsuario = async (payload: FormState = form) => {
    try {
      setGuardando(true)
      setMensaje("")

      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudo guardar el usuario.")
        return
      }

      const mailing = data.mailing as
        | { enviado?: boolean; motivo?: string }
        | null
        | undefined

      const mailingMensaje = mailing
        ? mailing.enviado
          ? payload.charlaIntroHabilitada
            ? " Email de invitación a la charla enviado."
            : " Email de bienvenida enviado."
          : ` ${mailing.motivo || "Email no enviado."}`
        : ""

      let actividadesMensaje = ""
      const usuarioGuardado = data.usuario as Usuario | undefined

      if (usuarioGuardado?.email) {
        const resActividades = await fetch("/api/admin/usuario-actividades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usuarioEmail: usuarioGuardado.email,
            actividades: ACTIVIDADES.map((actividad) => ({
              actividadSlug: actividad.slug,
              habilitada: payload.actividades[actividad.slug],
            })),
          }),
        })

        const dataActividades = await resActividades.json()

        if (!resActividades.ok) {
          actividadesMensaje =
            " Usuario guardado, pero no se pudieron sincronizar las actividades."
        } else {
          const provisioning = dataActividades.provisioning as
            | {
                honorariosCreados?: number
                pagosCreados?: number
                advertencias?: string[]
              }
            | undefined

          const extras: string[] = []

          if ((provisioning?.honorariosCreados || 0) > 0) {
            extras.push(
              `Se creó ${provisioning?.honorariosCreados} honorario base automáticamente.`
            )
          }

          if ((provisioning?.pagosCreados || 0) > 0) {
            extras.push(
              `Se generó ${provisioning?.pagosCreados} cobro vigente automáticamente.`
            )
          }

          if (
            Array.isArray(provisioning?.advertencias) &&
            provisioning?.advertencias.length > 0
          ) {
            extras.push(provisioning.advertencias.join(" "))
          }

          actividadesMensaje = extras.length ? ` ${extras.join(" ")}` : ""
        }
      }

      setMensaje(
        `${payload.id ? "Usuario actualizado." : "Usuario creado."}${mailingMensaje}${actividadesMensaje}`
      )

      limpiarForm()
      await Promise.all([cargarUsuarios(), cargarPersonas()])
    } catch {
      setMensaje("Error guardando usuario.")
    } finally {
      setGuardando(false)
    }
  }

  const guardarCharlaIntroDesdeFicha = useCallback(
    async (persona: PersonaResumen, habilitada: boolean) => {
      const usuario = usuarioBasePorEmail.get(persona.email)
      if (!usuario) return

      const key = actividadKey(persona.email, "charla-introductoria")

      try {
        setActividadGuardandoKey(key)
        setMensaje("")
        await guardarUsuario({
          id: usuario.id,
          nombre: usuario.nombre,
          apellido: usuario.apellido || "",
          email: usuario.email,
          whatsapp: usuario.whatsapp || "",
          fechaCumpleanos: usuario.fecha_cumpleanos || "",
          notasDocumentos: serializarDocumentosNotas(usuario.notas_documentos),
          charlaIntroHabilitada: habilitada,
          role: usuario.role,
          activo: usuario.activo,
          password: "",
          enviarBienvenida: false,
          actividades: construirActividadesDesdePersona(persona),
        })
      } finally {
        setActividadGuardandoKey(null)
      }
    },
    [guardarUsuario, usuarioBasePorEmail]
  )

  const guardarActividadesDesdeFicha = useCallback(
    async (
      persona: PersonaResumen,
      cambios: Partial<ActividadesFormState>,
      mensajeOk: string
    ) => {
      const usuario = usuarioBasePorEmail.get(persona.email)
      if (!usuario) return

      const actividades = {
        ...construirActividadesDesdePersona(persona),
        ...cambios,
      }

      try {
        const actividadPrincipal =
          Object.keys(cambios)[0] || Object.keys(actividades)[0]
        setActividadGuardandoKey(actividadKey(persona.email, actividadPrincipal))
        setMensaje("")

        const res = await fetch("/api/admin/usuario-actividades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usuarioEmail: usuario.email,
            actividades: ACTIVIDADES.map((actividad) => ({
              actividadSlug: actividad.slug,
              habilitada: actividades[actividad.slug],
            })),
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(
            data.error || "No se pudieron actualizar las actividades."
          )
        }

        const provisioning = data.provisioning as
          | {
              honorariosCreados?: number
              pagosCreados?: number
              advertencias?: string[]
            }
          | undefined

        const extras: string[] = []

        if ((provisioning?.honorariosCreados || 0) > 0) {
          extras.push(
            `Se creó ${provisioning?.honorariosCreados} honorario base automáticamente.`
          )
        }

        if ((provisioning?.pagosCreados || 0) > 0) {
          extras.push(
            `Se generó ${provisioning?.pagosCreados} cobro vigente automáticamente.`
          )
        }

        if (Array.isArray(provisioning?.advertencias) && provisioning.advertencias.length > 0) {
          extras.push(provisioning.advertencias.join(" "))
        }

        setMensaje([mensajeOk, ...extras].join(" ").trim())
        await recargarTodo()
      } catch (error) {
        setMensaje(
          error instanceof Error
            ? error.message
            : "No se pudieron actualizar las actividades."
        )
      } finally {
        setActividadGuardandoKey(null)
      }
    },
    [recargarTodo, usuarioBasePorEmail]
  )

  const guardarEconomiaDesdeFicha = useCallback(
    async (
      persona: PersonaResumen,
      actividadSlug: EconomiaResumen["actividad"],
      economiaBase?: EconomiaResumen | null,
      draftOverride?: EconomiaDraft
    ) => {
      const draft =
        draftOverride ||
        obtenerDraftEconomia(persona.email, actividadSlug, economiaBase)
      const key = actividadKey(persona.email, actividadSlug)

      try {
        setEconomiaGuardandoKey(key)
        setMensaje("")
        setEconomiaMensajes((prev) => {
          const siguiente = { ...prev }
          delete siguiente[key]
          return siguiente
        })

        const actividadActual = persona.actividades.find(
          (item) => item.actividad === actividadSlug
        )

        if (!actividadActual?.inscripcionActiva || !actividadActual.marcadaEnUsuarioActividades) {
          await guardarActividadesDesdeFicha(
            persona,
            { [actividadSlug]: true } as Partial<ActividadesFormState>,
            `${nombreActividad(actividadSlug)} quedó habilitada.`
          )
        }

        const res = await fetch("/admin/pagos-mensuales/honorarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actividadSlug,
            participanteEmail: persona.email,
            participanteNombre: persona.perfil.nombreCompleto,
            honorarioMensual: draft.monto || 0,
            modalidadPago: draft.modalidad,
            moneda: draft.moneda || "ARS",
            medioSugerido: draft.medioSugerido || null,
            activo: true,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "No se pudo guardar la economía.")
        }

        setEconomiaMensajes((prev) => ({
          ...prev,
          [key]: {
            tipo: data.advertencia ? "info" : "exito",
            texto: data.advertencia
              ? `Economía de ${nombreActividad(actividadSlug)} actualizada. ${data.advertencia}`
              : `Economía de ${nombreActividad(actividadSlug)} actualizada.`,
          },
        }))
        await recargarTodo()
      } catch (error) {
        setEconomiaMensajes((prev) => ({
          ...prev,
          [key]: {
            tipo: "error",
            texto:
              error instanceof Error
                ? error.message
                : "No se pudo guardar la economía.",
          },
        }))
      } finally {
        setEconomiaGuardandoKey(null)
      }
    },
    [guardarActividadesDesdeFicha, obtenerDraftEconomia, recargarTodo]
  )

  const aplicarPresetEconomico = useCallback(
    async (
      persona: PersonaResumen,
      actividadSlug: EconomiaResumen["actividad"],
      modalidad: Extract<
        ModalidadOperable,
        "becado" | "invitado" | "sin_cobro"
      >
    ) => {
      const draftPreset: EconomiaDraft = {
        monto: "0",
        moneda: "ARS",
        modalidad,
        medioSugerido: "",
      }

      actualizarDraftEconomia(
        persona.email,
        actividadSlug,
        draftPreset,
        persona.economia.find((item) => item.actividad === actividadSlug) || null
      )

      await guardarEconomiaDesdeFicha(
        persona,
        actividadSlug,
        persona.economia.find((item) => item.actividad === actividadSlug) || null,
        draftPreset
      )
    },
    [actualizarDraftEconomia, guardarEconomiaDesdeFicha]
  )

  const generarCobroDesdeFicha = useCallback(
    async (persona: PersonaResumen, actividadSlug: EconomiaResumen["actividad"]) => {
      const key = actividadKey(persona.email, `${actividadSlug}:cobro`)
      const economiaKey = actividadKey(persona.email, actividadSlug)
      const economiaBase =
        persona.economia.find((item) => item.actividad === actividadSlug) || null
      const draft = obtenerDraftEconomia(persona.email, actividadSlug, economiaBase)

      try {
        setPagoGuardandoKey(key)
        setMensaje("")
        setEconomiaMensajes((prev) => {
          const siguiente = { ...prev }
          delete siguiente[economiaKey]
          return siguiente
        })

        if (economiaDraftTieneCambios(draft, economiaBase)) {
          throw new Error(
            "Guardá primero los cambios de economía antes de generar el cobro."
          )
        }

        const res = await fetch("/api/pagos-mensuales/obtener-o-crear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actividadSlug,
            participanteNombre: persona.perfil.nombreCompleto,
            participanteEmail: persona.email,
          }),
        })

        const data = (await res.json()) as {
          error?: string
          accion?: "creado" | "existente" | "no_generable"
          motivo?: string
        }

        if (!res.ok) {
          throw new Error(data.error || "No se pudo generar el cobro.")
        }

        const texto =
          data.accion === "creado"
            ? `Cobro vigente de ${nombreActividad(actividadSlug)} creado.`
            : data.accion === "existente"
              ? data.motivo || `Ya existía un cobro vigente de ${nombreActividad(actividadSlug)}.`
              : data.motivo || "Esta modalidad no genera un cobro mensual."

        setEconomiaMensajes((prev) => ({
          ...prev,
          [economiaKey]: {
            tipo: data.accion === "no_generable" ? "info" : "exito",
            texto,
          },
        }))
        await recargarTodo()
      } catch (error) {
        setEconomiaMensajes((prev) => ({
          ...prev,
          [economiaKey]: {
            tipo: "error",
            texto:
              error instanceof Error
                ? error.message
                : "No se pudo generar el cobro.",
          },
        }))
      } finally {
        setPagoGuardandoKey(null)
      }
    },
    [obtenerDraftEconomia, recargarTodo]
  )

  const resolverPagoDesdeFicha = useCallback(
    async (
      persona: PersonaResumen,
      pagoId: string,
      accion: "aprobar" | "rechazar"
    ) => {
      const key = actividadKey(persona.email, `pago:${pagoId}`)

      try {
        setPagoGuardandoKey(key)
        setMensaje("")

        const res = await fetch("/admin/pagos-mensuales/resolver", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pagoMensualId: Number(pagoId),
            accion,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "No se pudo resolver el pago.")
        }

        setMensaje(
          accion === "aprobar"
            ? "Pago aprobado desde la ficha."
            : "Pago rechazado desde la ficha."
        )
        await recargarTodo()
      } catch (error) {
        setMensaje(
          error instanceof Error ? error.message : "No se pudo resolver el pago."
        )
      } finally {
        setPagoGuardandoKey(null)
      }
    },
    [recargarTodo]
  )

  const resolverReservaDesdeFicha = useCallback(
    async (
      persona: PersonaResumen,
      reservaId: string,
      accion: "aprobar" | "rechazar"
    ) => {
      const key = actividadKey(persona.email, `reserva:${reservaId}`)

      try {
        setPagoGuardandoKey(key)
        setMensaje("")

        const res = await fetch("/api/terapia/admin/resolver-pago-reserva", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservaId: Number(reservaId),
            accion,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "No se pudo resolver la reserva.")
        }

        setMensaje(
          accion === "aprobar"
            ? data.advertencia
              ? `Reserva aprobada. ${data.advertencia}`
              : "Reserva aprobada desde la ficha."
            : "Reserva rechazada desde la ficha."
        )
        await recargarTodo()
      } catch (error) {
        setMensaje(
          error instanceof Error
            ? error.message
            : "No se pudo resolver la reserva."
        )
      } finally {
        setPagoGuardandoKey(null)
      }
    },
    [recargarTodo]
  )

  const crearEncuentroDesdeFicha = useCallback(
    async (
      persona: PersonaResumen,
      actividadSlug: Extract<EconomiaResumen["actividad"], "mentorias" | "terapia">
    ) => {
      const key = actividadKey(persona.email, `${actividadSlug}:agenda`)
      const draft = obtenerDraftAgenda(persona.email, actividadSlug)

      try {
        setAgendaGuardandoKey(key)
        setMensaje("")
        setAgendaMensajes((prev) => {
          const siguiente = { ...prev }
          delete siguiente[key]
          return siguiente
        })

        if (!draft.fecha || !draft.hora) {
          throw new Error("Completá fecha y hora para crear el encuentro.")
        }

        const res = await fetch("/api/agenda/admin/crear-disponibilidades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [
              {
                titulo:
                  actividadSlug === "mentorias"
                    ? `Mentoría · ${persona.perfil.nombreCompleto}`
                    : `Terapia · ${persona.perfil.nombreCompleto}`,
                tipo: actividadSlug === "mentorias" ? "reunion" : "sesion",
                actividad_slug: actividadSlug,
                modo: "actividad_fija",
                fecha: draft.fecha,
                hora: draft.hora,
                duracion: draft.duracion || "60",
                meet_link: draft.meetLink.trim(),
                requiere_pago: true,
                precio: "0",
                estado: "confirmada",
                es_recurrente: false,
                sync_status: "pendiente",
                participante_email: persona.email,
                participante_nombre: persona.perfil.nombreCompleto,
                notas_documentos: draft.notasDocumentos,
              },
            ],
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "No se pudo crear el encuentro.")
        }

        setAgendaDrafts((prev) => ({
          ...prev,
          [actividadKey(persona.email, actividadSlug)]: crearDraftAgenda(),
        }))
        setAgendaMensajes((prev) => ({
          ...prev,
          [key]: {
            tipo: "exito",
            texto: `Encuentro de ${nombreActividad(actividadSlug)} creado.`,
          },
        }))
        await recargarTodo()
      } catch (error) {
        setAgendaMensajes((prev) => ({
          ...prev,
          [key]: {
            tipo: "error",
            texto:
              error instanceof Error
                ? error.message
                : "No se pudo crear el encuentro.",
          },
        }))
      } finally {
        setAgendaGuardandoKey(null)
      }
    },
    [obtenerDraftAgenda, recargarTodo]
  )

  const renderActividad = (persona: PersonaResumen, actividad: ActividadResumen) => {
    const key = actividadKey(persona.email, actividad.actividad)
    const estaGuardando = actividadGuardandoKey === key

    if (actividad.actividad === "charla-introductoria") {
      return (
        <div
          key={actividad.actividad}
          className="rounded-xl border border-[var(--line)] bg-[rgba(255,250,242,0.7)] p-3 text-sm"
        >
          <div className="flex flex-wrap items-center gap-2">
            <strong>{actividad.etiqueta}</strong>
            <span className="workspace-chip">
              {persona.perfil.charlaIntroHabilitada ? "Habilitada" : "No habilitada"}
            </span>
          </div>
          <p className="mt-1 text-gray-700">
            {persona.perfil.charlaIntroHabilitada
              ? "La persona tiene acceso al circuito actual de charla/grabación."
              : "La charla introductoria no está habilitada para esta persona."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={estaGuardando}
              onClick={() =>
                void guardarCharlaIntroDesdeFicha(
                  persona,
                  !persona.perfil.charlaIntroHabilitada
                )
              }
              className="workspace-button-secondary !px-3 !py-1.5 text-xs"
            >
              {estaGuardando
                ? "Guardando..."
                : persona.perfil.charlaIntroHabilitada
                  ? "Desactivar charla"
                  : "Activar charla"}
            </button>
          </div>
        </div>
      )
    }

    return (
      <div
        key={actividad.actividad}
        className="rounded-xl border border-[var(--line)] bg-[rgba(255,250,242,0.7)] p-3 text-sm"
      >
        <div className="flex flex-wrap items-center gap-2">
          <strong>{actividad.etiqueta}</strong>
          <span className="workspace-chip">
            {etiquetaActividadEstado(actividad.estadoVisible)}
          </span>
        </div>
        <p className="mt-1 text-gray-700">
          {etiquetaAccesoMotivo(actividad.accesoMotivo)}
        </p>
        <p className="mt-1 text-gray-500">
          Marcada: {actividad.marcadaEnUsuarioActividades ? "Sí" : "No"} ·
          Inscripción: {actividad.inscripcionActiva ? " Activa" : " No"}
        </p>
        {actividad.observaciones.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-gray-600">
            {actividad.observaciones.map((item) => (
              <li key={`${actividad.actividad}-${item}`}>{item}</li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={estaGuardando}
            onClick={() =>
              void guardarActividadesDesdeFicha(
                persona,
                {
                  [actividad.actividad]:
                    !(actividad.marcadaEnUsuarioActividades || actividad.inscripcionActiva),
                } as Partial<ActividadesFormState>,
                actividad.marcadaEnUsuarioActividades || actividad.inscripcionActiva
                  ? `${actividad.etiqueta} quedó deshabilitada desde la ficha.`
                  : `${actividad.etiqueta} quedó habilitada desde la ficha.`
              )
            }
            className="workspace-button-secondary !px-3 !py-1.5 text-xs"
          >
            {estaGuardando
              ? "Guardando..."
              : actividad.marcadaEnUsuarioActividades || actividad.inscripcionActiva
                ? "Deshabilitar"
                : "Habilitar"}
          </button>

          {actividad.actividad === "casatalentos" ||
          actividad.actividad === "conectando-sentidos" ||
          actividad.actividad === "mentorias" ||
          actividad.actividad === "terapia" ? (
            <>
              <button
                type="button"
                disabled={economiaGuardandoKey === key}
                onClick={() =>
                  void aplicarPresetEconomico(
                    persona,
                    actividad.actividad as EconomiaResumen["actividad"],
                    "becado"
                  )
                }
                className="workspace-button-secondary !px-3 !py-1.5 text-xs"
              >
                Becado
              </button>
              <button
                type="button"
                disabled={economiaGuardandoKey === key}
                onClick={() =>
                  void aplicarPresetEconomico(
                    persona,
                    actividad.actividad as EconomiaResumen["actividad"],
                    "invitado"
                  )
                }
                className="workspace-button-secondary !px-3 !py-1.5 text-xs"
              >
                Invitado
              </button>
              <button
                type="button"
                disabled={economiaGuardandoKey === key}
                onClick={() =>
                  void aplicarPresetEconomico(
                    persona,
                    actividad.actividad as EconomiaResumen["actividad"],
                    "sin_cobro"
                  )
                }
                className="workspace-button-secondary !px-3 !py-1.5 text-xs"
              >
                Sin cobro
              </button>
            </>
          ) : null}
        </div>
      </div>
    )
  }

  const renderEconomia = (persona: PersonaResumen, economia: EconomiaResumen) => {
    const key = actividadKey(persona.email, economia.actividad)
    const draft = obtenerDraftEconomia(persona.email, economia.actividad, economia)
    const guardando = economiaGuardandoKey === key
    const mensajeEconomia = economiaMensajes[key]

    return (
      <div
        key={economia.actividad}
        className="rounded-xl border border-[var(--line)] bg-[rgba(255,250,242,0.7)] p-3 text-sm"
      >
        <div className="flex flex-wrap items-center gap-2">
          <strong>{economia.etiqueta}</strong>
          <span className="workspace-chip">{etiquetaModalidad(economia.modalidad)}</span>
        </div>
        <p className="mt-1 text-gray-700">
          {economia.monto != null
            ? `${economia.moneda || "ARS"} ${economia.monto}`
            : "Sin honorario visible"}
        </p>
        <p className="mt-1 text-gray-500">
          Último pago: <strong>{estadoPagoLabel(economia.ultimoPago?.estado)}</strong>
          {economia.ultimoPago?.periodo ? ` · ${economia.ultimoPago.periodo}` : ""}
        </p>
        <p className="mt-1 text-gray-500">
          Medio sugerido: {economia.medioSugerido || "Sin definir"}
        </p>
        {mensajeEconomia && (
          <p
            className={`mt-3 rounded-xl border px-3 py-2 text-xs font-medium ${
              mensajeEconomia.tipo === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : mensajeEconomia.tipo === "info"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {mensajeEconomia.texto}
          </p>
        )}

        <div className="mt-3 grid gap-3 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-600">Monto</span>
            <input
              className="workspace-field"
              value={draft.monto}
              onChange={(e) =>
                actualizarDraftEconomia(
                  persona.email,
                  economia.actividad,
                  { monto: e.target.value },
                  economia
                )
              }
              placeholder="0"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-600">Moneda</span>
            <input
              className="workspace-field"
              value={draft.moneda}
              onChange={(e) =>
                actualizarDraftEconomia(
                  persona.email,
                  economia.actividad,
                  { moneda: e.target.value.toUpperCase() },
                  economia
                )
              }
              placeholder="ARS"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-600">Modalidad</span>
            <select
              className="workspace-field"
              value={draft.modalidad}
              onChange={(e) =>
                actualizarDraftEconomia(
                  persona.email,
                  economia.actividad,
                  { modalidad: e.target.value as ModalidadOperable },
                  economia
                )
              }
            >
              {MODALIDADES_OPERABLES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-600">
              Medio sugerido
            </span>
            <select
              className="workspace-field"
              value={draft.medioSugerido}
              onChange={(e) =>
                actualizarDraftEconomia(
                  persona.email,
                  economia.actividad,
                  { medioSugerido: e.target.value as MedioSugerido },
                  economia
                )
              }
            >
              {MEDIOS_SUGERIDOS.map((option) => (
                <option key={option.value || "sin-definir"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={guardando}
            onClick={() => void guardarEconomiaDesdeFicha(persona, economia.actividad, economia)}
            className="workspace-button-secondary !px-3 !py-1.5 text-xs"
          >
            {guardando ? "Guardando..." : "Guardar economía"}
          </button>
          <button
            type="button"
            disabled={pagoGuardandoKey === actividadKey(persona.email, `${economia.actividad}:cobro`)}
            onClick={() => void generarCobroDesdeFicha(persona, economia.actividad)}
            className="workspace-button-secondary !px-3 !py-1.5 text-xs"
          >
            {pagoGuardandoKey === actividadKey(persona.email, `${economia.actividad}:cobro`)
              ? "Generando..."
              : "Generar cobro"}
          </button>
          {economia.ultimoPago?.estado === "en_revision" && economia.ultimoPago.id && (
            <>
              <button
                type="button"
                disabled={pagoGuardandoKey === actividadKey(persona.email, `pago:${economia.ultimoPago.id}`)}
                onClick={() =>
                  void resolverPagoDesdeFicha(persona, economia.ultimoPago!.id!, "aprobar")
                }
                className="workspace-button-secondary !px-3 !py-1.5 text-xs"
              >
                Aprobar pago
              </button>
              <button
                type="button"
                disabled={pagoGuardandoKey === actividadKey(persona.email, `pago:${economia.ultimoPago.id}`)}
                onClick={() =>
                  void resolverPagoDesdeFicha(persona, economia.ultimoPago!.id!, "rechazar")
                }
                className="workspace-button-secondary !px-3 !py-1.5 text-xs"
              >
                Rechazar pago
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  const renderAgenda = (persona: PersonaResumen, item: AgendaResumen) => {
    const agendaKey = actividadKey(persona.email, `${item.actividad}:agenda`)
    const draft = obtenerDraftAgenda(persona.email, item.actividad)
    const guardando = agendaGuardandoKey === agendaKey
    const mensajeAgenda = agendaMensajes[agendaKey]

    return (
      <div
        key={item.actividad}
        className="rounded-xl border border-[var(--line)] bg-[rgba(255,250,242,0.7)] p-3 text-sm"
      >
        <div className="flex flex-wrap items-center gap-2">
          <strong>{nombreActividad(item.actividad)}</strong>
          <span className="workspace-chip">
            {item.tipo === "grupal" ? "Grupal" : "Individual"}
          </span>
        </div>
        <p className="mt-1 text-gray-700">
          Próximo encuentro: {formatearEncuentro(item.proximoEncuentro)}
        </p>
        {item.ultimoEncuentro?.inicio && (
          <p className="mt-1 text-gray-500">
            Último encuentro visible: {item.ultimoEncuentro.inicio}
          </p>
        )}
        {item.notasDocumento && (
          <p className="mt-1 text-gray-500">Notas vinculadas disponibles.</p>
        )}
        <p className="mt-1 text-gray-500">
          Encuentros visibles: {item.cantidadPendientes}
        </p>

        {ACTIVIDADES_INDIVIDUALES.has(item.actividad) ? (
          <div className="mt-3 space-y-3 rounded-xl border border-[var(--line)] bg-white/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sea)]">
              Crear encuentro individual
            </p>
            {mensajeAgenda && (
              <p
                className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                  mensajeAgenda.tipo === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-green-200 bg-green-50 text-green-700"
                }`}
              >
                {mensajeAgenda.texto}
              </p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Fecha</span>
                <input
                  type="date"
                  className="workspace-field"
                  value={draft.fecha}
                  onChange={(e) =>
                    actualizarDraftAgenda(persona.email, item.actividad, {
                      fecha: e.target.value,
                    })
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Hora</span>
                <input
                  type="time"
                  className="workspace-field"
                  value={draft.hora}
                  onChange={(e) =>
                    actualizarDraftAgenda(persona.email, item.actividad, {
                      hora: e.target.value,
                    })
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">
                  Duración (min)
                </span>
                <input
                  className="workspace-field"
                  value={draft.duracion}
                  onChange={(e) =>
                    actualizarDraftAgenda(persona.email, item.actividad, {
                      duracion: e.target.value,
                    })
                  }
                  placeholder="60"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">
                  Meet link
                </span>
                <input
                  className="workspace-field"
                  value={draft.meetLink}
                  onChange={(e) =>
                    actualizarDraftAgenda(persona.email, item.actividad, {
                      meetLink: e.target.value,
                    })
                  }
                  placeholder="https://meet.google.com/..."
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-medium text-gray-600">
                  Notas / documentos
                </span>
                <textarea
                  className="workspace-field min-h-24"
                  value={draft.notasDocumentos}
                  onChange={(e) =>
                    actualizarDraftAgenda(persona.email, item.actividad, {
                      notasDocumentos: e.target.value,
                    })
                  }
                  placeholder="Título | URL"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={guardando}
                onClick={() =>
                  void crearEncuentroDesdeFicha(
                    persona,
                    item.actividad as "mentorias" | "terapia"
                  )
                }
                className="workspace-button-secondary !px-3 !py-1.5 text-xs"
              >
                {guardando ? "Creando..." : "Crear encuentro"}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-500">
            La agenda de {nombreActividad(item.actividad)} se gestiona grupalmente.
          </p>
        )}
      </div>
    )
  }

  const renderHistorialPagos = (persona: PersonaResumen) => {
    if (persona.historialPagos.length === 0) {
      return (
        <p className="text-sm text-gray-600">
          No hay pagos ni comprobantes visibles para esta persona.
        </p>
      )
    }

    const grupos = persona.historialPagos.reduce<Record<string, HistorialPagoResumen[]>>(
      (acc, item) => {
        const key = item.actividad
        acc[key] = acc[key] || []
        acc[key].push(item)
        return acc
      },
      {}
    )

    return (
      <div className="space-y-3">
        {Object.entries(grupos).map(([actividad, items]) => (
          <div
            key={actividad}
            className="rounded-xl border border-[var(--line)] bg-[rgba(255,250,242,0.7)] p-3"
          >
            <div className="flex items-center gap-2">
              <strong className="text-sm">{nombreActividad(actividad)}</strong>
              <span className="workspace-chip">
                {items.length} movimiento/s
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {items.map((item) => {
                const pagoKey = actividadKey(persona.email, item.id)
                const bloqueadoResolver =
                  item.requiereRevisionComprobante && !item.verComprobanteUrl

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[var(--line)] bg-white/80 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {estadoPagoLabel(item.estado)}
                      </span>
                      <span className="workspace-chip">
                        {item.origen === "mensual" ? "Pago mensual" : "Reserva"}
                      </span>
                      {item.periodo && (
                        <span className="text-xs text-[var(--muted)]">
                          {item.periodo}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      <InfoItem
                        label="Monto"
                        value={
                          item.monto != null
                            ? `${item.moneda || "ARS"} ${item.monto}`
                            : "—"
                        }
                      />
                      <InfoItem
                        label="Medio de pago"
                        value={medioPagoLabel(item.medioPago)}
                      />
                      <InfoItem
                        label="Fecha de carga"
                        value={item.fechaCarga}
                      />
                      <InfoItem
                        label="Comprobante"
                        value={item.comprobanteNombreArchivo || "Sin archivo"}
                      />
                    </div>

                    {item.observacionesAdmin && (
                      <div className="mt-3 rounded-xl border border-[var(--line)] bg-[rgba(255,250,242,0.8)] p-3 text-xs text-gray-600">
                        <strong className="block text-[11px] uppercase tracking-[0.14em] text-[var(--sea)]">
                          Observaciones admin
                        </strong>
                        <p className="mt-1 whitespace-pre-wrap">
                          {item.observacionesAdmin}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.verComprobanteUrl ? (
                        <>
                          <a
                            href={item.verComprobanteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="workspace-button-secondary !px-3 !py-1.5 text-xs"
                          >
                            Ver comprobante
                          </a>
                          <a
                            href={item.descargarComprobanteUrl || item.verComprobanteUrl}
                            download
                            className="workspace-button-secondary !px-3 !py-1.5 text-xs"
                          >
                            Descargar comprobante
                          </a>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500">
                          No hay comprobante adjunto.
                        </span>
                      )}

                      {item.puedeResolver && (
                        <>
                          <button
                            type="button"
                            disabled={
                              pagoGuardandoKey === pagoKey || bloqueadoResolver
                            }
                            onClick={() =>
                              item.origen === "mensual"
                                ? void resolverPagoDesdeFicha(
                                    persona,
                                    item.id.replace("mensual:", ""),
                                    "aprobar"
                                  )
                                : void resolverReservaDesdeFicha(
                                    persona,
                                    item.id.replace("reserva:", ""),
                                    "aprobar"
                                  )
                            }
                            className="workspace-button-secondary !px-3 !py-1.5 text-xs"
                          >
                            {pagoGuardandoKey === pagoKey
                              ? "Procesando..."
                              : "Aprobar"}
                          </button>
                          <button
                            type="button"
                            disabled={
                              pagoGuardandoKey === pagoKey || bloqueadoResolver
                            }
                            onClick={() =>
                              item.origen === "mensual"
                                ? void resolverPagoDesdeFicha(
                                    persona,
                                    item.id.replace("mensual:", ""),
                                    "rechazar"
                                  )
                                : void resolverReservaDesdeFicha(
                                    persona,
                                    item.id.replace("reserva:", ""),
                                    "rechazar"
                                  )
                            }
                            className="workspace-button-secondary !px-3 !py-1.5 text-xs"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                    </div>

                    {item.requiereRevisionComprobante && !item.verComprobanteUrl && (
                      <p className="mt-2 text-xs text-[rgb(156,69,59)]">
                        Falta comprobante visible para revisar antes de aprobar.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderAlerta = (alerta: AlertaResumen) => (
    <div
      key={`${alerta.codigo}-${alerta.actividad || "general"}-${alerta.titulo}`}
      className={`rounded-xl border p-3 text-sm ${descripcionAlertaNivel(alerta.nivel)}`}
    >
      <p className="font-semibold">{alerta.titulo}</p>
      <p className="mt-1">{alerta.detalle}</p>
    </div>
  )

  const renderPersonaCard = (persona: PersonaResumen) => {
    const usuario = usuarioBasePorEmail.get(persona.email)
    const documentos = usuario
      ? normalizarDocumentosNotas(usuario.notas_documentos)
      : []
    const estadoGeneral = etiquetaEstadoGeneral(persona.resumen.estadoGeneral)

    return (
      <SeccionDesplegable
        key={persona.id}
        titulo={
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span>{persona.perfil.nombreCompleto}</span>
              <span className="workspace-chip">{etiquetaRol(persona.perfil.role)}</span>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  persona.perfil.activo
                    ? "border-[rgba(52,125,89,0.2)] bg-[rgba(52,125,89,0.1)] text-[rgb(52,125,89)]"
                    : "border-[rgba(156,69,59,0.2)] bg-[rgba(156,69,59,0.1)] text-[rgb(156,69,59)]"
                }`}
              >
                {persona.perfil.activo ? "Activo" : "Inactivo"}
              </span>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-medium ${estadoGeneral.className}`}
              >
                {estadoGeneral.texto}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <span>{persona.perfil.email}</span>
              <span>· {persona.resumen.actividadesActivas} actividad/es activas</span>
              <span>· {persona.resumen.pagosPendientes} pago/s pendiente/s</span>
              <span>
                · Próximo encuentro: {persona.resumen.proximoEncuentro || "Sin agenda"}
              </span>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {usuario && (
              <button
                type="button"
                onClick={() => editarUsuario(usuario, persona)}
                className="workspace-button-secondary"
              >
                Editar perfil
              </button>
            )}

            <Link
              href={`/admin/pagos?participante=${encodeURIComponent(persona.email)}`}
              className="workspace-button-secondary"
            >
              Ver pagos
            </Link>

            <Link
              href={`/agenda?participante=${encodeURIComponent(persona.email)}`}
              className="workspace-button-secondary"
            >
              Ver agenda
            </Link>

            {usuario && (
              <button
                type="button"
                onClick={() =>
                  void guardarUsuario({
                    id: usuario.id,
                    nombre: usuario.nombre,
                    apellido: usuario.apellido || "",
                    email: usuario.email,
                    whatsapp: usuario.whatsapp || "",
                    fechaCumpleanos: usuario.fecha_cumpleanos || "",
                    notasDocumentos: serializarDocumentosNotas(
                      usuario.notas_documentos
                    ),
                    charlaIntroHabilitada:
                      usuario.charla_intro_habilitada === true,
                    role: usuario.role,
                    activo: !usuario.activo,
                    password: "",
                    enviarBienvenida: false,
                    actividades: construirActividadesDesdePersona(persona),
                  })
                }
                className="workspace-button-secondary"
              >
                {usuario.activo ? "Desactivar" : "Reactivar"}
              </button>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <BloqueFicha titulo="Perfil">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoItem label="Nombre" value={persona.perfil.nombre} />
                <InfoItem label="Apellido" value={persona.perfil.apellido} />
                <InfoItem label="Email" value={persona.perfil.email} />
                <InfoItem label="WhatsApp" value={persona.perfil.whatsapp} />
                <InfoItem
                  label="Cumpleaños"
                  value={persona.perfil.fechaNacimiento}
                />
                <InfoItem
                  label="Rol global"
                  value={etiquetaRol(persona.perfil.role)}
                />
                <InfoItem
                  label="Estado"
                  value={persona.perfil.activo ? "Activo" : "Inactivo"}
                />
                <InfoItem
                  label="Charla introductoria"
                  value={persona.perfil.charlaIntroHabilitada ? "Sí" : "No"}
                />
              </div>
            </BloqueFicha>

            <BloqueFicha titulo="Estado operativo">
              {persona.alertas.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Sin alertas operativas visibles.
                </p>
              ) : (
                <div className="grid gap-2">{persona.alertas.map(renderAlerta)}</div>
              )}
            </BloqueFicha>

            <BloqueFicha titulo="Actividades">
              <div className="grid gap-2">
                {persona.actividades.map((actividad) =>
                  renderActividad(persona, actividad)
                )}
              </div>
            </BloqueFicha>

            <BloqueFicha titulo="Economía">
              {persona.economia.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Sin configuración económica visible todavía.
                </p>
              ) : (
                <div className="grid gap-2">
                  {persona.economia.map((economia) =>
                    renderEconomia(persona, economia)
                  )}
                </div>
              )}
            </BloqueFicha>

            <BloqueFicha titulo="Historial de pagos y comprobantes">
              {renderHistorialPagos(persona)}
            </BloqueFicha>

            <BloqueFicha titulo="Agenda">
              {persona.agenda.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No hay encuentros visibles asociados a esta persona.
                </p>
              ) : (
                <div className="grid gap-2">
                  {persona.agenda.map((agendaItem) =>
                    renderAgenda(persona, agendaItem)
                  )}
                </div>
              )}
            </BloqueFicha>

            <BloqueFicha titulo="Notas y documentos">
              {documentos.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No hay documentos de notas visibles.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {documentos.map((documento) => (
                    <a
                      key={`${persona.id}-${documento.url}`}
                      href={documento.url}
                      target="_blank"
                      rel="noreferrer"
                      className="workspace-button-secondary !px-3 !py-1.5 text-xs"
                    >
                      {documento.titulo}
                    </a>
                  ))}
                </div>
              )}
              {persona.perfil.notasDocumentos && (
                <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-[var(--line)] bg-[rgba(255,250,242,0.6)] p-3 text-xs text-gray-600">
                  {persona.perfil.notasDocumentos}
                </pre>
              )}
            </BloqueFicha>
          </div>
        </div>
      </SeccionDesplegable>
    )
  }

  if (status === "loading") {
    return <main className="workspace-shell">Cargando sesión...</main>
  }

  if (status === "authenticated" && !esAdmin) {
    return (
      <main className="workspace-shell">
        <section className="workspace-panel">
          No tenés permisos para administrar usuarios.
        </section>
      </main>
    )
  }

  return (
    <main className="workspace-shell space-y-6">
      <section className="workspace-hero">
        <div className="relative z-10 max-w-3xl space-y-4">
          <p className="workspace-eyebrow">Administración</p>
          <h1 className="workspace-title">Personas</h1>
          <p className="workspace-subtitle">
            Esta pantalla empieza a funcionar como ficha integral por persona:
            perfil, actividades, economía, agenda, alertas y documentos, sin
            mover todavía las lógicas reales de acceso, pagos ni agenda.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/pagos" className="workspace-button-secondary">
              Ir a Admin Pagos
            </Link>
            <Link href="/agenda" className="workspace-button-secondary">
              Ir a Agenda
            </Link>
          </div>
        </div>
      </section>

      {mensaje && <section className="workspace-panel-soft">{mensaje}</section>}

      <section className="workspace-panel space-y-4">
        <div className="space-y-1">
          <p className="workspace-eyebrow">
            {editando ? "Editar usuario" : "Nuevo usuario"}
          </p>
          <h2 className="workspace-title-sm">
            {editando ? form.email : "Crear acceso a la plataforma"}
          </h2>
          <p className="workspace-inline-note">
            Crear el usuario habilita el login. Luego podés asignar actividades
            desde esta misma ficha o completar la configuración económica en las
            vistas secundarias.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Nombre</span>
            <input
              className="workspace-field"
              value={form.nombre}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, nombre: e.target.value }))
              }
              placeholder="Nombre del usuario"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Apellido</span>
            <input
              className="workspace-field"
              value={form.apellido}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, apellido: e.target.value }))
              }
              placeholder="Apellido del usuario"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Email</span>
            <input
              className="workspace-field"
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="participante@email.com"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">WhatsApp</span>
            <input
              className="workspace-field"
              value={form.whatsapp}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, whatsapp: e.target.value }))
              }
              placeholder="+54 9 ..."
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">
              Fecha de cumpleaños
            </span>
            <input
              className="workspace-field"
              type="date"
              value={form.fechaCumpleanos}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  fechaCumpleanos: e.target.value,
                }))
              }
            />
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-gray-700">
              Documentos de toma de notas
            </span>
            <textarea
              className="workspace-field min-h-28"
              value={form.notasDocumentos}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  notasDocumentos: e.target.value,
                }))
              }
              placeholder="Un documento por línea. Ej: Proceso Nicolás | https://docs.google.com/document/..."
            />
            <p className="workspace-inline-note">
              Podés pegar uno o varios links. Si querés poner título, usá:
              Título | URL.
            </p>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Rol global</span>
            <select
              className="workspace-field"
              value={form.role}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  role: e.target.value as Usuario["role"],
                }))
              }
            >
              <option value="participante">Participante</option>
              <option value="colaborador">Colaborador</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">
              {editando ? "Nueva clave de acceso opcional" : "Clave de acceso inicial"}
            </span>
            <input
              className="workspace-field"
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, password: e.target.value }))
              }
              placeholder={
                editando ? "Dejar vacía para no cambiar" : "Mínimo 4 caracteres"
              }
            />
          </label>
        </div>

        <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.68)] p-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">
              Actividades a habilitar desde esta ficha
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {ACTIVIDADES.map((actividad) => (
                <label
                  key={`form-${actividad.slug}`}
                  className="inline-flex items-center gap-3 text-sm font-medium text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={form.actividades[actividad.slug]}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        actividades: {
                          ...prev.actividades,
                          [actividad.slug]: e.target.checked,
                        },
                      }))
                    }
                  />
                  <span>{actividad.nombre}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="inline-flex items-center gap-3 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, activo: e.target.checked }))
              }
            />
            Usuario activo
          </label>

          <label className="flex items-start gap-3 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={form.charlaIntroHabilitada}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  charlaIntroHabilitada: e.target.checked,
                }))
              }
              className="mt-1"
            />
            <span>
              Usuario sólo charla introductoria
              <span className="block text-xs font-normal text-gray-500">
                Al crear el usuario con esta opción y una clave de acceso cargada, se
                enviará el mail especial de la charla.
              </span>
            </span>
          </label>

          <label className="inline-flex items-center gap-3 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={form.enviarBienvenida}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  enviarBienvenida: e.target.checked,
                }))
              }
            />
            {form.charlaIntroHabilitada
              ? "Enviar email de invitación a la charla si hay clave de acceso cargada"
              : "Enviar email de bienvenida si hay clave de acceso cargada"}
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void guardarUsuario()}
            disabled={guardando}
            className="workspace-button-primary disabled:opacity-60"
          >
            {guardando
              ? "Guardando..."
              : editando
                ? "Guardar cambios"
                : "Crear usuario"}
          </button>

          <button
            type="button"
            onClick={limpiarForm}
            disabled={guardando}
            className="workspace-button-secondary disabled:opacity-60"
          >
            Limpiar
          </button>
        </div>
      </section>

      <section className="workspace-panel space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="workspace-eyebrow">Ficha integral</p>
            <h2 className="workspace-title-sm">Personas creadas</h2>
            <p className="workspace-inline-note">
              Lectura consolidada por persona: actividades, economía, agenda y
              alertas, sin cambiar todavía la lógica real de acceso.
            </p>
          </div>

          <label className="space-y-2 lg:w-80">
            <span className="text-sm font-medium text-gray-700">Buscar</span>
            <input
              className="workspace-field"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, email, rol, charla o actividad"
            />
          </label>
        </div>

        {cargando && <p className="workspace-inline-note">Cargando personas...</p>}

        {!cargando && personasFiltradas.length === 0 && (
          <div className="rounded-2xl border border-[var(--line)] p-4">
            Todavía no hay usuarios creados en la base nueva.
          </div>
        )}

        <div className="grid gap-3">
          <SeccionDesplegable
            titulo={`Charla introductoria (${gruposPersonas.charlaIntroductoria.length})`}
          >
            <div className="grid gap-3">
              {gruposPersonas.charlaIntroductoria.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No hay usuarios en este grupo.
                </p>
              ) : (
                gruposPersonas.charlaIntroductoria.map(renderPersonaCard)
              )}
            </div>
          </SeccionDesplegable>

          <SeccionDesplegable
            titulo={`Participantes activos de la escuela (${gruposPersonas.participantesActivos.length})`}
          >
            <div className="grid gap-3">
              {gruposPersonas.participantesActivos.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No hay usuarios en este grupo.
                </p>
              ) : (
                gruposPersonas.participantesActivos.map(renderPersonaCard)
              )}
            </div>
          </SeccionDesplegable>

          <SeccionDesplegable
            titulo={`Usuarios sin actividad (${gruposPersonas.usuariosSinActividad.length})`}
          >
            <div className="grid gap-3">
              {gruposPersonas.usuariosSinActividad.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No hay usuarios en este grupo.
                </p>
              ) : (
                gruposPersonas.usuariosSinActividad.map(renderPersonaCard)
              )}
            </div>
          </SeccionDesplegable>

          <SeccionDesplegable
            titulo={`Equipo interno (${gruposPersonas.equipoInterno.length})`}
          >
            <div className="grid gap-3">
              {gruposPersonas.equipoInterno.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No hay usuarios en este grupo.
                </p>
              ) : (
                gruposPersonas.equipoInterno.map(renderPersonaCard)
              )}
            </div>
          </SeccionDesplegable>

          <SeccionDesplegable
            titulo={`Usuarios inactivos (${gruposPersonas.usuariosInactivos.length})`}
          >
            <div className="grid gap-3">
              {gruposPersonas.usuariosInactivos.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No hay usuarios en este grupo.
                </p>
              ) : (
                gruposPersonas.usuariosInactivos.map(renderPersonaCard)
              )}
            </div>
          </SeccionDesplegable>
        </div>
      </section>
    </main>
  )
}
