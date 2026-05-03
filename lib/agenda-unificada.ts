import type { Actor, ActivitySlug } from "@/lib/authz"
import { resolveActivityAccess } from "@/lib/authz"
import { getActivityRule } from "@/lib/activity-rules"
import {
  normalizarDocumentosNotas,
  type DocumentoNota,
} from "@/lib/documentos-notas"
import {
  obtenerEstadoPagoActividadActual,
  type EstadoPagoEspacio,
} from "@/lib/espacios"
import { obtenerFechaISOArgentina } from "@/lib/fechas"
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
  requiere_pago?: boolean | null
  precio?: string | null
  estado: "disponible" | "pendiente_pago" | "confirmada"
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

function describirEstadoPagoAdmin(
  actividadSlug: ActivitySlug,
  estadoPago: EstadoPagoEspacio
) {
  switch (estadoPago.motivo) {
    case "pagado":
      return {
        estado: "pagado",
        detalle:
          actividadSlug === "mentorias"
            ? "Pago mensual al día."
            : "Pago habilitado para este proceso.",
      }
    case "gracia":
      return {
        estado: "gracia",
        detalle: "Acceso dentro del período de gracia.",
      }
    case "sin_pago":
      return {
        estado: "sin_pago",
        detalle: "Todavía no existe un pago cargado para el período actual.",
      }
    case "pendiente":
      return {
        estado: "pendiente",
        detalle: "Hay un pago cargado, pero todavía sigue pendiente de revisión.",
      }
    case "rechazado":
      return {
        estado: "rechazado",
        detalle: "El pago fue rechazado y necesita regularización.",
      }
    case "sin_actividad":
      return {
        estado: "sin_honorario",
        detalle:
          "Falta configurar el encuadre económico de esta actividad para este participante.",
      }
    case "sin_inscripcion":
      return {
        estado: "sin_inscripcion",
        detalle: "La persona todavía no tiene una inscripción activa en esta actividad.",
      }
    case "sesion":
      return {
        estado: "por_sesion",
        detalle: "Este caso se resuelve encuentro por encuentro, no por un pago mensual.",
      }
  }
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

  const items: AgendaUnificadaItem[] = []

  for (const item of ((disponibilidades as DisponibilidadRow[] | null) || [])) {
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

    let estadoPagoAdmin: string | null = null
    let detallePagoAdmin: string | null = null

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

      const descripcion = describirEstadoPagoAdmin(slug, estadoPago)
      estadoPagoAdmin = descripcion.estado
      detallePagoAdmin = descripcion.detalle
    } else if (esAdmin && regla.agendaStrategy === "grupo_fijo") {
      estadoPagoAdmin = "mensual_grupal"
      detallePagoAdmin =
        "Actividad grupal con cobro mensual por participante. El seguimiento puntual se resuelve desde Admin Pagos."
    }

    let visibleParaParticipante = true
    let puedeIngresar = true
    let motivoBloqueo: string | null = null
    let estado: AgendaUnificadaItem["estado"] = item.estado

    if (reserva?.realizada_at) {
      estado = "realizada"
    } else if (reserva?.estado === "pendiente_pago") {
      estado = "pendiente_pago"
    } else if (reserva?.estado === "confirmada" || item.estado === "confirmada") {
      estado = "confirmada"
    } else {
      estado = item.estado
    }

    if (!esAdmin) {
      if (regla.agendaStrategy === "grupo_fijo") {
        visibleParaParticipante =
          accessGeneral?.motivo !== "sin_inscripcion" &&
          accessGeneral?.motivo !== "sin_email"
        puedeIngresar = Boolean(accessGeneral?.acceso && item.meet_link)
        motivoBloqueo = accessGeneral?.acceso
          ? !item.meet_link
            ? "Falta link de videollamada."
            : null
          : accessGeneral?.motivo === "sin_pago" ||
              accessGeneral?.motivo === "pendiente" ||
              accessGeneral?.motivo === "rechazado"
            ? "El acceso a este encuentro se habilita cuando el pago del período esté aprobado."
            : "Tu acceso a esta actividad no está habilitado en este momento."
      }

      if (slug === "mentorias") {
        visibleParaParticipante =
          String(item.participante_email || "").trim().toLowerCase() === actor.email
        puedeIngresar = Boolean(
          visibleParaParticipante &&
            item.meet_link &&
            (pagoEspacio?.habilitado || false)
        )

        if (visibleParaParticipante && !puedeIngresar) {
          motivoBloqueo = !item.meet_link
            ? "Falta link de videollamada."
            : "El acceso a la reunión se habilita cuando el pago mensual está al día."
        }
      }

      if (slug === "terapia") {
        if (item.modo === "disponibilidad") {
          visibleParaParticipante = false
        } else {
          visibleParaParticipante =
            String(item.participante_email || "").trim().toLowerCase() === actor.email
          puedeIngresar = Boolean(
            visibleParaParticipante &&
              item.meet_link &&
              (pagoEspacio?.habilitado || false)
          )
          motivoBloqueo = visibleParaParticipante && !puedeIngresar
            ? "El acceso a la sesión se habilita cuando el pago está aprobado."
            : null
        }
      }

      if (reserva) {
        if (slug === "terapia") {
          visibleParaParticipante =
            String(reserva.participante_email || "").trim().toLowerCase() === actor.email

          puedeIngresar = Boolean(
            visibleParaParticipante &&
              item.meet_link &&
              (estado === "confirmada" || estado === "realizada")
          )

          motivoBloqueo =
            visibleParaParticipante && !puedeIngresar
              ? estado === "pendiente_pago"
                ? "La sesión queda habilitada cuando se confirma el pago."
                : !item.meet_link
                  ? "Falta link de videollamada."
                  : "Esta sesión todavía no está habilitada."
              : null
        } else {
          visibleParaParticipante =
            regla.agendaStrategy === "grupo_fijo" ||
            String(reserva.participante_email || "").trim().toLowerCase() === actor.email
        }
      }
    }

    if (esAdmin) {
      if (!item.meet_link) {
        motivoBloqueo = "Falta link de videollamada."
      } else if (estado === "pendiente_pago") {
        if (reserva?.medio_pago === "transferencia") {
          motivoBloqueo = reserva.comprobante_nombre_archivo
            ? "Pendiente de revisar comprobante de transferencia."
            : "Pendiente de que la persona suba el comprobante de transferencia."
        } else if (reserva?.medio_pago === "mercado_pago") {
          motivoBloqueo = "Pendiente de acreditación o confirmación de Mercado Pago."
        } else {
          motivoBloqueo = "Pendiente de pago o validación administrativa."
        }
      } else if (estado === "confirmada" && item.requiere_pago) {
        motivoBloqueo = "Pago validado. Encuentro habilitado."
      } else if (estado === "realizada") {
        motivoBloqueo = "Encuentro realizado."
      }
    }

    if (!esAdmin && !visibleParaParticipante) {
      continue
    }

    const requierePago =
      item.requiere_pago === true ||
      (slug === "mentorias" && Boolean(participanteEmailNormalizado)) ||
      (slug === "terapia" && Boolean(reserva))
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
      estado,
      meetLink: item.meet_link || null,
      participanteEmail,
      participanteNombre,
      requierePago,
      precio: item.precio || null,
      medioPago: reserva?.medio_pago || null,
      montoTransferencia: reserva?.monto_transferencia || reserva?.monto || null,
      montoMercadoPago: reserva?.monto_mercado_pago || null,
      comprobanteNombreArchivo: reserva?.comprobante_nombre_archivo || null,
      estadoPagoAdmin,
      detallePagoAdmin,
      puedeIngresar,
      motivoBloqueo,
      notasDocumentos,
      visibleParaParticipante,
      eliminablePorAdmin: !reserva && item.estado === "disponible",
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
