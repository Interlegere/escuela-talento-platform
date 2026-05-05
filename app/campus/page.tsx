"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAppSession } from "@/components/auth/AppSessionProvider"
import { isDevelopmentPreviewEnabled } from "@/lib/dev-flags"
import WorkspaceHero from "@/components/ui/WorkspaceHero"

const VISTA_PREVIA_DESARROLLO = isDevelopmentPreviewEnabled()
const WHATSAPP_URL = "https://web.whatsapp.com/"
const FRASES_ORACULO = [
  "¡Que disfrutes de tu viaje!",
  "A surfear la ola",
  "No todo es lo que parece",
  "Un paso más hace la diferencia",
  "¿Cuál es tu mejor versión a lograr hoy?",
  "Desde adentro hacia afuera",
  "¡Brinda por tus logros!",
  "Profundiza siempre con un norte claro",
  "Que te importe lo que aportas",
]

type ResumenEspacio = {
  encuentros?: Array<{
    id: string | number
    titulo: string
    fecha: string
    hora: string
  }>
}

type ResumenAccesos = {
  actor?: {
    role?: string
  }
  usuario?: {
    charlaIntroHabilitada?: boolean
  }
  charlaIntro?: {
    habilitada?: boolean
    titulo?: string
    subtitulo?: string
    fechaTexto?: string | null
    meetUrl?: string | null
  }
  accesos?: Array<{
    slug: string
    acceso: boolean
    motivo?: string | null
  }>
}

function siguienteSemanaDiaHora(diaSemana: number, hora: number, minuto: number) {
  const ahora = new Date()
  const base = new Date(ahora)
  base.setSeconds(0, 0)
  base.setHours(hora, minuto, 0, 0)

  const diasHasta = (diaSemana - ahora.getDay() + 7) % 7
  base.setDate(ahora.getDate() + diasHasta)

  if (base <= ahora) {
    base.setDate(base.getDate() + 7)
  }

  return base
}

function formatearRecordatorio(fecha: Date) {
  return fecha.toLocaleString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function Card({
  titulo,
  descripcion,
  href,
  subtitulo,
  estado,
}: {
  titulo: string
  descripcion: string
  href: string
  subtitulo?: string
  estado?: string
}) {
  return (
    <a
      href={href}
      className="workspace-card-link group relative overflow-hidden"
    >
      <span className="absolute right-5 top-5 h-14 w-14 rounded-full bg-[rgba(203,138,36,0.1)] blur-xl transition group-hover:scale-125" />
      {subtitulo && (
        <p className="workspace-eyebrow !text-[0.66rem] !tracking-[0.22em]">
          {subtitulo}
        </p>
      )}
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-[-0.03em]">{titulo}</h3>
          <p className="text-sm leading-6 text-[var(--muted)]">{descripcion}</p>
          {estado && <p className="text-xs font-semibold text-[var(--sea)]">{estado}</p>}
        </div>
        <span className="workspace-chip shrink-0">Entrar</span>
      </div>
    </a>
  )
}

function RecordatorioCard({
  actividad,
  texto,
  href,
}: {
  actividad: string
  texto: string
  href: string
}) {
  return (
    <a
      href={href}
      className="workspace-card-link !rounded-[1.35rem] !p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-gray-900">{actividad}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{texto}</p>
        </div>
        <span className="workspace-chip shrink-0">Ir</span>
      </div>
    </a>
  )
}

function CharlaIntroCard({
  titulo,
  subtitulo,
  fechaTexto,
  meetUrl,
}: {
  titulo: string
  subtitulo: string
  fechaTexto?: string | null
  meetUrl?: string | null
}) {
  return (
    <section className="workspace-card-link !rounded-[1.7rem] !p-6">
      <div className="space-y-3">
        <p className="workspace-eyebrow !text-[0.7rem] !tracking-[0.22em]">
          Charla introductoria
        </p>
        <h3 className="text-[1.8rem] font-semibold tracking-[-0.04em] text-[var(--foreground)]">
          {titulo}
        </h3>
        <p className="max-w-3xl text-base leading-7 text-[var(--muted)]">
          {subtitulo}
        </p>
        {fechaTexto && (
          <p className="text-sm font-semibold text-[var(--sea)]">
            Fecha y horario: {fechaTexto}
          </p>
        )}
        <div className="flex flex-wrap gap-3 pt-2">
          {meetUrl ? (
            <a
              href={meetUrl}
              target="_blank"
              rel="noreferrer"
              className="workspace-button-primary workspace-button-primary-soft"
            >
              Ingresar a la charla
            </a>
          ) : (
            <span className="workspace-inline-note">
              El acceso a la videollamada va a aparecer acá cuando quede listo.
            </span>
          )}
          <a href="/perfil" className="workspace-button-secondary">
            Ver tu perfil
          </a>
        </div>
      </div>
    </section>
  )
}

export default function CampusPage() {
  const { data: session, status, error } = useAppSession()
  const router = useRouter()
  const [sesionDemorada, setSesionDemorada] = useState(false)
  const [resumen, setResumen] = useState<ResumenAccesos | null>(null)
  const [cargandoResumen, setCargandoResumen] = useState(false)
  const [recordatoriosEspacios, setRecordatoriosEspacios] = useState<
    Array<{ actividad: string; texto: string; href: string }>
  >([])
  const [fraseOraculo, setFraseOraculo] = useState(FRASES_ORACULO[0])
  const accesos = resumen?.accesos || []
  const accesoCasaTalentos = accesos.some(
    (item) => item.slug === "casatalentos" && item.acceso
  )
  const accesoConectando = accesos.some(
    (item) => item.slug === "conectando-sentidos" && item.acceso
  )
  const accesoMentorias = accesos.some(
    (item) => item.slug === "mentorias" && item.acceso
  )
  const accesoTerapia = accesos.some(
    (item) => item.slug === "terapia" && item.acceso
  )
  const accesoCharlaIntro = resumen?.charlaIntro?.habilitada === true
  const mostrarRecordatorioCasaTalentos =
    accesoCasaTalentos || VISTA_PREVIA_DESARROLLO
  const mostrarRecordatorioConectando =
    accesoConectando || VISTA_PREVIA_DESARROLLO

  useEffect(() => {
    if (status !== "loading") {
      setSesionDemorada(false)
      return
    }

    const timeout = window.setTimeout(() => {
      setSesionDemorada(true)
    }, 4000)

    return () => window.clearTimeout(timeout)
  }, [status])

  useEffect(() => {
    if (status !== "authenticated") return
    if (session?.user?.role === "admin") return

    const ahora = new Date()
    const claveDia = [
      ahora.getFullYear(),
      ahora.getMonth() + 1,
      ahora.getDate(),
    ].join("-")
    const semilla = claveDia
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const indice = semilla % FRASES_ORACULO.length
    setFraseOraculo(FRASES_ORACULO[indice] || FRASES_ORACULO[0])
  }, [session?.user?.role, status])

  useEffect(() => {
    const cargarRecordatorios = async () => {
      if (!session || session.user.role === "admin") {
        setRecordatoriosEspacios([])
        return
      }

      const items: Array<{ actividad: string; texto: string; href: string }> = []

      if (mostrarRecordatorioConectando) {
        const proxima = siguienteSemanaDiaHora(1, 19, 30)
        items.push({
          actividad: "Conectando Sentidos",
          texto: `Próxima reunión: ${formatearRecordatorio(proxima)}`,
          href: "/conectando-sentidos",
        })
      }

      if (mostrarRecordatorioCasaTalentos) {
        const proxima = siguienteSemanaDiaHora(5, 7, 0)
        items.push({
          actividad: "CasaTalentos",
          texto: `Próximo coworking: ${formatearRecordatorio(proxima)}`,
          href: "/casatalentos",
        })
      }

      const cargarResumenEspacio = async (
        actividadSlug: "mentorias" | "terapia",
        actividadNombre: string,
        etiqueta: string,
        textoFallback: string
      ) => {
        const res = await fetch("/api/espacios/resumen", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            actividadSlug,
          }),
        })

        if (!res.ok) return

        const data = (await res.json()) as ResumenEspacio
        const proximo = data.encuentros?.[0]

        if (!proximo) {
          items.push({
            actividad: actividadNombre,
            texto: textoFallback,
            href: actividadSlug === "mentorias" ? "/mentorias" : "/terapia",
          })
          return
        }

        const fecha = new Date(`${proximo.fecha}T${proximo.hora || "00:00"}:00`)
        items.push({
          actividad: actividadNombre,
          texto: `${etiqueta}: ${formatearRecordatorio(fecha)}`,
          href: actividadSlug === "mentorias" ? "/mentorias" : "/terapia",
        })
      }

      try {
        if (accesoMentorias) {
          await cargarResumenEspacio(
            "mentorias",
            "Mentoría",
            "Próxima reunión",
            "Tu próxima reunión aparecerá aquí cuando quede asignada."
          )
        }

        if (accesoTerapia) {
          await cargarResumenEspacio(
            "terapia",
            "Terapia",
            "Próxima sesión",
            "Tu próxima sesión aparecerá aquí cuando quede agendada."
          )
        }
      } catch {
        // Silencioso: campus debe seguir funcionando aunque falle el resumen del espacio.
      }

      setRecordatoriosEspacios(items)
    }

    if (status === "authenticated") {
      void cargarRecordatorios()
    }
  }, [
    accesoCasaTalentos,
    accesoConectando,
    accesoMentorias,
    accesoTerapia,
    mostrarRecordatorioCasaTalentos,
    mostrarRecordatorioConectando,
    session,
    status,
  ])

  useEffect(() => {
    if (status !== "unauthenticated") return
    if (VISTA_PREVIA_DESARROLLO) return

    router.replace("/login")
  }, [router, status])

  useEffect(() => {
    const cargarResumen = async () => {
      try {
        setCargandoResumen(true)

        const res = await fetch("/api/me/resumen-accesos", {
          cache: "no-store",
        })

        const data = await res.json()

        if (!res.ok) {
          setResumen(null)
          return
        }

        setResumen(data)
      } catch {
        setResumen(null)
      } finally {
        setCargandoResumen(false)
      }
    }

    if (status === "authenticated") {
      void cargarResumen()
    }
  }, [status])

  if (status === "loading") {
    return (
      <main className="workspace-page space-y-6">
        <WorkspaceHero
          eyebrow="Acceso"
          title="Campus"
          subtitle="Preparando tu acceso al espacio compartido."
        />

        <section className="workspace-panel space-y-3">
          <p>Cargando sesión...</p>
          {sesionDemorada && (
            <p className="workspace-inline-note text-amber-700">
              La sesión está tardando más de lo normal. Si estás probando desde el
              celular, puede haber un problema con la autenticación local.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>
      </main>
    )
  }

  if (!session && !VISTA_PREVIA_DESARROLLO) {
    return (
      <main className="workspace-page space-y-6">
        <WorkspaceHero
          eyebrow="Acceso"
          title="Campus"
          subtitle="Redirigiendo al inicio de sesión."
        />

        <section className="workspace-panel">
          <p>Necesitás iniciar sesión para entrar al campus.</p>
        </section>
      </main>
    )
  }

  const nombre = session?.user?.name || "Participante"
  const role = session?.user?.role || "participante"
  const esAdmin = role === "admin"
  const totalActividades = [
    accesoCasaTalentos,
    accesoConectando,
    accesoMentorias,
    accesoTerapia,
  ].filter(Boolean).length
  const modoSoloCharla = accesoCharlaIntro && totalActividades === 0

  if (esAdmin) {
    return (
      <main className="workspace-page space-y-8">
        <WorkspaceHero
          eyebrow="Coordinación"
          title="Panel operativo"
          subtitle={`Bienvenido ${nombre}. Acceso rápido a agenda, pagos y tareas de coordinación.`}
        >
          <div className="flex flex-wrap gap-3">
            <span className="workspace-chip">Administración</span>
            <span className="workspace-chip">Vista operativa</span>
          </div>
        </WorkspaceHero>

        <section className="grid gap-4 md:grid-cols-2">
          <Card
            titulo="Agenda"
            descripcion="Visualizá en un solo calendario la programación de todas las actividades y cargá nuevos encuentros según la lógica de cada espacio."
            href="/agenda"
            subtitulo="Calendario"
            estado="Prioridad diaria"
          />

          <Card
            titulo="Admin Pagos"
            descripcion="Revisá pagos mensuales, comprobantes, honorarios y estados de habilitación."
            href="/admin/pagos"
            subtitulo="Cobros"
          />

          <Card
            titulo="Admin Usuarios"
            descripcion="Creá usuarios, actualizá datos y agregá documentos de toma de notas."
            href="/admin/usuarios"
            subtitulo="Accesos"
          />
        </section>

        <section className="workspace-panel-soft flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="workspace-eyebrow">Recordatorios</p>
            <p className="workspace-inline-note">
              Revisá pagos pendientes, confirmá agenda y actualizá contenidos desde cada actividad.
            </p>
          </div>
          <a href={WHATSAPP_URL} className="workspace-button-secondary">
            WhatsApp
          </a>
        </section>
      </main>
    )
  }

  return (
      <main className="workspace-page space-y-8">
        <WorkspaceHero
          eyebrow=""
          title={`¡Bienvenido ${nombre}!`}
          subtitle={fraseOraculo}
          subtitleClassName="workspace-subtitle-oracle"
          logoClassName="!h-36 !w-36"
        >
          <div className="flex flex-wrap gap-3">
            <span className="workspace-chip">
              {modoSoloCharla ? "Charla introductoria" : "Actividades"}
            </span>
          </div>
        </WorkspaceHero>

      {modoSoloCharla && resumen?.charlaIntro && (
        <CharlaIntroCard
          titulo={resumen.charlaIntro.titulo || "Charla introductoria"}
          subtitulo={
            resumen.charlaIntro.subtitulo ||
            "Tu acceso a la charla está habilitado desde este campus."
          }
          fechaTexto={resumen.charlaIntro.fechaTexto}
          meetUrl={resumen.charlaIntro.meetUrl}
        />
      )}

      <section className="workspace-panel campus-priority-panel space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="workspace-title-sm">Tus actividades</h2>
          </div>
          <span className="workspace-chip">
            {modoSoloCharla ? "1 acceso activo" : `${totalActividades} activas`}
          </span>
        </div>

        {cargandoResumen && (
          <p className="workspace-inline-note">Cargando accesos...</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {accesoCasaTalentos && (
            <Card
              titulo="CasaTalentos"
              descripcion="Acceso a la actividad, biblioteca, reunión semanal y dispositivo de videos."
              href="/casatalentos"
              subtitulo="Coworking creativo"
              estado="Trabajo semanal"
            />
          )}

          {accesoConectando && (
            <Card
              titulo="Conectando Sentidos"
              descripcion="Acceso a sesiones grupales y grabaciones disponibles."
              href="/conectando-sentidos"
              subtitulo="Espacio grupal"
              estado="Encuentro analítico"
            />
          )}

          {accesoMentorias && (
            <Card
              titulo="Mentoría"
              descripcion="Acceso a tu espacio de trabajo."
              href="/mentorias"
              subtitulo="Reuniones TMV"
            />
          )}

          {accesoTerapia && (
            <Card
              titulo="Terapia"
              descripcion="Acceso al espacio terapéutico individual."
              href="/terapia"
              subtitulo="Proceso terapéutico"
              estado="Sesiones y recursos"
            />
          )}
        </div>

        {!cargandoResumen &&
          !accesoCasaTalentos &&
          !accesoConectando &&
          !accesoMentorias &&
          !accesoTerapia &&
          !accesoCharlaIntro && (
            <p className="workspace-inline-note">
              Todavía no tenés accesos activos a módulos de participantes.
            </p>
          )}

        {modoSoloCharla && (
          <p className="workspace-inline-note">
            Tu acceso actual está orientado a la charla introductoria. Desde acá vas a encontrar el ingreso a la videollamada.
          </p>
        )}
      </section>

      {recordatoriosEspacios.length > 0 && (
        <section className="workspace-panel space-y-4">
          <h2 className="workspace-title-sm">Recordatorios</h2>
          <div className="space-y-3">
            {recordatoriosEspacios.map((item) => (
              <RecordatorioCard
                key={`${item.actividad}-${item.texto}`}
                actividad={item.actividad}
                texto={item.texto}
                href={item.href}
              />
            ))}
          </div>
        </section>
      )}

      {modoSoloCharla && resumen?.charlaIntro?.meetUrl && (
        <section className="workspace-panel-soft flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="workspace-eyebrow">Acceso a la charla</p>
            <p className="workspace-inline-note">
              Cuando llegue el momento, ingresá desde este botón a la videollamada.
            </p>
          </div>
          <a
            href={resumen.charlaIntro.meetUrl}
            target="_blank"
            rel="noreferrer"
            className="workspace-button-primary"
          >
            Ir a la videollamada
          </a>
        </section>
      )}

      <section className="workspace-panel-soft flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="workspace-eyebrow">Comunidad</p>
          <h2 className="text-xl font-semibold">WhatsApp de la comunidad</h2>
          <p className="workspace-inline-note">
            Un acceso directo al intercambio cotidiano cuando lo necesites.
          </p>
        </div>
        <div>
          <a href={WHATSAPP_URL} className="workspace-button-secondary">
            Abrir WhatsApp
          </a>
        </div>
      </section>
    </main>
  )
}
