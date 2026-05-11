"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAppSession } from "@/components/auth/AppSessionProvider"
import {
  etiquetaModalidadPago,
  normalizarModalidadPago,
  type BillingMode,
} from "@/lib/billing"

type PagoPendiente = {
  id: number
  anio: number
  mes: number
  estado: string
  medio_pago?: string | null
  monto: string
  moneda: string
  participante_nombre?: string
  participante_email?: string
  actividad_slug?: string
  actividad_nombre?: string
  comprobante_nombre_archivo?: string | null
  comprobante_url?: string | null
  observaciones_admin?: string | null
}

type ReservaPendiente = {
  id: number
  estado: string
  medio_pago?: string | null
  monto?: string | null
  monto_transferencia?: string | null
  monto_mercado_pago?: string | null
  porcentaje_recargo_mercado_pago?: number | null
  comprobante_nombre_archivo?: string | null
  comprobante_url?: string | null
  observaciones_admin?: string | null
  participante_nombre?: string
  participante_email?: string
  actividad_slug?: string
  actividad_nombre?: string
  titulo?: string
  fecha?: string
  hora?: string
  duracion?: string
}

type ActividadOption = {
  id: number
  slug: string
  nombre: string
}

type HonorarioAsignado = {
  id: number
  actividad_id: number
  actividad_slug: string
  actividad_nombre: string
  participante_email: string
  participante_nombre: string
  honorario_mensual: string | number
  modalidad_pago: BillingMode
  moneda: string
  activo: boolean
  updated_at?: string
  ultimo_pago?: {
    id: number
    estado: string
    monto: string | number
    moneda: string
    anio?: number | null
    mes?: number | null
    created_at?: string | null
  } | null
}

type UsuarioOption = {
  id: string
  nombre: string
  apellido?: string | null
  email: string
  role: "admin" | "colaborador" | "participante"
  activo: boolean
}

function tituloCobroPorModalidad(modalidad: BillingMode, actividadSlug: string) {
  if (modalidad === "sesion") return "Cobro por sesión"
  if (modalidad === "proceso") {
    return actividadSlug === "terapia" ? "Cobro por proceso" : "Cobro único"
  }
  return "Cobro mensual"
}

function etiquetaHonorario(modalidad: BillingMode, actividadSlug: string) {
  if (modalidad === "sesion") return "Honorario por sesión"
  if (modalidad === "proceso") {
    return actividadSlug === "terapia"
      ? "Honorario del proceso terapéutico"
      : "Honorario del proceso"
  }
  return "Honorario mensual"
}

function placeholderHonorario(modalidad: BillingMode, actividadSlug: string) {
  if (modalidad === "sesion") return "Ej: 65000"
  if (modalidad === "proceso") {
    return actividadSlug === "terapia" ? "Ej: 240000" : "Ej: 120000"
  }
  return "Ej: 45000"
}

function ayudaHonorario(modalidad: BillingMode, actividadSlug: string) {
  if (modalidad === "sesion") {
    return "Ingresá sólo el número. Ejemplo: 65000. La moneda se elige aparte."
  }

  if (modalidad === "proceso") {
    return actividadSlug === "terapia"
      ? "Este valor se usa para procesos completos de Terapia. Si querés cobrar encuentro por encuentro, elegí Pago por sesión."
      : "Este valor se cobra una sola vez para todo el proceso."
  }

  return "Este valor se toma como base para la suscripción mensual."
}

function AdminPagosPageFallback() {
  return (
    <main className="p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Administración de pagos</h1>
        <p className="text-gray-600 mt-2">
          Preparando acceso de administración...
        </p>
      </div>

      <section className="border rounded-xl p-4">
        <p>Cargando panel...</p>
      </section>
    </main>
  )
}

function AdminPagosPageContent() {
  const { data: session, status } = useAppSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [pagos, setPagos] = useState<PagoPendiente[]>([])
  const [reservasPendientes, setReservasPendientes] = useState<ReservaPendiente[]>([])
  const [actividades, setActividades] = useState<ActividadOption[]>([])
  const [honorarios, setHonorarios] = useState<HonorarioAsignado[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([])
  const [mensaje, setMensaje] = useState("")
  const [cargando, setCargando] = useState(false)
  const [guardandoHonorario, setGuardandoHonorario] = useState(false)
  const [observaciones, setObservaciones] = useState<Record<string, string>>({})
  const [mercadoPagoRecargoPorcentaje, setMercadoPagoRecargoPorcentaje] =
    useState("")
  const [casatalentosHonorarioBase, setCasatalentosHonorarioBase] =
    useState("")
  const [conectandoSentidosHonorarioBase, setConectandoSentidosHonorarioBase] =
    useState("")
  const [guardandoConfiguracion, setGuardandoConfiguracion] = useState(false)
  const [actividadSlug, setActividadSlug] = useState("casatalentos")
  const [participanteNombre, setParticipanteNombre] = useState("")
  const [participanteEmail, setParticipanteEmail] = useState("")
  const [honorarioMensual, setHonorarioMensual] = useState("")
  const [modalidadPago, setModalidadPago] = useState<BillingMode>("mensual")
  const [moneda, setMoneda] = useState("ARS")
  const [generandoCobroId, setGenerandoCobroId] = useState<number | null>(null)

  const esAdmin = session?.user?.role === "admin"
  const filtroActividad = (searchParams.get("actividad") || "").trim().toLowerCase()
  const filtroParticipante = (searchParams.get("participante") || "")
    .trim()
    .toLowerCase()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [router, status])

  const cargar = async () => {
    try {
      setCargando(true)
      setMensaje("")

      const res = await fetch("/admin/pagos-mensuales/listar")
      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudieron cargar los pagos")
        return
      }

      setPagos(data.pagos || [])
      setReservasPendientes(data.reservasPendientes || [])
    } catch {
      setMensaje("Error cargando pagos")
    } finally {
      setCargando(false)
    }
  }

  const cargarConfiguracionPagos = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/configuracion/pagos")
      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudo cargar la configuración de pagos.")
        return
      }

      setMercadoPagoRecargoPorcentaje(
        String(data.mercadoPagoRecargoPorcentaje ?? "0")
      )
      setCasatalentosHonorarioBase(
        String(data.casatalentosHonorarioBase ?? "0")
      )
      setConectandoSentidosHonorarioBase(
        String(data.conectandoSentidosHonorarioBase ?? "0")
      )
    } catch {
      setMensaje("Error cargando la configuración de pagos.")
    }
  }, [])

  const cargarHonorarios = useCallback(async () => {
    try {
      const res = await fetch("/admin/pagos-mensuales/honorarios")
      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudieron cargar los honorarios asignados")
        return
      }

      setActividades(data.actividades || [])
      setHonorarios(data.honorarios || [])

      if ((data.actividades || []).length > 0) {
        setActividadSlug((prev) => prev || data.actividades[0].slug)
      }
    } catch {
      setMensaje("Error cargando honorarios asignados")
    }
  }, [])

  const cargarUsuarios = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/usuarios", { cache: "no-store" })
      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudieron cargar los usuarios.")
        return
      }

      setUsuarios(data.usuarios || [])
    } catch {
      setMensaje("Error cargando usuarios.")
    }
  }, [])

  useEffect(() => {
    if (status !== "authenticated" || !esAdmin) return
    void cargar()
    void cargarHonorarios()
    void cargarUsuarios()
    void cargarConfiguracionPagos()
  }, [cargarConfiguracionPagos, cargarHonorarios, cargarUsuarios, esAdmin, status])

  useEffect(() => {
    if (!filtroParticipante || participanteEmail) return

    const usuario = usuarios.find(
      (item) => item.email.trim().toLowerCase() === filtroParticipante
    )

    if (usuario) {
      setParticipanteEmail(usuario.email)
      setParticipanteNombre([usuario.nombre, usuario.apellido].filter(Boolean).join(" "))
    }
  }, [filtroParticipante, participanteEmail, usuarios])

  useEffect(() => {
    if (actividadSlug !== "terapia" && modalidadPago !== "mensual") {
      setModalidadPago("mensual")
    }

    if (actividadSlug === "terapia" && modalidadPago === "mensual") {
      setModalidadPago("proceso")
    }
  }, [actividadSlug, modalidadPago])

  const resolver = async (pagoId: number, accion: "aprobar" | "rechazar") => {
    try {
      setCargando(true)
      setMensaje("")

      const res = await fetch("/admin/pagos-mensuales/resolver", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pagoMensualId: pagoId,
          accion,
          observacionesAdmin: observaciones[pagoId] || "",
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudo resolver el pago")
        return
      }

      setMensaje(
        accion === "aprobar"
          ? "Pago aprobado correctamente"
          : "Pago rechazado correctamente"
      )

      await Promise.all([cargar(), cargarHonorarios()])
    } catch {
      setMensaje("Error resolviendo pago")
    } finally {
      setCargando(false)
    }
  }

  const resolverReserva = async (
    reservaId: number,
    accion: "aprobar" | "rechazar"
  ) => {
    try {
      setCargando(true)
      setMensaje("")

      const res = await fetch("/api/terapia/admin/resolver-pago-reserva", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reservaId,
          accion,
          observacionesAdmin: observaciones[`reserva-${reservaId}`] || "",
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudo resolver la reserva.")
        return
      }

      const mensajeExito =
        accion === "aprobar"
          ? "Pago de sesión aprobado correctamente."
          : "Pago de sesión rechazado correctamente."

      setMensaje(
        data.advertencia ? `${mensajeExito} ${data.advertencia}` : mensajeExito
      )

      await cargar()
    } catch {
      setMensaje("Error resolviendo la reserva.")
    } finally {
      setCargando(false)
    }
  }

  const guardarConfiguracionPagos = async () => {
    try {
      setGuardandoConfiguracion(true)
      setMensaje("")

      const res = await fetch("/api/admin/configuracion/pagos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mercadoPagoRecargoPorcentaje,
          casatalentosHonorarioBase,
          conectandoSentidosHonorarioBase,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudo guardar la configuración de pagos.")
        return
      }

      setMercadoPagoRecargoPorcentaje(
        String(data.mercadoPagoRecargoPorcentaje ?? mercadoPagoRecargoPorcentaje)
      )
      setCasatalentosHonorarioBase(
        String(data.casatalentosHonorarioBase ?? casatalentosHonorarioBase)
      )
      setConectandoSentidosHonorarioBase(
        String(
          data.conectandoSentidosHonorarioBase ??
            conectandoSentidosHonorarioBase
        )
      )
      setMensaje("Configuración de pagos guardada correctamente.")
    } catch {
      setMensaje("Error guardando la configuración de pagos.")
    } finally {
      setGuardandoConfiguracion(false)
    }
  }

  const guardarHonorario = async (
    activo = true,
    override?: {
      actividadSlug?: string
      participanteNombre?: string
      participanteEmail?: string
      honorarioMensual?: string
      modalidadPago?: BillingMode
      moneda?: string
    }
  ) => {
    try {
      setGuardandoHonorario(true)
      setMensaje("")

      const actividadSlugFinal = override?.actividadSlug ?? actividadSlug
      const participanteNombreFinal = override?.participanteNombre ?? participanteNombre
      const participanteEmailFinal = override?.participanteEmail ?? participanteEmail
      const honorarioMensualFinal = override?.honorarioMensual ?? honorarioMensual
      const modalidadPagoFinal = override?.modalidadPago ?? modalidadPago
      const monedaFinal = override?.moneda ?? moneda

      if (!actividadSlugFinal) {
        setMensaje("Seleccioná primero la actividad.")
        return
      }

      if (!String(participanteEmailFinal || "").trim()) {
        setMensaje("Seleccioná un usuario cargado en Admin Usuarios.")
        return
      }

      if (!String(honorarioMensualFinal || "").trim()) {
        setMensaje("Ingresá el honorario antes de guardar.")
        return
      }

      const res = await fetch("/admin/pagos-mensuales/honorarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividadSlug: actividadSlugFinal,
          participanteNombre: participanteNombreFinal,
          participanteEmail: participanteEmailFinal,
          honorarioMensual: honorarioMensualFinal,
          modalidadPago: modalidadPagoFinal,
          moneda: monedaFinal,
          activo,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudo guardar el honorario")
        return
      }

      const mensajeBase = activo
        ? "Honorario guardado correctamente."
        : "Honorario desactivado correctamente."
      setMensaje(
        data.advertencia ? `${mensajeBase} ${data.advertencia}` : mensajeBase
      )
      setParticipanteNombre("")
      setParticipanteEmail("")
      setHonorarioMensual("")
      setModalidadPago("mensual")
      setMoneda("ARS")
      await cargarHonorarios()
    } catch {
      setMensaje("Error guardando honorario")
    } finally {
      setGuardandoHonorario(false)
    }
  }

  const editarHonorario = (item: HonorarioAsignado) => {
    setActividadSlug(item.actividad_slug)
    setParticipanteNombre(item.participante_nombre || "")
    setParticipanteEmail(item.participante_email)
    setHonorarioMensual(String(item.honorario_mensual || ""))
    setModalidadPago(normalizarModalidadPago(item.modalidad_pago, item.actividad_slug))
    setMoneda(item.moneda || "ARS")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const generarCobro = async (item: HonorarioAsignado) => {
    try {
      setGenerandoCobroId(item.id)
      setMensaje("")

      const res = await fetch("/api/pagos-mensuales/obtener-o-crear", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actividadSlug: item.actividad_slug,
          participanteNombre: item.participante_nombre || "",
          participanteEmail: item.participante_email,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudo generar el cobro.")
        return
      }

      const modalidad = normalizarModalidadPago(
        item.modalidad_pago,
        item.actividad_slug
      )

      setMensaje(
        modalidad === "proceso"
          ? "Cobro de proceso generado o recuperado correctamente."
          : "Cobro mensual generado o recuperado correctamente."
      )

      await Promise.all([cargar(), cargarHonorarios()])
    } catch {
      setMensaje("Error generando el cobro.")
    } finally {
      setGenerandoCobroId(null)
    }
  }

  if (status === "loading") {
    return (
      <main className="p-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Administración de pagos</h1>
          <p className="text-gray-600 mt-2">
            Preparando acceso de administración...
          </p>
        </div>

        <section className="border rounded-xl p-4">
          <p>Cargando sesión...</p>
        </section>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="p-10 space-y-6">
        <section className="border rounded-xl p-4">
          <p>Necesitás iniciar sesión para continuar.</p>
        </section>
      </main>
    )
  }

  if (!esAdmin) {
    return (
      <main className="p-10 space-y-6">
        <section className="border rounded-xl p-4">
          <p>No tenés permisos para acceder a esta sección.</p>
        </section>
      </main>
    )
  }

  const usuariosActivos = usuarios.filter((usuario) => usuario.activo)
  const usuarioSeleccionado = usuarios.find(
    (usuario) =>
      usuario.email.trim().toLowerCase() === participanteEmail.trim().toLowerCase()
  )
  const usuariosSelect = usuarioSeleccionado
    ? usuariosActivos.some((usuario) => usuario.email === usuarioSeleccionado.email)
      ? usuariosActivos
      : [usuarioSeleccionado, ...usuariosActivos]
    : usuariosActivos

  const modalidadOptions =
    actividadSlug === "terapia"
      ? [
          { value: "proceso" as BillingMode, label: "Pago por proceso" },
          { value: "sesion" as BillingMode, label: "Pago por sesión" },
        ]
      : [{ value: "mensual" as BillingMode, label: "Suscripción mensual" }]

  const tituloHonorario = etiquetaHonorario(modalidadPago, actividadSlug)
  const placeholderMonto = placeholderHonorario(modalidadPago, actividadSlug)
  const ayudaMonto = ayudaHonorario(modalidadPago, actividadSlug)

  const pagosFiltrados = pagos.filter((pago) => {
    const coincideActividad =
      !filtroActividad ||
      String(pago.actividad_slug || "").trim().toLowerCase() === filtroActividad
    const coincideParticipante =
      !filtroParticipante ||
      String(pago.participante_email || "").trim().toLowerCase() ===
        filtroParticipante

    return coincideActividad && coincideParticipante
  })

  const reservasPendientesFiltradas = reservasPendientes.filter((reserva) => {
    const coincideActividad =
      !filtroActividad ||
      String(reserva.actividad_slug || "").trim().toLowerCase() === filtroActividad
    const coincideParticipante =
      !filtroParticipante ||
      String(reserva.participante_email || "").trim().toLowerCase() ===
        filtroParticipante

    return coincideActividad && coincideParticipante
  })

  const honorariosFiltrados = honorarios.filter((item) => {
    const coincideActividad =
      !filtroActividad ||
      String(item.actividad_slug || "").trim().toLowerCase() === filtroActividad
    const coincideParticipante =
      !filtroParticipante ||
      String(item.participante_email || "").trim().toLowerCase() ===
        filtroParticipante

    return coincideActividad && coincideParticipante
  })

  const participantesAgrupados = (() => {
    const mapa = new Map<
      string,
      {
        email: string
        nombre: string
        honorarios: HonorarioAsignado[]
        pagos: PagoPendiente[]
        reservas: ReservaPendiente[]
      }
    >()

    const asegurar = (emailRaw?: string | null, nombreRaw?: string | null) => {
      const email = String(emailRaw || "sin-email").trim().toLowerCase()
      const nombre = String(nombreRaw || "").trim() || email

      if (!mapa.has(email)) {
        mapa.set(email, {
          email,
          nombre,
          honorarios: [],
          pagos: [],
          reservas: [],
        })
      }

      const grupo = mapa.get(email)!

      if ((!grupo.nombre || grupo.nombre === grupo.email) && nombre) {
        grupo.nombre = nombre
      }

      return grupo
    }

    for (const item of honorariosFiltrados) {
      asegurar(item.participante_email, item.participante_nombre).honorarios.push(
        item
      )
    }

    for (const pago of pagosFiltrados) {
      asegurar(pago.participante_email, pago.participante_nombre).pagos.push(pago)
    }

    for (const reserva of reservasPendientesFiltradas) {
      asegurar(reserva.participante_email, reserva.participante_nombre).reservas.push(
        reserva
      )
    }

    return Array.from(mapa.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    )
  })()

  const hayFiltroActivo = Boolean(filtroActividad || filtroParticipante)

  return (
    <main className="p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Administración de pagos</h1>
        <p className="text-gray-600 mt-2">
          Asigná honorarios, generá cobros y revisá comprobantes de cada
          participante.
        </p>
      </div>

      {mensaje && <div className="border rounded-xl p-3">{mensaje}</div>}

      {hayFiltroActivo && (
        <section className="border rounded-2xl p-4 space-y-2 bg-[rgba(255,251,244,0.86)]">
          <p className="text-sm font-medium text-gray-900">
            Vista filtrada desde la agenda o usuarios
          </p>
          <p className="text-sm text-gray-600">
            {filtroActividad
              ? `Actividad: ${filtroActividad}`
              : "Todas las actividades"}
            {filtroParticipante ? ` · Participante: ${filtroParticipante}` : ""}
          </p>
          <button
            type="button"
            onClick={() => router.replace("/admin/pagos")}
            className="border px-4 py-2 rounded-xl w-fit"
          >
            Quitar filtro
          </button>
        </section>
      )}

      <section className="border rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Configuración base de pagos</h2>
          <p className="text-gray-600 mt-1">
            Definí acá el recargo de Mercado Pago y los honorarios base
            mensuales de CasaTalentos y Conectando Sentidos. Si una persona
            participa en ambas, el ajuste final lo seguís resolviendo caso por
            caso desde este mismo panel.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">
              Honorario base CasaTalentos (ARS)
            </span>
            <input
              className="w-full border rounded-xl p-3"
              inputMode="numeric"
              placeholder="Ej: 120000"
              value={casatalentosHonorarioBase}
              onChange={(e) => setCasatalentosHonorarioBase(e.target.value)}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">
              Honorario base Conectando Sentidos (ARS)
            </span>
            <input
              className="w-full border rounded-xl p-3"
              inputMode="numeric"
              placeholder="Ej: 150000"
              value={conectandoSentidosHonorarioBase}
              onChange={(e) =>
                setConectandoSentidosHonorarioBase(e.target.value)
              }
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">
              Recargo Mercado Pago (%)
            </span>
            <input
              className="w-full border rounded-xl p-3"
              inputMode="decimal"
              placeholder="Ej: 12"
              value={mercadoPagoRecargoPorcentaje}
              onChange={(e) => setMercadoPagoRecargoPorcentaje(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void guardarConfiguracionPagos()}
            disabled={guardandoConfiguracion}
            className="bg-black text-white px-4 py-2 rounded-xl disabled:opacity-60 w-fit"
          >
            {guardandoConfiguracion ? "Guardando..." : "Guardar configuración"}
          </button>
          <p className="self-center text-xs text-gray-500">
            Mentorías y Terapia siguen configurándose manualmente por usuario.
          </p>
        </div>
      </section>

      <section className="border rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Asignar actividad y honorario</h2>
          <p className="text-gray-600 mt-1">
            Desde acá ajustás casos por persona: combinaciones CT/CS,
            Mentorías y Terapia, además de revisar o regenerar cobros si hace
            falta.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Actividad</span>
            <select
              className="w-full border rounded-xl p-3"
              value={actividadSlug}
              onChange={(e) => setActividadSlug(e.target.value)}
            >
              {actividades.map((actividad) => (
                <option key={actividad.id} value={actividad.slug}>
                  {actividad.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Usuario</span>
            <select
              className="w-full border rounded-xl p-3"
              value={participanteEmail}
              onChange={(e) => {
                const email = e.target.value
                const usuario = usuarios.find((item) => item.email === email)

                setParticipanteEmail(email)
                setParticipanteNombre(
                  usuario
                    ? [usuario.nombre, usuario.apellido].filter(Boolean).join(" ")
                    : ""
                )
              }}
            >
              <option value="">Seleccionar usuario creado</option>
              {usuariosSelect.map((usuario) => (
                <option key={usuario.id} value={usuario.email}>
                  {[usuario.nombre, usuario.apellido].filter(Boolean).join(" ") ||
                    usuario.email}{" "}
                  · {usuario.email}
                  {!usuario.activo ? " · inactivo" : ""}
                </option>
              ))}
            </select>
            {usuariosActivos.length === 0 && (
              <p className="text-xs text-amber-700">
                Primero creá o activá usuarios desde Admin Usuarios.
              </p>
            )}
          </label>

          <div className="space-y-2">
            <span className="text-sm font-medium text-gray-700">
              Datos del usuario
            </span>
            <div className="w-full rounded-xl border bg-gray-50 p-3 text-sm text-gray-700">
              {participanteEmail ? (
                <>
                  <p>
                    <strong>Nombre:</strong>{" "}
                    {participanteNombre || "Sin nombre cargado"}
                  </p>
                  <p>
                    <strong>Email:</strong> {participanteEmail}
                  </p>
                </>
              ) : (
                "Seleccioná un usuario para asignarle una actividad."
              )}
            </div>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">
              {tituloHonorario}
            </span>
            <input
              className="w-full border rounded-xl p-3"
              inputMode="numeric"
              placeholder={placeholderMonto}
              value={honorarioMensual}
              onChange={(e) => setHonorarioMensual(e.target.value)}
            />
            <p className="text-xs text-gray-500">{ayudaMonto}</p>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">
              Modalidad de pago
            </span>
            <select
              className="w-full border rounded-xl p-3"
              value={modalidadPago}
              onChange={(e) => setModalidadPago(e.target.value as BillingMode)}
            >
              {modalidadOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Moneda</span>
            <select
              className="w-full border rounded-xl p-3"
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => void guardarHonorario(true)}
            disabled={guardandoHonorario}
            className="bg-black text-white px-4 py-2 rounded-xl disabled:opacity-60"
          >
            {guardandoHonorario ? "Guardando..." : "Guardar honorario"}
          </button>

          <button
            type="button"
            onClick={() => {
              setParticipanteNombre("")
              setParticipanteEmail("")
              setHonorarioMensual("")
              setModalidadPago("mensual")
              setMoneda("ARS")
            }}
            disabled={guardandoHonorario}
            className="border px-4 py-2 rounded-xl disabled:opacity-60"
          >
            Limpiar formulario
          </button>
        </div>
      </section>

      {cargando && participantesAgrupados.length === 0 && <p>Cargando...</p>}

      <section className="border rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Tablero por participante</h2>
          <p className="text-gray-600 mt-1">
            Cada participante aparece en un desplegable. Dentro ves actividades,
            cobros y reservas pendientes sin mezclar todo en una sola lista.
          </p>
        </div>

        {participantesAgrupados.length === 0 && !cargando && (
          <div className="border rounded-xl p-4">
            {hayFiltroActivo
              ? "No hay datos para este filtro."
              : "Todavía no hay honorarios, pagos o reservas pendientes."}
          </div>
        )}

        <div className="space-y-3">
          {participantesAgrupados.map((grupo) => (
            <details
              key={grupo.email}
              className="border rounded-2xl p-4 bg-[rgba(255,250,242,0.68)]"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">{grupo.nombre}</p>
                    <p className="text-sm text-gray-600">{grupo.email}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border px-3 py-1 bg-white/70">
                      {grupo.honorarios.length} actividad/es
                    </span>
                    <span className="rounded-full border px-3 py-1 bg-white/70">
                      {grupo.pagos.length} pago/s pendiente/s
                    </span>
                    <span className="rounded-full border px-3 py-1 bg-white/70">
                      {grupo.reservas.length} reserva/s pendiente/s
                    </span>
                  </div>
                </div>
              </summary>

              <div className="pt-5 space-y-5">
                <section className="space-y-3">
                  <h3 className="font-semibold">Actividades y honorarios</h3>

                  {grupo.honorarios.length === 0 && (
                    <div className="border rounded-xl p-4 text-sm text-gray-600 bg-white/70">
                      No tiene actividades configuradas.
                    </div>
                  )}

                  {grupo.honorarios.map((item) => (
                    <div key={item.id} className="border rounded-xl p-4 space-y-2 bg-white/70">
                      <p>
                        <strong>Actividad:</strong> {item.actividad_nombre}
                      </p>
                      <p>
                        <strong>Honorario:</strong> {item.moneda}{" "}
                        {item.honorario_mensual}
                      </p>
                      <p>
                        <strong>Modalidad:</strong>{" "}
                        {etiquetaModalidadPago(
                          item.modalidad_pago,
                          item.actividad_slug
                        )}
                      </p>
                      <p>
                        <strong>Tipo de cobro:</strong>{" "}
                        {tituloCobroPorModalidad(
                          item.modalidad_pago,
                          item.actividad_slug
                        )}
                      </p>
                      <p>
                        <strong>Estado:</strong>{" "}
                        {item.activo ? "activo" : "inactivo"}
                      </p>

                      <div className="flex gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={() => editarHonorario(item)}
                          className="border px-4 py-2 rounded-xl"
                        >
                          Editar
                        </button>

                        {item.activo && item.modalidad_pago !== "sesion" && (
                          <button
                            type="button"
                            onClick={() => void generarCobro(item)}
                            disabled={generandoCobroId === item.id}
                            className="bg-black text-white px-4 py-2 rounded-xl disabled:opacity-60"
                          >
                            {generandoCobroId === item.id
                              ? "Generando..."
                              : item.ultimo_pago
                                ? "Ver o actualizar cobro"
                                : "Generar cobro"}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            void guardarHonorario(!item.activo, {
                              actividadSlug: item.actividad_slug,
                              participanteNombre: item.participante_nombre || "",
                              participanteEmail: item.participante_email,
                              honorarioMensual: String(
                                item.honorario_mensual || ""
                              ),
                              modalidadPago: item.modalidad_pago,
                              moneda: item.moneda || "ARS",
                            })
                          }
                          className="border px-4 py-2 rounded-xl"
                        >
                          {item.activo ? "Desactivar" : "Reactivar"}
                        </button>
                      </div>
                    </div>
                  ))}
                </section>

                <section className="space-y-3">
                  <h3 className="font-semibold">Pagos mensuales pendientes</h3>

                  {grupo.pagos.length === 0 && (
                    <div className="border rounded-xl p-4 text-sm text-gray-600 bg-white/70">
                      No tiene pagos mensuales pendientes de revisión.
                    </div>
                  )}

                  {grupo.pagos.map((pago) => (
                    <div key={pago.id} className="border rounded-xl p-4 space-y-3 bg-white/70">
                      <p>
                        <strong>Actividad:</strong> {pago.actividad_nombre}
                      </p>
                      <p>
                        <strong>Período:</strong> {pago.mes}/{pago.anio}
                      </p>
                      <p>
                        <strong>Monto:</strong> {pago.moneda} {pago.monto}
                      </p>
                      <p>
                        <strong>Estado:</strong> {pago.estado}
                      </p>
                      <p>
                        <strong>Medio:</strong> {pago.medio_pago}
                      </p>
                      <p>
                        <strong>Archivo:</strong>{" "}
                        {pago.comprobante_nombre_archivo || "Sin nombre"}
                      </p>

                      {pago.comprobante_url && (
                        <a
                          href={`/admin/pagos-mensuales/comprobante?pagoMensualId=${pago.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline"
                        >
                          Ver comprobante
                        </a>
                      )}

                      <textarea
                        className="w-full border rounded-xl p-3 min-h-[100px]"
                        placeholder="Observación opcional"
                        value={observaciones[pago.id] || ""}
                        onChange={(e) =>
                          setObservaciones((prev) => ({
                            ...prev,
                            [pago.id]: e.target.value,
                          }))
                        }
                      />

                      <div className="flex gap-3 flex-wrap">
                        <button
                          onClick={() => resolver(pago.id, "aprobar")}
                          disabled={cargando}
                          className="bg-black text-white px-4 py-2 rounded-xl disabled:opacity-60"
                        >
                          Aprobar
                        </button>

                        <button
                          onClick={() => resolver(pago.id, "rechazar")}
                          disabled={cargando}
                          className="border px-4 py-2 rounded-xl disabled:opacity-60"
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </section>

                <section className="space-y-3">
                  <h3 className="font-semibold">Reservas pendientes</h3>

                  {grupo.reservas.length === 0 && (
                    <div className="border rounded-xl p-4 text-sm text-gray-600 bg-white/70">
                      No tiene reservas pendientes de revisión.
                    </div>
                  )}

                  {grupo.reservas.map((reserva) => (
                    <div key={reserva.id} className="border rounded-xl p-4 space-y-3 bg-white/70">
                      <p>
                        <strong>Actividad:</strong>{" "}
                        {reserva.actividad_nombre || "Terapia"}
                      </p>
                      <p>
                        <strong>Encuentro:</strong> {reserva.titulo || "Sesión"}
                      </p>
                      <p>
                        <strong>Fecha:</strong> {reserva.fecha || "Sin fecha"}{" "}
                        {reserva.hora ? `· ${reserva.hora}` : ""}
                      </p>
                      <p>
                        <strong>Transferencia:</strong> ARS{" "}
                        {reserva.monto_transferencia || reserva.monto || "0"}
                      </p>
                      <p>
                        <strong>Mercado Pago:</strong> ARS{" "}
                        {reserva.monto_mercado_pago ||
                          reserva.monto_transferencia ||
                          reserva.monto ||
                          "0"}
                      </p>
                      {reserva.porcentaje_recargo_mercado_pago ? (
                        <p>
                          <strong>Recargo MP:</strong>{" "}
                          {reserva.porcentaje_recargo_mercado_pago}%
                        </p>
                      ) : null}
                      <p>
                        <strong>Estado:</strong> {reserva.estado}
                      </p>
                      <p>
                        <strong>Medio:</strong>{" "}
                        {reserva.medio_pago || "transferencia"}
                      </p>
                      <p>
                        <strong>Archivo:</strong>{" "}
                        {reserva.comprobante_nombre_archivo || "Sin nombre"}
                      </p>

                      {reserva.comprobante_url && (
                        <a
                          href={`/api/reservas/comprobante?reservaId=${reserva.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline"
                        >
                          Ver comprobante
                        </a>
                      )}

                      <textarea
                        className="w-full border rounded-xl p-3 min-h-[100px]"
                        placeholder="Observación opcional"
                        value={observaciones[`reserva-${reserva.id}`] || ""}
                        onChange={(e) =>
                          setObservaciones((prev) => ({
                            ...prev,
                            [`reserva-${reserva.id}`]: e.target.value,
                          }))
                        }
                      />

                      <div className="flex gap-3 flex-wrap">
                        <button
                          onClick={() => void resolverReserva(reserva.id, "aprobar")}
                          disabled={cargando}
                          className="bg-black text-white px-4 py-2 rounded-xl disabled:opacity-60"
                        >
                          Aprobar
                        </button>

                        <button
                          onClick={() => void resolverReserva(reserva.id, "rechazar")}
                          disabled={cargando}
                          className="border px-4 py-2 rounded-xl disabled:opacity-60"
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </section>
              </div>
            </details>
          ))}
        </div>
      </section>
    </main>
  )
}

export default function AdminPagosPage() {
  return (
    <Suspense fallback={<AdminPagosPageFallback />}>
      <AdminPagosPageContent />
    </Suspense>
  )
}
