"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAppSession } from "@/components/auth/AppSessionProvider"
import WorkspaceHero from "@/components/ui/WorkspaceHero"
import ConsentimientoMeetButton from "@/components/consentimientos/ConsentimientoMeetButton"
import AdminAgendaCalendar from "@/components/agenda/AdminAgendaCalendar"
import { ACTIVITY_RULES, type AgendaStrategy } from "@/lib/activity-rules"
import {
  parsearDocumentosNotasDesdeTexto,
  type DocumentoNota,
} from "@/lib/documentos-notas"

type AgendaItem = {
  id: string
  disponibilidadId?: number | null
  reservaId?: number | null
  actividadSlug:
    | "casatalentos"
    | "conectando-sentidos"
    | "mentorias"
    | "terapia"
    | "membresia"
  actividadNombre: string
  titulo: string
  fecha: string
  hora: string
  duracion: string
  estrategia: AgendaStrategy
  origen: "disponibilidad" | "reserva"
  estado: "disponible" | "pendiente_pago" | "confirmada" | "realizada" | "bloqueado"
  meetLink?: string | null
  participanteNombre?: string | null
  participanteEmail?: string | null
  requierePago: boolean
  precio?: string | null
  medioPago?: string | null
  montoTransferencia?: string | null
  montoMercadoPago?: string | null
  comprobanteNombreArchivo?: string | null
  estadoPagoAdmin?: string | null
  detallePagoAdmin?: string | null
  puedeIngresar: boolean
  motivoBloqueo?: string | null
  notasDocumentos?: DocumentoNota[]
  visibleParaParticipante: boolean
  eliminablePorAdmin: boolean
}

type ParticipanteActividad = {
  email: string
  nombre: string
}

type ActividadGestionable =
  | "casatalentos"
  | "conectando-sentidos"
  | "mentorias"
  | "terapia"

function formatearFecha(fecha: string) {
  const d = new Date(`${fecha}T00:00:00`)

  if (Number.isNaN(d.getTime())) {
    return fecha
  }

  return d.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function configurarDefaultsActividad(actividadSlug: ActividadGestionable) {
  switch (actividadSlug) {
    case "casatalentos":
      return {
        titulo: "Reunión CasaTalentos",
        duracion: "60",
        esRecurrente: true,
        diaSemana: "Viernes",
        hora: "07:00",
      }
    case "conectando-sentidos":
      return {
        titulo: "Sesión Conectando Sentidos",
        duracion: "60",
        esRecurrente: true,
        diaSemana: "Lunes",
        hora: "19:30",
      }
    case "mentorias":
      return {
        titulo: "Reunión TMV",
        duracion: "60",
        esRecurrente: false,
        diaSemana: "Jueves",
        hora: "",
      }
    case "terapia":
      return {
        titulo: "Sesión de Terapia",
        duracion: "60",
        esRecurrente: false,
        diaSemana: "Jueves",
        hora: "",
      }
  }
}

function formatearFechaInput(fechaObj: Date) {
  const anio = fechaObj.getFullYear()
  const mes = String(fechaObj.getMonth() + 1).padStart(2, "0")
  const dia = String(fechaObj.getDate()).padStart(2, "0")
  return `${anio}-${mes}-${dia}`
}

function sumarDias(base: Date, dias: number) {
  const copia = new Date(base)
  copia.setDate(copia.getDate() + dias)
  return copia
}

async function leerJson<T>(res: Response): Promise<T> {
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

export default function AgendaPage() {
  const { data: session, status } = useAppSession()
  const router = useRouter()

  const [items, setItems] = useState<AgendaItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState("")
  const [error, setError] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<number | null>(null)

  const [actividadSlug, setActividadSlug] =
    useState<ActividadGestionable>("terapia")
  const [titulo, setTitulo] = useState(configurarDefaultsActividad("terapia").titulo)
  const [fecha, setFecha] = useState("")
  const [hora, setHora] = useState(configurarDefaultsActividad("terapia").hora)
  const [duracion, setDuracion] = useState(
    configurarDefaultsActividad("terapia").duracion
  )
  const [esRecurrente, setEsRecurrente] = useState(
    configurarDefaultsActividad("terapia").esRecurrente
  )
  const [diaSemana, setDiaSemana] = useState(
    configurarDefaultsActividad("terapia").diaSemana
  )
  const [cantidadSemanas, setCantidadSemanas] = useState("8")
  const [participanteEmail, setParticipanteEmail] = useState("")
  const [notasDocumentos, setNotasDocumentos] = useState("")
  const [participantesMentoria, setParticipantesMentoria] = useState<
    ParticipanteActividad[]
  >([])

  const esAdmin = session?.user?.role === "admin"

  const cargarAgenda = useCallback(async () => {
    try {
      setCargando(true)
      setError("")

      const res = await fetch("/api/agenda/unificada", {
        method: "GET",
        cache: "no-store",
      })

      const data = await leerJson<{ items?: AgendaItem[]; error?: string }>(res)

      if (!res.ok) {
        setError(data.error || "No se pudo cargar la agenda.")
        return
      }

      setItems(data.items || [])
    } catch {
      setError("Error cargando la agenda.")
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [router, status])

  useEffect(() => {
    if (status === "authenticated") {
      void cargarAgenda()
    }
  }, [cargarAgenda, status])

  useEffect(() => {
    const defaults = configurarDefaultsActividad(actividadSlug)
    setTitulo(defaults.titulo)
    setDuracion(defaults.duracion)
    setEsRecurrente(defaults.esRecurrente)
    setDiaSemana(defaults.diaSemana)
    setHora(defaults.hora)
    setFecha("")
    setParticipanteEmail("")
    setNotasDocumentos("")
  }, [actividadSlug])

  useEffect(() => {
    const cargarParticipantes = async () => {
      if (!esAdmin || actividadSlug !== "mentorias") {
        setParticipantesMentoria([])
        return
      }

      try {
        const res = await fetch("/api/agenda/admin/participantes-actividad", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            actividadSlug: "mentorias",
          }),
        })

        const data = await leerJson<{
          participantes?: ParticipanteActividad[]
          error?: string
        }>(res)

        if (!res.ok) {
          return
        }

        setParticipantesMentoria(data.participantes || [])
      } catch {
        setParticipantesMentoria([])
      }
    }

    if (status === "authenticated") {
      void cargarParticipantes()
    }
  }, [actividadSlug, esAdmin, status])

  const itemsAgrupados = useMemo(() => {
    const grupos = new Map<string, AgendaItem[]>()

    for (const item of items) {
      if (!grupos.has(item.fecha)) {
        grupos.set(item.fecha, [])
      }

      grupos.get(item.fecha)?.push(item)
    }

    return Array.from(grupos.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fechaGrupo, itemsGrupo]) => ({
        fecha: fechaGrupo,
        items: itemsGrupo.sort((a, b) => a.hora.localeCompare(b.hora)),
      }))
  }, [items])

  const estrategiaActual = ACTIVITY_RULES[actividadSlug].agendaStrategy
  const requiereParticipante = actividadSlug === "mentorias"

  const crearProgramacion = async () => {
    try {
      setGuardando(true)
      setError("")
      setMensaje("")

      if (!titulo.trim() || !hora.trim() || !duracion.trim()) {
        setError("Completá título, hora y duración.")
        return
      }

      if (!esRecurrente && !fecha) {
        setError("Elegí una fecha para crear la programación.")
        return
      }

      if (requiereParticipante && !participanteEmail) {
        setError("Elegí el participante para esa programación.")
        return
      }

      const participante = participantesMentoria.find(
        (item) => item.email === participanteEmail
      )

      const basePayload = {
        titulo: titulo.trim(),
        tipo:
          actividadSlug === "terapia"
            ? "Terapia"
            : actividadSlug === "mentorias"
              ? "Mentoría"
              : "Actividad grupal",
        actividad_slug: actividadSlug,
        modo:
          estrategiaActual === "reserva_individual"
            ? ("disponibilidad" as const)
            : ("actividad_fija" as const),
        duracion: duracion.trim(),
        meet_link: "https://meet.google.com/new",
        requiere_pago: false,
        precio: "",
        estado: "disponible" as const,
        reservado_por: null,
        participante_email: requiereParticipante ? participanteEmail : null,
        participante_nombre: requiereParticipante ? participante?.nombre || null : null,
        notas_documentos: parsearDocumentosNotasDesdeTexto(notasDocumentos),
        google_event_id: null,
        google_calendar_id: null,
        sync_status:
          estrategiaActual === "reserva_individual"
            ? "no_crear_hasta_reserva"
            : "pendiente",
        last_synced_at: null,
      }

      let itemsAInsertar: Array<Record<string, unknown>> = []

      if (!esRecurrente) {
        itemsAInsertar = [
          {
            ...basePayload,
            fecha,
            hora,
            es_recurrente: false,
            dia_semana: null,
            excepcion_fechas: "",
          },
        ]
      } else {
        const cantidad = Number(cantidadSemanas)

        if (!cantidad || cantidad < 1) {
          setError("La cantidad de semanas debe ser mayor a 0.")
          return
        }

        const diasSemana = [
          "Domingo",
          "Lunes",
          "Martes",
          "Miércoles",
          "Jueves",
          "Viernes",
          "Sábado",
        ]

        const indiceDia = diasSemana.indexOf(diaSemana)

        if (indiceDia === -1) {
          setError("Día de semana inválido.")
          return
        }

        const fechasAInsertar: string[] = []
        let cursor = new Date()
        let encontradas = 0

        while (encontradas < cantidad) {
          if (cursor.getDay() === indiceDia) {
            fechasAInsertar.push(formatearFechaInput(cursor))
            encontradas += 1
          }

          cursor = sumarDias(cursor, 1)
        }

        itemsAInsertar = fechasAInsertar.map((fechaGenerada) => ({
          ...basePayload,
          fecha: fechaGenerada,
          hora,
          es_recurrente: true,
          dia_semana: diaSemana,
          excepcion_fechas: "",
        }))
      }

      const res = await fetch("/api/agenda/admin/crear-disponibilidades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: itemsAInsertar,
        }),
      })

      const data = await leerJson<{
        error?: string
        items?: Array<{ id: number }>
      }>(res)

      if (!res.ok) {
        setError(data.error || "No se pudo crear la programación.")
        return
      }

      if (estrategiaActual !== "reserva_individual") {
        for (const creado of data.items || []) {
          await fetch("/api/google/sync-disponibilidad", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              disponibilidadId: creado.id,
            }),
          })
        }
      }

      setMensaje("Programación creada correctamente.")
      setNotasDocumentos("")
      await cargarAgenda()
    } catch {
      setError("Error creando la programación.")
    } finally {
      setGuardando(false)
    }
  }

  const eliminarDisponibilidad = async (disponibilidadId: number) => {
    try {
      setEliminandoId(disponibilidadId)
      setError("")
      setMensaje("")

      const res = await fetch("/api/agenda/admin/eliminar-disponibilidad", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          disponibilidadId,
        }),
      })

      const data = await leerJson<{ error?: string }>(res)

      if (!res.ok) {
        setError(data.error || "No se pudo eliminar el encuentro.")
        return
      }

      setMensaje("Encuentro eliminado correctamente.")
      await cargarAgenda()
    } catch {
      setError("Error eliminando el encuentro.")
    } finally {
      setEliminandoId(null)
    }
  }

  if (status === "loading") {
    return (
      <main className="workspace-page space-y-6">
        <WorkspaceHero
          eyebrow="Agenda"
          title="Agenda unificada"
          subtitle="Preparando la programación general de la escuela."
        />
        <section className="workspace-panel">
          <p>Cargando agenda...</p>
        </section>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="workspace-page space-y-6">
        <WorkspaceHero
          eyebrow="Agenda"
          title="Agenda unificada"
          subtitle="Necesitás iniciar sesión para ver la programación."
        />
      </main>
    )
  }

  return (
    <main className="workspace-page space-y-6">
      <WorkspaceHero
        eyebrow={esAdmin ? "Programación general" : "Tus encuentros"}
        title="Agenda unificada"
        subtitle={
          esAdmin
            ? "Acá ves en un solo lugar la programación de CasaTalentos, Conectando Sentidos, Mentorías y Terapia."
            : "Acá ves la programación que te corresponde en todas tus actividades activas."
        }
      />

      {mensaje && (
        <section className="workspace-panel text-green-700">{mensaje}</section>
      )}

      {error && (
        <section className="workspace-panel text-red-600">{error}</section>
      )}

      {esAdmin && (
        <section className="workspace-panel space-y-4">
          <div className="space-y-1">
            <p className="workspace-eyebrow">Crear programación</p>
            <h2 className="workspace-title-sm">Programar por actividad</h2>
            <p className="workspace-inline-note">
              Cada actividad se carga distinto: CasaTalentos y Conectando
              Sentidos como encuentros grupales fijos, Mentorías como reuniones
              individuales asignadas y Terapia como disponibilidades reservables.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <select
              className="workspace-field"
              value={actividadSlug}
              onChange={(e) => setActividadSlug(e.target.value as ActividadGestionable)}
            >
              <option value="casatalentos">CasaTalentos</option>
              <option value="conectando-sentidos">Conectando Sentidos</option>
              <option value="mentorias">Mentorías</option>
              <option value="terapia">Terapia</option>
            </select>

            <input
              className="workspace-field"
              placeholder="Título"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />

            <input
              className="workspace-field"
              placeholder="Duración en minutos"
              value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
            />

            {!esRecurrente && (
              <input
                className="workspace-field"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            )}

            <input
              className="workspace-field"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />

            {requiereParticipante && (
              <select
                className="workspace-field"
                value={participanteEmail}
                onChange={(e) => setParticipanteEmail(e.target.value)}
              >
                <option value="">Elegí participante</option>
                {participantesMentoria.map((item) => (
                  <option key={item.email} value={item.email}>
                    {item.nombre} · {item.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">
              Documentos de notas para este encuentro
            </span>
            <textarea
              className="workspace-field min-h-28"
              value={notasDocumentos}
              onChange={(e) => setNotasDocumentos(e.target.value)}
              placeholder="Opcional. Un documento por línea. Ej: Notas reunión | https://docs.google.com/document/..."
            />
            <p className="workspace-inline-note">
              Se mostrarán sólo para admin antes de entrar al Meet. Podés cargar
              links específicos de CasaTalentos, Conectando Sentidos, Mentoría o
              Terapia.
            </p>
          </label>

          <label className="flex items-center gap-3 text-sm text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={esRecurrente}
              onChange={(e) => setEsRecurrente(e.target.checked)}
            />
            Repetir semanalmente
          </label>

          {esRecurrente && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <select
                className="workspace-field"
                value={diaSemana}
                onChange={(e) => setDiaSemana(e.target.value)}
              >
                <option value="Lunes">Lunes</option>
                <option value="Martes">Martes</option>
                <option value="Miércoles">Miércoles</option>
                <option value="Jueves">Jueves</option>
                <option value="Viernes">Viernes</option>
                <option value="Sábado">Sábado</option>
                <option value="Domingo">Domingo</option>
              </select>

              <input
                className="workspace-field"
                placeholder="Cantidad de semanas"
                value={cantidadSemanas}
                onChange={(e) => setCantidadSemanas(e.target.value)}
              />
            </div>
          )}

          <div className="workspace-panel-soft">
            <p className="workspace-inline-note">
              Regla actual:
              {" "}
              {actividadSlug === "casatalentos" &&
                "el acceso mensual sostiene reuniones y dispositivo semanal."}
              {actividadSlug === "conectando-sentidos" &&
                "el acceso mensual habilita la sesión grupal."}
              {actividadSlug === "mentorias" &&
                "la videollamada queda habilitada según el pago mensual de la Mentoría."}
              {actividadSlug === "terapia" &&
                "cada sesión se agenda primero y luego define el pago según la modalidad asignada."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void crearProgramacion()}
              disabled={guardando}
              className="workspace-button-primary disabled:opacity-60"
            >
              {guardando ? "Guardando..." : "Guardar programación"}
            </button>
          </div>
        </section>
      )}

      <section className="workspace-panel space-y-4">
        <div className="space-y-1">
          <p className="workspace-eyebrow">
            {esAdmin ? "Vista general" : "Programación"}
          </p>
          <h2 className="workspace-title-sm">
            {esAdmin ? "Toda la agenda de la escuela" : "Tu agenda"}
          </h2>
        </div>

        {cargando && <p className="workspace-inline-note">Cargando encuentros...</p>}

        {!cargando && itemsAgrupados.length === 0 && (
          <p className="workspace-inline-note">
            {esAdmin
              ? "Todavía no hay programación cargada."
              : "Todavía no tenés encuentros visibles en agenda. Tus reservas y reuniones van a aparecer acá cuando queden programadas."}
          </p>
        )}

        {esAdmin ? (
          <AdminAgendaCalendar
            items={items}
            eliminandoId={eliminandoId}
            onRefresh={cargarAgenda}
            onEliminar={(disponibilidadId) => {
              void eliminarDisponibilidad(disponibilidadId)
            }}
          />
        ) : (
          <div className="space-y-5">
            {itemsAgrupados.map((grupo) => (
              <div key={grupo.fecha} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold tracking-[-0.02em] text-gray-900">
                    {formatearFecha(grupo.fecha)}
                  </h3>
                  <span className="workspace-chip">
                    {grupo.items.length} encuentro{grupo.items.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="grid gap-4">
                  {grupo.items.map((item) => (
                    <article
                      key={item.id}
                      className="workspace-card-link !rounded-[1.45rem] !p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="workspace-chip">{item.actividadNombre}</span>
                        <span className="workspace-chip">{item.estado}</span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-lg font-semibold tracking-[-0.03em]">
                          {item.titulo}
                        </h4>
                        <p className="workspace-inline-note">
                          {item.hora} · {item.duracion} min
                        </p>
                        {item.participanteNombre && (
                          <p className="workspace-inline-note">
                            Participante: {item.participanteNombre}
                            {item.participanteEmail ? ` · ${item.participanteEmail}` : ""}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {item.meetLink &&
                          item.puedeIngresar &&
                          item.actividadSlug !== "membresia" && (
                          <ConsentimientoMeetButton
                            actividad={item.actividadSlug}
                            href={item.meetLink}
                            disponibilidadId={item.disponibilidadId}
                            fechaEncuentro={item.fecha}
                            horaEncuentro={item.hora}
                            className="workspace-button-secondary"
                          >
                            Ir al encuentro
                          </ConsentimientoMeetButton>
                        )}

                        {item.motivoBloqueo && (
                          <p className="workspace-inline-note text-amber-700">
                            {item.motivoBloqueo}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {!esAdmin && (
        <section className="workspace-panel-soft space-y-3">
          <p className="font-medium">Gestión por actividad</p>
          <p className="workspace-inline-note">
            Terapia se agenda desde la propia sección de Terapia. Las demás
            actividades también mantienen su dinámica dentro de cada espacio.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/casatalentos" className="workspace-button-secondary">
              CasaTalentos
            </Link>
            <Link href="/conectando-sentidos" className="workspace-button-secondary">
              Conectando Sentidos
            </Link>
            <Link href="/mentorias" className="workspace-button-secondary">
              Mentorías
            </Link>
            <Link href="/terapia" className="workspace-button-secondary">
              Terapia
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}
