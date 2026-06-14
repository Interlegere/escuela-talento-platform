import type { Actor, ActivitySlug } from "@/lib/authz"
import { resolveActivityAccess } from "@/lib/authz"
import { getActivityRule } from "@/lib/activity-rules"
import { esEstadoDisponibilidadActivo } from "@/lib/disponibilidades"
import {
  normalizarDocumentosNotas,
  type DocumentoNota,
} from "@/lib/documentos-notas"
import {
  resolverEstadoEncuentro,
  type EncounterPaymentContext,
} from "@/lib/encounter-engine"
import {
  obtenerEstadoPagoActividadActual,
} from "@/lib/espacios"
import { obtenerFechaISOArgentina } from "@/lib/fechas"
import { normalizarMeetLink } from "@/lib/meet-links"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type DisponibilidadRow = {
  id: number
  titulo: string
  tipo: string
  actividad_slug?: ActivitySlug | null
  modo: "disponibilidad" | "actividad_fija" | "bloqueo"
  fecha: string
  hora: string
  duracion: string
  meet_link?: string | null
  google_event_id?: string | null
  sync_status?: string | null
  last_synced_at?: string | null
  serie_id?: string | null
  requiere_pago?: boolean | null
  precio?: string | null
  estado: string
  reservado_por?: string | null
  participante_email?: string | null
  participante_nombre?: string | null
  notas_documentos?: unknown
}

type ReservaRow = {
  id: number
  disponibilidad_id: number
  estado: "pendiente_pago" | "confirmada" | "cancelada" | string
  participante_nombre?: string | null
  participante_email?: string | null
  monto?: string | null
  monto_transferencia?: string | null
  monto_mercado_pago?: string | null
  moneda?: string | null
  medio_pago?: string | null
  comprobante_nombre_archivo?: string | null
  created_at?: string | null
  realizada_at?: string | null
  realizada_por_email?: string | null
  disponibilidades?: DisponibilidadRow | null
}

type ActividadRow = {
  slug: ActivitySlug
  nombre?: string | null
}

type UsuarioCumpleanosRow = {
  id: string
  nombre: string
  apellido?: string | null
  email: string
  fecha_cumpleanos: string
}

type UsuarioNotasRow = {
  email: string
  notas_documentos?: unknown
}

export type AgendaUnificadaItem = {
  id: string
  disponibilidadId?: number | null
  reservaId?: number | null
  actividadSlug: ActivitySlug
  actividadNombre: string
  titulo: string
  fecha: string
  hora: string
  duracion: string
  estrategia: "grupo_fijo" | "individual_fijo" | "reserva_individual"
  origen: "disponibilidad" | "reserva"
  estado:
    | "disponible"
    | "pendiente_pago"
    | "confirmada"
    | "realizada"
    | "bloqueado"
    | "cancelada"
  meetLink?: string | null
  syncStatus?: string | null
  lastSyncedAt?: string | null
  serieId?: string | null
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

function meetLinkReal(meetLink?: string | null) {
  return normalizarMeetLink(meetLink)
}

function claveCanonicaConectando(item: DisponibilidadRow) {
  if (
    item.actividad_slug !== "conectando-sentidos" ||
    item.modo !== "actividad_fija"
  ) {
    return null
  }

  return [
    item.actividad_slug,
    item.modo,
    item.fecha,
    item.hora,
  ].join("|")
}

function compararDisponibilidadCanonica(
  actual: DisponibilidadRow,
  candidata: DisponibilidadRow
) {
  const actualTieneMeetReal = Boolean(meetLinkReal(actual.meet_link))
  const candidataTieneMeetReal = Boolean(meetLinkReal(candidata.meet_link))
  const actualTieneEventoYMeet = Boolean(actual.google_event_id && actualTieneMeetReal)
  const candidataTieneEventoYMeet = Boolean(candidata.google_event_id && candidataTieneMeetReal)
  const actualSincronizada = actual.sync_status === "sincronizado"
  const candidataSincronizada = candidata.sync_status === "sincronizado"

  if (actualTieneEventoYMeet !== candidataTieneEventoYMeet) {
    return candidataTieneEventoYMeet ? candidata : actual
  }

  if (actualTieneMeetReal !== candidataTieneMeetReal) {
    return candidataTieneMeetReal ? candidata : actual
  }

  if (actualSincronizada !== candidataSincronizada) {
    return candidataSincronizada ? candidata : actual
  }

  return candidata.id < actual.id ? candidata : actual
}

function consolidarConectandoCanonico(disponibilidades: DisponibilidadRow[]) {
  const canonicas = new Map<string, DisponibilidadRow>()
  const sinClave: DisponibilidadRow[] = []

  for (const item of disponibilidades) {
    const clave = claveCanonicaConectando(item)

    if (!clave) {
      sinClave.push(item)
      continue
    }

    const actual = canonicas.get(clave)
    canonicas.set(
      clave,
      actual ? compararDisponibilidadCanonica(actual, item) : item
    )
  }

  return [...sinClave, ...canonicas.values()].sort((a, b) => {
    const fecha = a.fecha.localeCompare(b.fecha)
    if (fecha !== 0) return fecha

    const hora = a.hora.localeCompare(b.hora)
    if (hora !== 0) return hora

    return a.id - b.id
  })
}

export async function listarAgendaUnificada(params: {
  actor: Actor
  actividadSlug?: ActivitySlug | null
}) {
  const { actor, actividadSlug } = params
  const supabase = createAdminSupabaseClient()
  const esAdmin = actor.role === "admin"
  const hoy = obtenerFechaISOArgentina()

  const [{ data: actividades }, { data: disponibilidades }, { data: reservas }] =
    await Promise.all([
      supabase
        .from("actividades")
        .select("slug, nombre")
        .in("slug", ["casatalentos", "conectando-sentidos", "mentorias", "terapia"]),
      supabase
        .from("disponibilidades")
        .select("*")
        .gte("fecha", hoy)
        .order("fecha", { ascending: true })
        .order("hora", { ascending: true }),
      supabase
        .from("reservas")
        .select("*, disponibilidades(*)")
        .order("created_at", { ascending: false }),
    ])

  const actividadesMap = new Map<string, string>(
    (((actividades as ActividadRow[] | null) || [])).map((item) => [
      item.slug,
      item.nombre || item.slug,
    ])
  )

  const accessByActivity = new Map<ActivitySlug, Awaited<ReturnType<typeof resolveActivityAccess>>>()
  const pagoEspaciosByActivity = new Map<"mentorias" | "terapia", Awaited<ReturnType<typeof obtenerEstadoPagoActividadActual>>>()
  const adminPagoByActividadYEmail = new Map<
    string,
    Awaited<ReturnType<typeof obtenerEstadoPagoActividadActual>>
  >()
  const notasPorEmail = new Map<string, DocumentoNota[]>()

  if (!esAdmin) {
    for (const slug of [
      "casatalentos",
      "conectando-sentidos",
      "mentorias",
      "terapia",
    ] as const) {
      accessByActivity.set(slug, await resolveActivityAccess(slug, actor.email))
    }

    for (const slug of ["mentorias", "terapia"] as const) {
      pagoEspaciosByActivity.set(
        slug,
        await obtenerEstadoPagoActividadActual(slug, actor.email)
      )
    }
  }

  if (esAdmin) {
    const { data: usuariosNotas } = await supabase
      .from("usuarios_plataforma")
      .select("email, notas_documentos")

    for (const usuario of ((usuariosNotas as UsuarioNotasRow[] | null) || [])) {
      const email = String(usuario.email || "").trim().toLowerCase()

      if (!email) {
        continue
      }

      notasPorEmail.set(
        email,
        normalizarDocumentosNotas(usuario.notas_documentos)
      )
    }
  }

  const reservaPorDisponibilidad = new Map<number, ReservaRow>()

  for (const item of ((reservas as ReservaRow[] | null) || [])) {
    if (!item.disponibilidad_id || reservaPorDisponibilidad.has(item.disponibilidad_id)) {
      continue
    }

    reservaPorDisponibilidad.set(item.disponibilidad_id, item)
  }

  const disponibilidadesActivas = (
    (disponibilidades as DisponibilidadRow[] | null) || []
  ).filter((item) => esEstadoDisponibilidadActivo(item.estado))

  const disponibilidadesCanonicas = consolidarConectandoCanonico(
    disponibilidadesActivas
  )

  const items: AgendaUnificadaItem[] = []

  for (const item of disponibilidadesCanonicas) {
    const slug = item.actividad_slug

    if (
      slug !== "casatalentos" &&
      slug !== "conectando-sentidos" &&
      slug !== "mentorias" &&
      slug !== "terapia"
    ) {
      continue
    }

    if (actividadSlug && slug !== actividadSlug) {
      continue
    }

    const regla = getActivityRule(slug)
    const actividadNombre = actividadesMap.get(slug) || slug
    const reserva = reservaPorDisponibilidad.get(item.id)
    const meetLink = meetLinkReal(item.meet_link)
    const pagoEspacio =
      !esAdmin && (slug === "mentorias" || slug === "terapia")
        ? pagoEspaciosByActivity.get(slug)
        : null
    const accessGeneral = !esAdmin ? accessByActivity.get(slug) : null
    const participanteEmail = item.participante_email || reserva?.participante_email || null
    const participanteNombre = item.participante_nombre || reserva?.participante_nombre || null
    const participanteEmailNormalizado = String(participanteEmail || "")
      .trim()
      .toLowerCase()
    const clavePagoAdmin = `${slug}:${participanteEmailNormalizado}`

    let paymentContext: EncounterPaymentContext = {
      accesoActividad: accessGeneral
        ? {
            acceso: accessGeneral.acceso,
            motivo: accessGeneral.motivo,
          }
        : null,
      estadoPagoActividad: pagoEspacio || null,
    }

    if (
      esAdmin &&
      participanteEmailNormalizado &&
      (slug === "mentorias" || slug === "terapia")
    ) {
      let estadoPago = adminPagoByActividadYEmail.get(clavePagoAdmin)

      if (!estadoPago) {
        estadoPago = await obtenerEstadoPagoActividadActual(slug, participanteEmailNormalizado)
        adminPagoByActividadYEmail.set(clavePagoAdmin, estadoPago)
      }
      paymentContext = {
        ...paymentContext,
        estadoPagoActividad: estadoPago,
      }
    }
    const resolved = resolverEstadoEncuentro({
      source: {
        fuente: "agenda_unificada",
        actividadSlug: slug,
        estrategia: regla.agendaStrategy,
        origen: reserva ? "reserva" : "disponibilidad",
        modo: item.modo,
        disponibilidadEstado: item.estado,
        reservaEstado: reserva?.estado || null,
        reservaRealizadaAt: reserva?.realizada_at || null,
        participanteEmail: item.participante_email || null,
        participanteReservaEmail: reserva?.participante_email || null,
        meetLink,
        requierePagoConfigurado: item.requiere_pago,
        medioPago: reserva?.medio_pago || null,
        comprobanteNombreArchivo: reserva?.comprobante_nombre_archivo || null,
      },
      payment: paymentContext,
      access: {
        esAdmin,
        actorEmail: actor.email,
      },
    })

    if (!esAdmin && !resolved.visibleParaParticipante) {
      continue
    }

    const notasDocumentos = esAdmin
      ? [
          ...(participanteEmailNormalizado
            ? notasPorEmail.get(participanteEmailNormalizado) || []
            : []),
          ...normalizarDocumentosNotas(item.notas_documentos),
        ]
      : []

    items.push({
      id: reserva ? `reserva-${reserva.id}` : `disp-${item.id}`,
      disponibilidadId: item.id,
      reservaId: reserva?.id || null,
      actividadSlug: slug,
      actividadNombre,
      titulo: item.titulo,
      fecha: item.fecha,
      hora: item.hora,
      duracion: item.duracion,
      estrategia: regla.agendaStrategy,
      origen: reserva ? "reserva" : "disponibilidad",
      estado: resolved.estado,
      meetLink,
      syncStatus: item.sync_status || null,
      lastSyncedAt: "last_synced_at" in item
        ? String(item.last_synced_at || "") || null
        : null,
      serieId: "serie_id" in item ? String(item.serie_id || "") || null : null,
      participanteEmail,
      participanteNombre,
      requierePago: resolved.requierePago,
      precio: item.precio || null,
      medioPago: reserva?.medio_pago || null,
      montoTransferencia: reserva?.monto_transferencia || reserva?.monto || null,
      montoMercadoPago: reserva?.monto_mercado_pago || null,
      comprobanteNombreArchivo: reserva?.comprobante_nombre_archivo || null,
      estadoPagoAdmin: resolved.estadoPagoAdmin,
      detallePagoAdmin: resolved.detallePagoAdmin,
      puedeIngresar: resolved.puedeIngresar,
      motivoBloqueo: resolved.motivoBloqueo,
      notasDocumentos,
      visibleParaParticipante: resolved.visibleParaParticipante,
      eliminablePorAdmin: !reserva,
    })
  }

  if (esAdmin) {
    const { data: usuariosCumpleanos } = await supabase
      .from("usuarios_plataforma")
      .select("id, nombre, apellido, email, fecha_cumpleanos")
      .eq("activo", true)
      .not("fecha_cumpleanos", "is", null)

    const hoyDate = new Date(`${hoy}T00:00:00`)

    for (const usuario of ((usuariosCumpleanos as UsuarioCumpleanosRow[] | null) || [])) {
      const [, mes, dia] = usuario.fecha_cumpleanos.split("-").map(Number)

      if (!mes || !dia) {
        continue
      }

      let proximoCumpleanos = new Date(hoyDate.getFullYear(), mes - 1, dia)

      if (proximoCumpleanos < hoyDate) {
        proximoCumpleanos = new Date(hoyDate.getFullYear() + 1, mes - 1, dia)
      }

      const nombreCompleto = [usuario.nombre, usuario.apellido]
        .filter(Boolean)
        .join(" ")

      items.push({
        id: `cumple-${usuario.id}-${formatearFechaCumpleanos(proximoCumpleanos)}`,
        disponibilidadId: null,
        reservaId: null,
        actividadSlug: "membresia",
        actividadNombre: "Cumpleaños",
        titulo: `Cumpleaños de ${nombreCompleto || usuario.email}`,
        fecha: formatearFechaCumpleanos(proximoCumpleanos),
        hora: "00:00",
        duracion: "0",
        estrategia: "grupo_fijo",
        origen: "disponibilidad",
        estado: "confirmada",
        meetLink: null,
        participanteEmail: usuario.email,
        participanteNombre: nombreCompleto || usuario.email,
        requierePago: false,
        precio: null,
        medioPago: null,
        montoTransferencia: null,
        montoMercadoPago: null,
        comprobanteNombreArchivo: null,
        estadoPagoAdmin: null,
        detallePagoAdmin: "Recordatorio de cumpleaños cargado desde el perfil.",
        puedeIngresar: false,
        motivoBloqueo: null,
        notasDocumentos: [],
        visibleParaParticipante: false,
        eliminablePorAdmin: false,
      })
    }
  }

  items.sort((a, b) => {
    const claveA = `${a.fecha}T${a.hora || "00:00"}`
    const claveB = `${b.fecha}T${b.hora || "00:00"}`
    return claveA.localeCompare(claveB)
  })

  return items
}

function formatearFechaCumpleanos(fecha: Date) {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, "0")
  const dia = String(fecha.getDate()).padStart(2, "0")

  return `${anio}-${mes}-${dia}`
}
