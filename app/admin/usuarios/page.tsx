"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAppSession } from "@/components/auth/AppSessionProvider"
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
  role: "admin" | "colaborador" | "participante"
  activo: boolean
  created_at?: string | null
}

type FormState = {
  id: string
  nombre: string
  apellido: string
  email: string
  whatsapp: string
  fechaCumpleanos: string
  notasDocumentos: string
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

export default function AdminUsuariosPage() {
  const { data: session, status } = useAppSession()
  const router = useRouter()

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
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

  useEffect(() => {
    if (status === "authenticated" && esAdmin) {
      void cargarUsuarios()
    }
  }, [cargarUsuarios, esAdmin, status])

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()

    if (!q) {
      return usuarios
    }

    return usuarios.filter((usuario) => {
      return (
        usuario.nombre.toLowerCase().includes(q) ||
        String(usuario.apellido || "").toLowerCase().includes(q) ||
        usuario.email.toLowerCase().includes(q) ||
        usuario.role.toLowerCase().includes(q)
      )
    })
  }, [busqueda, usuarios])

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
          ? " Email de bienvenida enviado."
          : ` ${mailing.motivo || "Email de bienvenida no enviado."}`
        : ""

      setMensaje(
        `${payload.id ? "Usuario actualizado." : "Usuario creado."}${mailingMensaje}`
      )
      limpiarForm()
      await cargarUsuarios()
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
            Creá participantes, colaboradores o administradores. Después podés
            asignar actividades, honorarios y agenda desde las secciones
            correspondientes.
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
            Crear el usuario habilita el login. Si el mailing está configurado,
            puede recibir la bienvenida con link y credenciales. El acceso a
            actividades se define aparte desde honorarios, agenda o accesos.
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
          Enviar email de bienvenida si hay contraseña cargada
        </label>

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
              placeholder="Nombre, email o rol"
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
          {usuariosFiltrados.map((usuario) => (
            <article
              key={usuario.id}
              className="rounded-[1.4rem] border border-[var(--line)] bg-[rgba(255,250,242,0.68)] p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold tracking-[-0.03em]">
                      {usuario.nombre}
                    </h3>
                    <span className="workspace-chip">
                      {etiquetaRol(usuario.role)}
                    </span>
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
                  {normalizarDocumentosNotas(usuario.notas_documentos).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
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
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => editarUsuario(usuario)}
                    className="workspace-button-secondary"
                  >
                    Editar
                  </button>

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
          ))}
        </div>
      </section>
    </main>
  )
}
