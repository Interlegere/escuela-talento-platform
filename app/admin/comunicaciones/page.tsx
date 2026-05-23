"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAppSession } from "@/components/auth/AppSessionProvider"

type Segmento =
  | "todos_activos"
  | "casatalentos_activos"
  | "conectando_sentidos_activos"
  | "mentorias_activos"
  | "terapia_activos"
  | "pagos_pendientes"
  | "pagos_al_dia"
  | "equipo_interno"

type TipoComunicacion =
  | "general"
  | "actividad"
  | "pago"
  | "aviso"
  | "newsletter"

type DestinatarioPreview = {
  email: string
  nombreCompleto: string
  actividadSlug?: string | null
  razon: string
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
    descripcion: "Próximamente.",
    disabled: true,
  },
  {
    value: "pagos_al_dia",
    label: "Usuarios con pago al día",
    descripcion: "Próximamente.",
    disabled: true,
  },
  {
    value: "equipo_interno",
    label: "Equipo interno",
    descripcion: "Admins y colaboradores activos.",
  },
]

const TIPOS: Array<{ value: TipoComunicacion; label: string }> = [
  { value: "general", label: "General" },
  { value: "actividad", label: "Actividad" },
  { value: "pago", label: "Pago" },
  { value: "aviso", label: "Aviso" },
  { value: "newsletter", label: "Newsletter" },
]

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

export default function AdminComunicacionesPage() {
  const { data: session, status } = useAppSession()
  const router = useRouter()
  const esAdmin = session?.user?.role === "admin"

  const [asunto, setAsunto] = useState("")
  const [contenido, setContenido] = useState("")
  const [tipo, setTipo] = useState<TipoComunicacion>("general")
  const [actividadSlug, setActividadSlug] = useState("")
  const [segmento, setSegmento] = useState<Segmento>("todos_activos")
  const [pruebaEmail, setPruebaEmail] = useState(session?.user?.email || "")
  const [preview, setPreview] = useState<DestinatarioPreview[]>([])
  const [previewMensaje, setPreviewMensaje] = useState("")
  const [previewCargando, setPreviewCargando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState("")
  const [historial, setHistorial] = useState<HistorialEnvio[]>([])
  const [historialCargando, setHistorialCargando] = useState(false)
  const [filtroEmail, setFiltroEmail] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("")
  const [filtroTipo, setFiltroTipo] = useState("")

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

  const cargarPreview = useCallback(async () => {
    try {
      setPreviewCargando(true)
      setPreviewMensaje("")
      setMensaje("")

      const res = await fetch("/api/admin/comunicaciones/preview-segmento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segmento }),
      })

      const data = await res.json()

      if (!res.ok || data.deshabilitado) {
        throw new Error(data.error || data.motivo || "No se pudo cargar el segmento.")
      }

      setPreview(data.destinatarios || [])
      setPreviewMensaje(`${data.total || 0} destinatario/s encontrados.`)
    } catch (error) {
      setPreview([])
      setPreviewMensaje(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el segmento."
      )
    } finally {
      setPreviewCargando(false)
    }
  }, [segmento])

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

  useEffect(() => {
    if (status === "authenticated" && esAdmin) {
      void cargarPreview()
      void cargarHistorial()
    }
  }, [cargarHistorial, cargarPreview, esAdmin, status])

  const validarContenido = () => {
    if (!asunto.trim()) {
      setMensaje("Completá el asunto.")
      return false
    }

    if (!contenido.trim()) {
      setMensaje("Completá el contenido.")
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

    if (modo === "segmento" && preview.length === 0) {
      setMensaje("Primero cargá el preview del segmento.")
      return
    }

    if (
      modo === "segmento" &&
      !window.confirm(
        `Vas a enviar esta comunicación a ${preview.length} destinatario/s. ¿Continuar?`
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="workspace-panel space-y-5">
          <div className="space-y-1">
            <p className="workspace-eyebrow">Nuevo envío grupal</p>
            <h2 className="workspace-title-sm">Preparar comunicación</h2>
          </div>

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
                placeholder="Podés usar variables como {{nombre}}, {{nombre_completo}}, {{email}} o {{actividad}}."
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
        </div>

        <aside className="workspace-panel space-y-4">
          <div className="space-y-1">
            <p className="workspace-eyebrow">Segmento</p>
            <h2 className="workspace-title-sm">Destinatarios</h2>
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

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={previewCargando || segmentoActual?.disabled}
              onClick={() => void cargarPreview()}
              className="workspace-button-secondary !px-3 !py-1.5 text-xs"
            >
              {previewCargando ? "Cargando..." : "Actualizar preview"}
            </button>
            <button
              type="button"
              disabled={enviando || preview.length === 0}
              onClick={() => void enviar("segmento")}
              className="workspace-button !px-3 !py-1.5 text-xs"
            >
              {enviando ? "Enviando..." : "Enviar comunicación"}
            </button>
          </div>

          {previewMensaje && (
            <p className="rounded-xl border border-[var(--line)] bg-[rgba(255,250,242,0.7)] px-3 py-2 text-sm text-gray-700">
              {previewMensaje}
            </p>
          )}

          <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
            {preview.map((destinatario) => (
              <div
                key={destinatario.email}
                className="rounded-xl border border-[var(--line)] bg-white/80 p-3 text-sm"
              >
                <p className="font-semibold text-gray-800">
                  {destinatario.nombreCompleto || destinatario.email}
                </p>
                <p className="text-xs text-gray-500">{destinatario.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {destinatario.actividadSlug && (
                    <span className="workspace-chip">
                      {nombreActividad(destinatario.actividadSlug)}
                    </span>
                  )}
                  <span className="workspace-chip">{destinatario.razon}</span>
                </div>
              </div>
            ))}

            {preview.length === 0 && (
              <p className="text-sm text-gray-600">
                Cargá el preview para ver destinatarios.
              </p>
            )}
          </div>
        </aside>
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
