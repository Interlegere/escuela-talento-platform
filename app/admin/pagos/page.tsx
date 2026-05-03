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
  if (modalidad === "sesion") {
    return "Cobro por sesión"
  }

  if (modalidad === "proceso") {
    return actividadSlug === "terapia" ? "Cobro por proceso" : "Cobro único"
  }

  return "Cobro mensual"
}

function etiquetaHonorario(modalidad: BillingMode, actividadSlug: string) {
  if (modalidad === "sesion") {
    return "Honorario por sesión"
  }

  if (modalidad === "proceso") {
    return actividadSlug === "terapia"
      ? "Honorario del proceso terapéutico"
      : "Honorario del proceso"
  }

  return "Honorario mensual"
}

function placeholderHonorario(modalidad: BillingMode, actividadSlug: string) {
  if (modalidad === "sesion") {
    return "Ej: 65000"
  }

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
        <p className="text-gray-600 mt-2">Preparando acceso de administración...</p>
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
    if (!filtroParticipante || participanteEmail) {
      return
    }

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

  if (status === "loading") {
    return (
      <main className="p-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Administración de pagos</h1>
          <p className="text-gray-600 mt-2">Preparando acceso de administración...</p>
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
      setMensaje("Recargo de Mercado Pago guardado correctamente.")
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

      setMensaje(
        activo
          ? "Honorario guardado correctamente."
          : "Honorario desactivado correctamente."
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
  const hayFiltroActivo = Boolean(filtroActividad || filtroParticipante)

  return (
    <main className="p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Administración de pagos</h1>
        <p className="text-gray-600 mt-2">
          Asigná honorarios, generá cobros y revisá comprobantes de cada participante.
        </p>
      </div>

      {mensaje && <div className="border rounded-xl p-3">{mensaje}</div>}

      {hayFiltroActivo && (
        <section className="border rounded-2xl p-4 space-y-2 bg-[rgba(255,251,244,0.86)]">
          <p className="text-sm font-medium text-gray-900">
            Vista filtrada desde la agenda
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
          <h2 className="text-xl font-semibold">Configuración de recargo MP</h2>
          <p className="text-gray-600 mt-1">
            Este porcentaje se suma al monto base cuando la persona elige pagar con Mercado Pago.
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="space-y-2 md:w-80">
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

          <button
            type="button"
            onClick={() => void guardarConfiguracionPagos()}
            disabled={guardandoConfiguracion}
            className="bg-black text-white px-4 py-2 rounded-xl disabled:opacity-60 w-fit"
          >
            {guardandoConfiguracion ? "Guardando..." : "Guardar recargo"}
          </button>
        </div>
      </section>

      <section className="border rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Honorarios por participante</h2>
          <p className="text-gray-600 mt-1">
            Desde acá definís qué actividad paga cada persona, con qué modalidad, con qué honorario y, cuando corresponde, podés generar el cobro.
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
            <span className="text-sm font-medium text-gray-700">
              Usuario
            </span>
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

        <div className="space-y-3">
          {honorarios.length === 0 && (
            <div className="border rounded-xl p-4">
              Todavía no hay honorarios asignados.
            </div>
          )}

          {honorarios.map((item) => (
            <div key={item.id} className="border rounded-xl p-4 space-y-2">
              <p>
                <strong>Actividad:</strong> {item.actividad_nombre}
              </p>
              <p>
                <strong>Participante:</strong> {item.participante_nombre || "Sin nombre"}
              </p>
              <p>
                <strong>Email:</strong> {item.participante_email}
              </p>
              <p>
                <strong>Honorario:</strong> {item.moneda} {item.honorario_mensual}
              </p>
              <p>
                <strong>Modalidad:</strong>{" "}
                {etiquetaModalidadPago(item.modalidad_pago, item.actividad_slug)}
              </p>
              <p>
                <strong>Tipo de cobro:</strong>{" "}
                {tituloCobroPorModalidad(item.modalidad_pago, item.actividad_slug)}
              </p>
              <p>
                <strong>Estado:</strong> {item.activo ? "activo" : "inactivo"}
              </p>

              {item.modalidad_pago === "sesion" ? (
                <div className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700">
                  Este caso no genera un cobro general desde Admin Pagos: el cobro se dispara al reservar cada sesión confirmable.
                </div>
              ) : item.ultimo_pago ? (
                <div className="space-y-3 rounded-xl border bg-gray-50 p-3 text-sm text-gray-700">
                  <p>
                    <strong>Último cobro:</strong> {item.ultimo_pago.estado || "pendiente"}
                  </p>
                  <p>
                    <strong>Monto:</strong> {item.ultimo_pago.moneda} {item.ultimo_pago.monto}
                  </p>
                  {item.ultimo_pago.mes && item.ultimo_pago.anio ? (
                    <p>
                      <strong>Período:</strong> {item.ultimo_pago.mes}/{item.ultimo_pago.anio}
                    </p>
                  ) : null}

                  {item.ultimo_pago.estado === "en_revision" ? (
                    <div className="space-y-3 border-t pt-3">
                      <p className="font-medium text-gray-900">
                        Este cobro está en revisión. Desde acá podés aprobarlo para habilitar la actividad.
                      </p>

                      <textarea
                        className="w-full rounded-xl border bg-white p-3"
                        placeholder="Observación opcional"
                        value={observaciones[item.ultimo_pago.id] || ""}
                        onChange={(e) =>
                          setObservaciones((prev) => ({
                            ...prev,
                            [item.ultimo_pago!.id]: e.target.value,
                          }))
                        }
                      />

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => resolver(item.ultimo_pago!.id, "aprobar")}
                          disabled={cargando}
                          className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-60"
                        >
                          Aprobar pago
                        </button>

                        <button
                          type="button"
                          onClick={() => resolver(item.ultimo_pago!.id, "rechazar")}
                          disabled={cargando}
                          className="rounded-xl border px-4 py-2 disabled:opacity-60"
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ) : item.ultimo_pago.estado === "pagado" ? (
                    <p className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 font-medium text-green-800">
                      Pago aprobado. La actividad queda habilitada para el participante.
                    </p>
                  ) : item.ultimo_pago.estado === "rechazado" ? (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-medium text-red-800">
                      Pago rechazado. Podés generar o actualizar un nuevo cobro si corresponde.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700">
                  Todavía no hay un cobro generado para esta asignación.
                </div>
              )}

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
                      honorarioMensual: String(item.honorario_mensual || ""),
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
        </div>
      </section>

      {cargando && pagosFiltrados.length === 0 && <p>Cargando...</p>}

      <div className="space-y-4">
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Pagos por sesión pendientes</h2>
            <p className="text-gray-600 mt-1">
              Acá aparecen las reservas con comprobante subido para que las apruebes o rechaces.
            </p>
          </div>

          {reservasPendientesFiltradas.length === 0 && !cargando && (
            <div className="border rounded-xl p-4">
              {hayFiltroActivo
                ? "No hay pagos por sesión pendientes para este filtro."
                : "No hay pagos por sesión pendientes."}
            </div>
          )}

          {reservasPendientesFiltradas.map((reserva) => (
            <section key={reserva.id} className="border rounded-2xl p-5 space-y-3">
              <p>
                <strong>Actividad:</strong> {reserva.actividad_nombre || "Terapia"}
              </p>
              <p>
                <strong>Encuentro:</strong> {reserva.titulo || "Sesión"}
              </p>
              <p>
                <strong>Participante:</strong> {reserva.participante_nombre}
              </p>
              <p>
                <strong>Email:</strong> {reserva.participante_email}
              </p>
              <p>
                <strong>Fecha:</strong> {reserva.fecha || "Sin fecha"} {reserva.hora ? `· ${reserva.hora}` : ""}
              </p>
              <p>
                <strong>Transferencia:</strong> ARS {reserva.monto_transferencia || reserva.monto || "0"}
              </p>
              <p>
                <strong>Mercado Pago:</strong> ARS {reserva.monto_mercado_pago || reserva.monto_transferencia || reserva.monto || "0"}
              </p>
              {reserva.porcentaje_recargo_mercado_pago ? (
                <p>
                  <strong>Recargo MP:</strong> {reserva.porcentaje_recargo_mercado_pago}%
                </p>
              ) : null}
              <p>
                <strong>Estado:</strong> {reserva.estado}
              </p>
              <p>
                <strong>Medio:</strong> {reserva.medio_pago || "transferencia"}
              </p>
              <p>
                <strong>Archivo:</strong> {reserva.comprobante_nombre_archivo || "Sin nombre"}
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
            </section>
          ))}
        </section>

        {pagosFiltrados.length === 0 && !cargando && (
          <div className="border rounded-xl p-4">
            {hayFiltroActivo
              ? "No hay pagos pendientes de revisión para este filtro."
              : "No hay pagos pendientes de revisión."}
          </div>
        )}

        {pagosFiltrados.map((pago) => (
          <section key={pago.id} className="border rounded-2xl p-5 space-y-3">
            <p>
              <strong>Actividad:</strong> {pago.actividad_nombre}
            </p>
            <p>
              <strong>Participante:</strong> {pago.participante_nombre}
            </p>
            <p>
              <strong>Email:</strong> {pago.participante_email}
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
          </section>
        ))}
      </div>
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
