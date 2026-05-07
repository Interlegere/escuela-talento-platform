"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAppSession } from "@/components/auth/AppSessionProvider"
import {
  normalizarDocumentosNotas,
  serializarDocumentosNotas,
} from "@/lib/documentos-notas"
import { etiquetaModalidadPago, type BillingMode } from "@/lib/billing"

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
}

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

export default function AdminUsuariosPage() {
  const { data: session, status } = useAppSession()
  const router = useRouter()

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [honorarios, setHonorarios] = useState<HonorarioAsignado[]>([])
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [mensaje, setMensaje] = useState("")
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [busqueda, setBusqueda] = useState("")

  const esAdmin = session?.user?.role === "admin"
  const editando = Boolean(form.id)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [router, status])

  const cargarUsuarios = useCallback(async () => {
    try {
      setCargando(true)
      setMensaje("")

      const res = await fetch("/api/admin/usuarios", { cache: "no-store" })
      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudieron cargar los usuarios.")
        return
      }

      setUsuarios(data.usuarios || [])
    } catch {
      setMensaje("Error cargando usuarios.")
    } finally {
      setCargando(false)
    }
  }, [])

  const cargarHonorarios = useCallback(async () => {
    try {
      const res = await fetch("/admin/pagos-mensuales/honorarios", {
        cache: "no-store",
      })
      const data = await res.json()

      if (!res.ok) {
        setMensaje(data.error || "No se pudieron cargar las actividades asignadas.")
        return
      }

      setHonorarios(data.honorarios || [])
    } catch {
      setMensaje("Error cargando actividades asignadas.")
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated" && esAdmin) {
      void cargarUsuarios()
      void cargarHonorarios()
    }
  }, [cargarHonorarios, cargarUsuarios, esAdmin, status])

  const honorariosPorEmail = useMemo(() => {
    const mapa = new Map<string, HonorarioAsignado[]>()

    for (const item of honorarios) {
      const email = String(item.participante_email || "").trim().toLowerCase()
      if (!email) continue

      const existentes = mapa.get(email) || []
      existentes.push(item)
      mapa.set(email, existentes)
    }

    return mapa
  }, [honorarios])

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()

    if (!q) return usuarios

    return usuarios.filter((usuario) => {
      const email = usuario.email.trim().toLowerCase()
      const actividadesUsuario = honorariosPorEmail.get(email) || []
      const actividadesTexto = actividadesUsuario
        .map((item) => `${item.actividad_nombre} ${item.actividad_slug}`)
        .join(" ")
        .toLowerCase()

      const charlaTexto = usuario.charla_intro_habilitada
        ? "charla introductoria charla tiempo"
        : ""

      return (
        usuario.nombre.toLowerCase().includes(q) ||
        String(usuario.apellido || "").toLowerCase().includes(q) ||
        usuario.email.toLowerCase().includes(q) ||
        usuario.role.toLowerCase().includes(q) ||
        charlaTexto.includes(q) ||
        actividadesTexto.includes(q)
      )
    })
  }, [busqueda, honorariosPorEmail, usuarios])

  const limpiarForm = () => {
    setForm(FORM_INICIAL)
  }

  const editarUsuario = (usuario: Usuario) => {
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
    })
    setMensaje("Editando usuario. Dejá la contraseña vacía si no querés cambiarla.")
  }

  const guardarUsuario = async (payload: FormState = form) => {
    try {
      setGuardando(true)
      setMensaje("")

      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

      setMensaje(
        `${payload.id ? "Usuario actualizado." : "Usuario creado."}${mailingMensaje}`
      )

      limpiarForm()
      await cargarUsuarios()
      await cargarHonorarios()
    } catch {
      setMensaje("Error guardando usuario.")
    } finally {
      setGuardando(false)
    }
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
          <h1 className="workspace-title">Usuarios</h1>
          <p className="workspace-subtitle">
            Creá participantes, colaboradores o administradores. Esta vista
            empieza a funcionar como ficha central de cada persona: datos,
            estado, charla introductoria y actividades configuradas.
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
            Crear el usuario habilita el login. El acceso a actividades se
            configura desde Admin Pagos, pero debajo vas a poder ver el resumen
            por persona.
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
              {editando ? "Nueva contraseña opcional" : "Contraseña inicial"}
            </span>
            <input
              className="workspace-field"
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, password: e.target.value }))
              }
              placeholder={editando ? "Dejar vacía para no cambiar" : "Mínimo 4 caracteres"}
            />
          </label>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.68)] p-4 space-y-3">
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
                Al crear el usuario con esta opción y una contraseña cargada, se
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
              ? "Enviar email de invitación a la charla si hay contraseña cargada"
              : "Enviar email de bienvenida si hay contraseña cargada"}
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
            <p className="workspace-eyebrow">Base de usuarios</p>
            <h2 className="workspace-title-sm">Usuarios creados</h2>
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

        {cargando && <p className="workspace-inline-note">Cargando usuarios...</p>}

        {!cargando && usuariosFiltrados.length === 0 && (
          <div className="rounded-2xl border border-[var(--line)] p-4">
            Todavía no hay usuarios creados en la base nueva.
          </div>
        )}

        <div className="grid gap-3">
          {usuariosFiltrados.map((usuario) => {
            const email = usuario.email.trim().toLowerCase()
            const actividadesUsuario = honorariosPorEmail.get(email) || []

            return (
              <article
                key={usuario.id}
                className="rounded-[1.4rem] border border-[var(--line)] bg-[rgba(255,250,242,0.68)] p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold tracking-[-0.03em]">
                        {[usuario.nombre, usuario.apellido].filter(Boolean).join(" ") ||
                          usuario.email}
                      </h3>

                      <span className="workspace-chip">
                        {etiquetaRol(usuario.role)}
                      </span>

                      {usuario.charla_intro_habilitada && (
                        <span className="rounded-full border border-[rgba(201,139,27,0.28)] bg-[rgba(201,139,27,0.12)] px-3 py-1 text-xs font-medium text-[rgb(154,101,21)]">
                          Charla introductoria
                        </span>
                      )}

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          usuario.activo
                            ? "border-[rgba(52,125,89,0.2)] bg-[rgba(52,125,89,0.1)] text-[rgb(52,125,89)]"
                            : "border-[rgba(156,69,59,0.2)] bg-[rgba(156,69,59,0.1)] text-[rgb(156,69,59)]"
                        }`}
                      >
                        {usuario.activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>

                    <div>
                      <p className="workspace-inline-note">{usuario.email}</p>

                      {(usuario.whatsapp || usuario.fecha_cumpleanos) && (
                        <p className="workspace-inline-note">
                          {usuario.whatsapp ? `WhatsApp: ${usuario.whatsapp}` : ""}
                          {usuario.whatsapp && usuario.fecha_cumpleanos ? " · " : ""}
                          {usuario.fecha_cumpleanos
                            ? `Cumpleaños: ${usuario.fecha_cumpleanos}`
                            : ""}
                        </p>
                      )}
                    </div>

                    {normalizarDocumentosNotas(usuario.notas_documentos).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {normalizarDocumentosNotas(usuario.notas_documentos).map(
                          (documento) => (
                            <a
                              key={`${usuario.id}-${documento.url}`}
                              href={documento.url}
                              target="_blank"
                              rel="noreferrer"
                              className="workspace-button-secondary !px-3 !py-1.5 text-xs"
                            >
                              {documento.titulo}
                            </a>
                          )
                        )}
                      </div>
                    )}

                    <div className="rounded-2xl border border-[var(--line)] bg-white/60 p-3">
                      <p className="text-sm font-semibold text-gray-900">
                        Actividades configuradas
                      </p>

                      {actividadesUsuario.length === 0 ? (
                        <p className="mt-1 text-sm text-gray-500">
                          No tiene actividades configuradas desde Admin Pagos.
                        </p>
                      ) : (
                        <div className="mt-3 grid gap-2">
                          {actividadesUsuario.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-xl border border-[var(--line)] bg-[rgba(255,250,242,0.74)] p-3 text-sm"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <strong>{item.actividad_nombre}</strong>
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-xs ${
                                    item.activo
                                      ? "border-green-200 bg-green-50 text-green-800"
                                      : "border-red-200 bg-red-50 text-red-800"
                                  }`}
                                >
                                  {item.activo ? "Activa" : "Inactiva"}
                                </span>
                              </div>

                              <p className="mt-1 text-gray-600">
                                {etiquetaModalidadPago(
                                  item.modalidad_pago,
                                  item.actividad_slug
                                )}{" "}
                                · {item.moneda} {item.honorario_mensual}
                              </p>

                              <p className="mt-1 text-gray-500">
                                Último pago:{" "}
                                <strong>{estadoPagoLabel(item.ultimo_pago?.estado)}</strong>
                                {item.ultimo_pago?.monto
                                  ? ` · ${item.ultimo_pago.moneda} ${item.ultimo_pago.monto}`
                                  : ""}
                                {item.ultimo_pago?.mes && item.ultimo_pago?.anio
                                  ? ` · ${item.ultimo_pago.mes}/${item.ultimo_pago.anio}`
                                  : ""}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => editarUsuario(usuario)}
                      className="workspace-button-secondary"
                    >
                      Editar
                    </button>

                    <Link
                      href={`/admin/pagos?participante=${encodeURIComponent(
                        usuario.email
                      )}`}
                      className="workspace-button-secondary"
                    >
                      Ver pagos
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        const payload: FormState = {
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
                        }

                        void guardarUsuario(payload)
                      }}
                      className="workspace-button-secondary"
                    >
                      {usuario.activo ? "Desactivar" : "Reactivar"}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}