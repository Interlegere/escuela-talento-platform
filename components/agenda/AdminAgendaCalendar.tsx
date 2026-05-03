"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import ConsentimientoMeetButton from "@/components/consentimientos/ConsentimientoMeetButton"
import type { DocumentoNota } from "@/lib/documentos-notas"

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
  eliminablePorAdmin: boolean
}

type Props = {
  items: AgendaItem[]
  eliminandoId: number | null
  onEliminar: (disponibilidadId: number) => void
  onRefresh?: () => Promise<void> | void
}

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

type EstadoFiltro = "todos" | AgendaItem["estado"]
type ActividadFiltro = "todas" | AgendaItem["actividadSlug"]

function parseFechaLocal(fecha: string) {
  const [anio, mes, dia] = fecha.split("-").map(Number)
  return new Date(anio, (mes || 1) - 1, dia || 1)
}

function formatearFechaIso(fecha: Date) {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, "0")
  const dia = String(fecha.getDate()).padStart(2, "0")
  return `${anio}-${mes}-${dia}`
}

function formatearMes(fecha: Date) {
  return fecha.toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  })
}

function formatearFechaLarga(fechaIso: string) {
  const fecha = parseFechaLocal(fechaIso)
  return fecha.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function obtenerInicioGrilla(fecha: Date) {
  const inicioMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1)
  const diaSemana = (inicioMes.getDay() + 6) % 7
  inicioMes.setDate(inicioMes.getDate() - diaSemana)
  return inicioMes
}

function sumarDias(fecha: Date, cantidad: number) {
  const copia = new Date(fecha)
  copia.setDate(copia.getDate() + cantidad)
  return copia
}

function colorActividad(slug: AgendaItem["actividadSlug"]) {
  switch (slug) {
    case "casatalentos":
      return "bg-[rgba(203,138,36,0.12)] text-[var(--accent-strong)] border-[rgba(203,138,36,0.24)]"
    case "conectando-sentidos":
      return "bg-[rgba(44,103,117,0.12)] text-[var(--brand)] border-[rgba(44,103,117,0.24)]"
    case "mentorias":
      return "bg-[rgba(93,78,55,0.12)] text-[rgb(93,78,55)] border-[rgba(93,78,55,0.18)]"
    case "terapia":
      return "bg-[rgba(125,92,62,0.12)] text-[rgb(125,92,62)] border-[rgba(125,92,62,0.18)]"
    case "membresia":
      return "bg-[rgba(47,109,115,0.1)] text-[var(--sea)] border-[rgba(47,109,115,0.18)]"
  }
}

function colorEstado(estado: AgendaItem["estado"]) {
  switch (estado) {
    case "disponible":
      return "bg-[rgba(52,125,89,0.1)] text-[rgb(52,125,89)] border-[rgba(52,125,89,0.18)]"
    case "pendiente_pago":
      return "bg-[rgba(203,138,36,0.12)] text-[var(--accent-strong)] border-[rgba(203,138,36,0.24)]"
    case "confirmada":
      return "bg-[rgba(44,103,117,0.12)] text-[var(--brand)] border-[rgba(44,103,117,0.24)]"
    case "realizada":
      return "bg-[rgba(93,78,55,0.12)] text-[rgb(93,78,55)] border-[rgba(93,78,55,0.2)]"
    case "bloqueado":
      return "bg-[rgba(156,69,59,0.12)] text-[rgb(156,69,59)] border-[rgba(156,69,59,0.2)]"
  }
}

function etiquetaEstado(estado: AgendaItem["estado"]) {
  switch (estado) {
    case "disponible":
      return "Disponible"
    case "pendiente_pago":
      return "Pendiente de pago"
    case "confirmada":
      return "Confirmada"
    case "realizada":
      return "Realizada"
    case "bloqueado":
      return "Bloqueada"
  }
}

function descripcionCobro(item: AgendaItem) {
  if (!item.requierePago) {
    return item.actividadSlug === "terapia"
      ? "Sin cobro puntual"
      : "Incluida en la actividad"
  }

  if (item.precio && Number(item.precio) > 0) {
    return `Cobro previsto: ARS ${item.precio}`
  }

  return "Requiere pago"
}

function descripcionMedioPago(item: AgendaItem) {
  if (!item.requierePago) {
    return null
  }

  if (item.medioPago === "transferencia") {
    return item.comprobanteNombreArchivo
      ? `Transferencia cargada: ${item.comprobanteNombreArchivo}`
      : "Transferencia pendiente de comprobante"
  }

  if (item.medioPago === "mercado_pago") {
    return item.montoMercadoPago
      ? `Mercado Pago previsto: ARS ${item.montoMercadoPago}`
      : "Pago con Mercado Pago"
  }

  if (item.montoTransferencia) {
    return `Base de cobro: ARS ${item.montoTransferencia}`
  }

  return "Sin medio de pago definido todavía"
}

function renderDocumentosNotas(item: AgendaItem) {
  if (!item.meetLink) {
    return null
  }

  const documentos = item.notasDocumentos || []

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.72)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Antes del Meet
      </p>

      {documentos.length > 0 ? (
        <>
          <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
            Toma de notas
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {documentos.map((documento) => (
              <a
                key={`${item.id}-${documento.url}`}
                href={documento.url}
                target="_blank"
                rel="noreferrer"
                className="workspace-button-secondary !px-3 !py-1.5 text-xs"
              >
                {documento.titulo}
              </a>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-1 text-sm text-[var(--muted)]">
          No hay documentos de notas cargados para este participante o encuentro.
        </p>
      )}
    </div>
  )
}

function colorPagoAdmin(estado?: string | null) {
  switch (estado) {
    case "pagado":
      return "bg-[rgba(52,125,89,0.1)] text-[rgb(52,125,89)] border-[rgba(52,125,89,0.18)]"
    case "gracia":
      return "bg-[rgba(44,103,117,0.1)] text-[var(--brand)] border-[rgba(44,103,117,0.18)]"
    case "pendiente":
      return "bg-[rgba(203,138,36,0.12)] text-[var(--accent-strong)] border-[rgba(203,138,36,0.24)]"
    case "rechazado":
    case "sin_pago":
    case "sin_honorario":
    case "sin_inscripcion":
      return "bg-[rgba(156,69,59,0.12)] text-[rgb(156,69,59)] border-[rgba(156,69,59,0.2)]"
    case "por_sesion":
      return "bg-[rgba(125,92,62,0.12)] text-[rgb(125,92,62)] border-[rgba(125,92,62,0.2)]"
    case "mensual_grupal":
      return "bg-[rgba(93,78,55,0.12)] text-[rgb(93,78,55)] border-[rgba(93,78,55,0.2)]"
    default:
      return "bg-[rgba(93,78,55,0.12)] text-[rgb(93,78,55)] border-[rgba(93,78,55,0.2)]"
  }
}

function etiquetaPagoAdmin(estado?: string | null) {
  switch (estado) {
    case "pagado":
      return "Pago al día"
    case "gracia":
      return "En gracia"
    case "pendiente":
      return "Pago pendiente"
    case "rechazado":
      return "Pago rechazado"
    case "sin_pago":
      return "Sin pago"
    case "sin_honorario":
      return "Falta honorario"
    case "sin_inscripcion":
      return "Sin inscripción"
    case "por_sesion":
      return "Cobro por sesión"
    case "mensual_grupal":
      return "Mensual grupal"
    default:
      return "Estado de pago"
  }
}

export default function AdminAgendaCalendar({
  items,
  eliminandoId,
  onEliminar,
  onRefresh,
}: Props) {
  const hoyIso = useMemo(() => formatearFechaIso(new Date()), [])
  const primeraFechaConItems = items[0]?.fecha || hoyIso
  const fechaInicial = parseFechaLocal(primeraFechaConItems)

  const [mesActual, setMesActual] = useState(
    new Date(fechaInicial.getFullYear(), fechaInicial.getMonth(), 1)
  )
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(
    items.some((item) => item.fecha === hoyIso) ? hoyIso : primeraFechaConItems
  )
  const [actividadFiltro, setActividadFiltro] = useState<ActividadFiltro>("todas")
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos")
  const [resolviendoReservaId, setResolviendoReservaId] = useState<number | null>(null)
  const [mensajeAccion, setMensajeAccion] = useState("")

  const itemsFiltrados = useMemo(() => {
    return items.filter((item) => {
      const coincideActividad =
        actividadFiltro === "todas" || item.actividadSlug === actividadFiltro
      const coincideEstado =
        estadoFiltro === "todos" || item.estado === estadoFiltro

      return coincideActividad && coincideEstado
    })
  }, [actividadFiltro, estadoFiltro, items])

  const itemsPorFecha = useMemo(() => {
    const mapa = new Map<string, AgendaItem[]>()

    for (const item of itemsFiltrados) {
      if (!mapa.has(item.fecha)) {
        mapa.set(item.fecha, [])
      }

      mapa.get(item.fecha)?.push(item)
    }

    for (const [fecha, lista] of mapa.entries()) {
      mapa.set(
        fecha,
        [...lista].sort((a, b) => `${a.hora}-${a.titulo}`.localeCompare(`${b.hora}-${b.titulo}`))
      )
    }

    return mapa
  }, [itemsFiltrados])

  const fechaSeleccionadaActiva = useMemo(() => {
    if (!fechaSeleccionada) {
      return itemsFiltrados[0]?.fecha || items[0]?.fecha || hoyIso
    }

    const [anio, mes] = fechaSeleccionada.split("-").map(Number)
    const mismoMes =
      anio === mesActual.getFullYear() && mes === mesActual.getMonth() + 1

    if (mismoMes) {
      return fechaSeleccionada
    }

    const primeraFechaDelMes = itemsFiltrados.find((item) => {
      const fecha = parseFechaLocal(item.fecha)
      return (
        fecha.getFullYear() === mesActual.getFullYear() &&
        fecha.getMonth() === mesActual.getMonth()
      )
    })

    if (primeraFechaDelMes) {
      return primeraFechaDelMes.fecha
    }

    return formatearFechaIso(new Date(mesActual))
  }, [fechaSeleccionada, hoyIso, items, itemsFiltrados, mesActual])

  const diasGrilla = useMemo(() => {
    const inicio = obtenerInicioGrilla(mesActual)

    return Array.from({ length: 42 }).map((_, indice) => {
      const fecha = sumarDias(inicio, indice)
      const fechaIso = formatearFechaIso(fecha)
      const itemsDelDia = itemsPorFecha.get(fechaIso) || []
      const mismoMes = fecha.getMonth() === mesActual.getMonth()

      return {
        fecha,
        fechaIso,
        items: itemsDelDia,
        mismoMes,
      }
    })
  }, [itemsPorFecha, mesActual])

  const itemsFechaSeleccionada = itemsPorFecha.get(fechaSeleccionadaActiva) || []

  const resumenMes = useMemo(() => {
    const contador = {
      casatalentos: 0,
      "conectando-sentidos": 0,
      mentorias: 0,
      terapia: 0,
      membresia: 0,
    }

    for (const item of itemsFiltrados) {
      const fecha = parseFechaLocal(item.fecha)
      if (
        fecha.getFullYear() === mesActual.getFullYear() &&
        fecha.getMonth() === mesActual.getMonth()
      ) {
      contador[item.actividadSlug] += 1
      }
    }

    return contador
  }, [itemsFiltrados, mesActual])

  const resumenEstadosMes = useMemo(() => {
    const contador = {
      disponible: 0,
      pendiente_pago: 0,
      confirmada: 0,
      realizada: 0,
      bloqueado: 0,
    }

    for (const item of itemsFiltrados) {
      const fecha = parseFechaLocal(item.fecha)
      if (
        fecha.getFullYear() === mesActual.getFullYear() &&
        fecha.getMonth() === mesActual.getMonth()
      ) {
        contador[item.estado] += 1
      }
    }

    return contador
  }, [itemsFiltrados, mesActual])

  const resumenActividadesCards = [
    {
      key: "casatalentos",
      titulo: "CasaTalentos",
      descripcion: "Reuniones y coworking del mes",
      valor: resumenMes.casatalentos,
      className:
        "border-[rgba(203,138,36,0.24)] bg-[rgba(203,138,36,0.1)]",
    },
    {
      key: "conectando-sentidos",
      titulo: "Conectando Sentidos",
      descripcion: "Encuentros grupales programados",
      valor: resumenMes["conectando-sentidos"],
      className:
        "border-[rgba(44,103,117,0.24)] bg-[rgba(44,103,117,0.1)]",
    },
    {
      key: "mentorias",
      titulo: "Mentorías",
      descripcion: "Reuniones individuales del mes",
      valor: resumenMes.mentorias,
      className: "border-[rgba(93,78,55,0.2)] bg-[rgba(93,78,55,0.08)]",
    },
    {
      key: "terapia",
      titulo: "Terapia",
      descripcion: "Sesiones terapéuticas agendadas",
      valor: resumenMes.terapia,
      className: "border-[rgba(125,92,62,0.2)] bg-[rgba(125,92,62,0.08)]",
    },
    {
      key: "membresia",
      titulo: "Cumpleaños",
      descripcion: "Recordatorios desde perfiles",
      valor: resumenMes.membresia,
      className:
        "border-[rgba(47,109,115,0.2)] bg-[rgba(47,109,115,0.08)]",
    },
  ]

  const resumenEstadosCards = [
    {
      key: "disponible",
      titulo: "Disponibles",
      descripcion: "Horarios abiertos para usar",
      valor: resumenEstadosMes.disponible,
      className: "border-[rgba(52,125,89,0.18)] bg-[rgba(52,125,89,0.08)]",
    },
    {
      key: "pendiente_pago",
      titulo: "Pendientes de pago",
      descripcion: "Esperando pago o revisión",
      valor: resumenEstadosMes.pendiente_pago,
      className:
        "border-[rgba(203,138,36,0.24)] bg-[rgba(203,138,36,0.1)]",
    },
    {
      key: "confirmada",
      titulo: "Confirmadas",
      descripcion: "Encuentros ya habilitados",
      valor: resumenEstadosMes.confirmada,
      className:
        "border-[rgba(44,103,117,0.24)] bg-[rgba(44,103,117,0.1)]",
    },
    {
      key: "realizada",
      titulo: "Realizadas",
      descripcion: "Encuentros ya ocurridos",
      valor: resumenEstadosMes.realizada,
      className: "border-[rgba(93,78,55,0.2)] bg-[rgba(93,78,55,0.08)]",
    },
    {
      key: "bloqueado",
      titulo: "Bloqueadas",
      descripcion: "Franja sin ingreso habilitado",
      valor: resumenEstadosMes.bloqueado,
      className: "border-[rgba(156,69,59,0.2)] bg-[rgba(156,69,59,0.08)]",
    },
  ]

  const moverMes = (direccion: -1 | 1) => {
    setMesActual(
      new Date(mesActual.getFullYear(), mesActual.getMonth() + direccion, 1)
    )
  }

  const irAHoy = () => {
    const hoy = new Date()
    setMesActual(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
    setFechaSeleccionada(hoyIso)
  }

  const resolverReservaTerapia = async (
    reservaId: number,
    accion: "aprobar" | "rechazar"
  ) => {
    try {
      setResolviendoReservaId(reservaId)
      setMensajeAccion("")

      const res = await fetch("/api/terapia/admin/resolver-pago-reserva", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reservaId,
          accion,
        }),
      })

      const data = (await res.json()) as { error?: string; advertencia?: string | null }

      if (!res.ok) {
        setMensajeAccion(data.error || "No se pudo resolver la reserva.")
        return
      }

      const mensajeExito =
        accion === "aprobar"
          ? "Reserva de Terapia aprobada correctamente."
          : "Reserva de Terapia rechazada y horario reabierto."

      setMensajeAccion(
        data.advertencia ? `${mensajeExito} ${data.advertencia}` : mensajeExito
      )

      if (onRefresh) {
        await onRefresh()
      }
    } catch {
      setMensajeAccion("Error resolviendo la reserva desde la agenda.")
    } finally {
      setResolviendoReservaId(null)
    }
  }

  return (
    <section className="space-y-5">
      <div className="workspace-panel-soft space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="workspace-eyebrow">Calendario general</p>
            <h2 className="workspace-title-sm">Agenda mensual de la escuela</h2>
            <p className="workspace-inline-note">
              Zona horaria Argentina. Desde acá podés leer toda la programación
              del mes y abrir el detalle del día que quieras revisar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => moverMes(-1)}
              className="rounded-full border border-[var(--line)] bg-[rgba(255,250,242,0.84)] px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-[var(--line-strong)] hover:bg-white sm:px-4"
            >
              Mes anterior
            </button>
            <div className="rounded-full border border-[rgba(44,103,117,0.16)] bg-[rgba(255,255,255,0.72)] px-3 py-2 text-sm font-semibold capitalize tracking-[-0.01em] text-gray-900 sm:px-4">
              {formatearMes(mesActual)}
            </div>
            <button
              type="button"
              onClick={() => moverMes(1)}
              className="rounded-full border border-[var(--line)] bg-[rgba(255,250,242,0.84)] px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-[var(--line-strong)] hover:bg-white sm:px-4"
            >
              Mes siguiente
            </button>
            <button
              type="button"
              onClick={irAHoy}
              className="rounded-full border border-[rgba(44,103,117,0.18)] bg-[rgba(44,103,117,0.08)] px-3 py-2 text-sm font-medium text-[var(--brand)] transition hover:bg-[rgba(44,103,117,0.12)] sm:px-4"
            >
              Hoy
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="workspace-eyebrow">Actividades del mes</p>
            <p className="workspace-inline-note">
              Cantidad de encuentros programados por cada actividad en este mes.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {resumenActividadesCards.map((card) => (
              <div
                key={card.key}
                className={`rounded-[1.3rem] border p-4 ${card.className}`}
              >
                <p className="text-sm font-semibold text-gray-900">
                  {card.titulo}
                </p>
                <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
                  {card.descripcion}
                </p>
                <p className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-gray-900">
                  {card.valor}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="workspace-eyebrow">Estado del mes</p>
              <p className="workspace-inline-note">
                Cómo se distribuyen los encuentros según su estado actual.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {resumenEstadosCards.map((card) => (
                <div
                  key={card.key}
                  className={`rounded-[1.1rem] border p-3 ${card.className}`}
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {card.titulo}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    {card.descripcion}
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-gray-900">
                    {card.valor}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid content-start gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">
                Filtrar por actividad
              </span>
              <select
                className="workspace-field"
                value={actividadFiltro}
                onChange={(e) => setActividadFiltro(e.target.value as ActividadFiltro)}
              >
                <option value="todas">Todas las actividades</option>
                <option value="casatalentos">CasaTalentos</option>
                <option value="conectando-sentidos">Conectando Sentidos</option>
                <option value="mentorias">Mentorías</option>
                <option value="terapia">Terapia</option>
                <option value="membresia">Cumpleaños</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">
                Filtrar por estado
              </span>
              <select
                className="workspace-field"
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)}
              >
                <option value="todos">Todos los estados</option>
                <option value="disponible">Disponibles</option>
                <option value="pendiente_pago">Pendientes de pago</option>
                <option value="confirmada">Confirmadas</option>
                <option value="realizada">Realizadas</option>
                <option value="bloqueado">Bloqueadas</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {mensajeAccion && (
        <div className="workspace-panel-soft text-sm">{mensajeAccion}</div>
      )}

      <div className="workspace-panel overflow-hidden">
        <p className="mb-3 text-xs text-[var(--muted)] sm:hidden">
          Deslizá hacia los costados para ver la semana completa.
        </p>
        <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
          <div className="min-w-[560px] sm:min-w-[760px]">
            <div className="grid grid-cols-7 gap-1.5 border-b border-[var(--line)] pb-2 sm:gap-2 sm:pb-3">
              {DIAS_SEMANA.map((dia) => (
                <div
                  key={dia}
                  className="px-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)] sm:px-2 sm:text-xs sm:tracking-[0.2em]"
                >
                  {dia}
                </div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1.5 sm:mt-3 sm:gap-2">
              {diasGrilla.map((dia) => {
                const seleccionado = dia.fechaIso === fechaSeleccionadaActiva
                const esHoy = dia.fechaIso === hoyIso

                return (
                  <button
                    key={dia.fechaIso}
                    type="button"
                    onClick={() => setFechaSeleccionada(dia.fechaIso)}
                    className={`min-h-[104px] rounded-[1rem] border p-2 text-left transition sm:min-h-[148px] sm:rounded-[1.2rem] sm:p-3 ${
                      seleccionado
                          ? "border-[var(--accent)] bg-[rgba(203,138,36,0.14)] shadow-[0_10px_28px_rgba(203,138,36,0.1)] sm:shadow-[0_16px_40px_rgba(203,138,36,0.12)]"
                        : dia.mismoMes
                          ? "border-[var(--line)] bg-[rgba(255,251,244,0.82)] hover:bg-[rgba(255,247,235,0.96)]"
                          : "border-[rgba(228,216,197,0.7)] bg-[rgba(248,242,231,0.55)] text-[rgba(94,82,71,0.55)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold sm:h-8 sm:w-8 sm:text-sm ${
                          esHoy
                            ? "bg-[var(--brand)] text-white"
                            : "bg-white/70 text-gray-900"
                        }`}
                      >
                        {dia.fecha.getDate()}
                      </span>
                      {dia.items.length > 0 && (
                        <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)] sm:px-2 sm:text-[11px]">
                          {dia.items.length}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 space-y-1 sm:mt-3 sm:space-y-1.5">
                      {dia.items.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          className={`rounded-[0.8rem] border px-2 py-1.5 text-[10px] font-medium sm:rounded-[0.95rem] sm:px-2.5 sm:py-2 sm:text-[11px] ${colorActividad(
                            item.actividadSlug
                          )}`}
                        >
                          <span className="flex items-start gap-1.5">
                            <span
                              className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2 ${item.estado === "confirmada"
                                ? "bg-[var(--brand)]"
                                : item.estado === "pendiente_pago"
                                  ? "bg-[var(--accent-strong)]"
                                  : item.estado === "realizada"
                                    ? "bg-[rgb(93,78,55)]"
                                    : item.estado === "bloqueado"
                                      ? "bg-[rgb(156,69,59)]"
                                      : "bg-[rgb(52,125,89)]"
                              }`}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[9px] font-semibold uppercase tracking-[0.12em] opacity-75 sm:text-[10px] sm:tracking-[0.14em]">
                                {item.hora}
                              </span>
                              <span className="mt-0.5 block line-clamp-1 text-[10px] leading-3 normal-case tracking-normal sm:line-clamp-2 sm:text-[11px] sm:leading-4">
                                {item.titulo}
                              </span>
                            </span>
                          </span>
                        </div>
                      ))}

                      {dia.items.length > 2 && (
                        <p className="px-1 text-[10px] font-medium text-[var(--muted)] sm:text-[11px]">
                          +{dia.items.length - 2} más
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <section className="workspace-panel space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="workspace-eyebrow">Detalle del día</p>
            <h3 className="text-xl font-semibold capitalize text-gray-900">
              {formatearFechaLarga(fechaSeleccionadaActiva)}
            </h3>
          </div>

          <span className="workspace-chip">
            {itemsFechaSeleccionada.length} encuentro
            {itemsFechaSeleccionada.length === 1 ? "" : "s"}
          </span>
        </div>

        {itemsFechaSeleccionada.length === 0 && (
          <p className="workspace-inline-note">
            No hay encuentros programados para esta fecha.
          </p>
        )}

        <div className="grid gap-4">
          {itemsFechaSeleccionada.map((item) => (
            <article
              key={item.id}
              className="workspace-card-link !rounded-[1.45rem] !p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="workspace-chip">{item.actividadNombre}</span>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${colorEstado(item.estado)}`}>
                  {etiquetaEstado(item.estado)}
                </span>
                <span className="workspace-chip">
                  {item.origen === "reserva" ? "Reserva" : "Programación"}
                </span>
                {item.estadoPagoAdmin && (
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${colorPagoAdmin(
                      item.estadoPagoAdmin
                    )}`}
                  >
                    {etiquetaPagoAdmin(item.estadoPagoAdmin)}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-lg font-semibold tracking-[-0.03em]">
                  {item.titulo}
                </h4>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.72)] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Hora
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {item.hora}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.72)] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Duración
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {item.duracion} min
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.72)] p-3 sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Participante
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {item.participanteNombre || "Sin participante asignado"}
                    </p>
                    {item.participanteEmail && (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {item.participanteEmail}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.72)] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Cobro
                    </p>
                    <p className="mt-1 text-sm text-gray-900">
                      {descripcionCobro(item)}
                    </p>
                    {descripcionMedioPago(item) && (
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {descripcionMedioPago(item)}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.72)] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Estado administrativo
                    </p>
                    <p className="mt-1 text-sm text-gray-900">
                      {item.detallePagoAdmin || item.motivoBloqueo || "Sin observaciones"}
                    </p>
                  </div>
                </div>

                {renderDocumentosNotas(item)}
              </div>

              <div className="flex flex-wrap gap-3">
                {item.requierePago && item.participanteEmail && (
                  <Link
                    href={`/admin/pagos?actividad=${encodeURIComponent(
                      item.actividadSlug
                    )}&participante=${encodeURIComponent(item.participanteEmail)}`}
                    className="workspace-button-secondary"
                  >
                    Ver en Admin Pagos
                  </Link>
                )}

                {item.actividadSlug === "terapia" &&
                  item.estado === "pendiente_pago" &&
                  item.reservaId && (
                    <>
                      {item.comprobanteNombreArchivo && (
                        <a
                          href={`/api/reservas/comprobante?reservaId=${item.reservaId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="workspace-button-secondary"
                        >
                          Ver comprobante
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => void resolverReservaTerapia(item.reservaId!, "aprobar")}
                        disabled={resolviendoReservaId === item.reservaId}
                        className="workspace-button-primary disabled:opacity-60"
                      >
                        {resolviendoReservaId === item.reservaId
                          ? "Resolviendo..."
                          : "Aprobar reserva"}
                      </button>

                      <button
                        type="button"
                        onClick={() => void resolverReservaTerapia(item.reservaId!, "rechazar")}
                        disabled={resolviendoReservaId === item.reservaId}
                        className="workspace-button-secondary disabled:opacity-60"
                      >
                        Rechazar reserva
                      </button>
                    </>
                  )}

                {item.meetLink && item.puedeIngresar && item.actividadSlug !== "membresia" && (
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

                {!item.motivoBloqueo && item.estado === "pendiente_pago" && (
                  <p className="workspace-inline-note text-amber-700">
                    Este encuentro todavía no quedó habilitado porque está pendiente
                    la validación del pago.
                  </p>
                )}

                {!item.motivoBloqueo && item.estado === "confirmada" && item.requierePago && (
                  <p className="workspace-inline-note text-[var(--brand)]">
                    Pago validado. Encuentro listo para ingreso.
                  </p>
                )}

                {item.eliminablePorAdmin && item.disponibilidadId && (
                  <button
                    type="button"
                    onClick={() => onEliminar(item.disponibilidadId!)}
                    disabled={eliminandoId === item.disponibilidadId}
                    className="workspace-button-secondary disabled:opacity-60"
                  >
                    {eliminandoId === item.disponibilidadId
                      ? "Eliminando..."
                      : "Eliminar"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
