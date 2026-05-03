import { NextResponse } from "next/server"
import {
  esErrorConfiguracionEspacios,
  esActividadEspacio,
  obtenerEstadoPagoActividadActual,
  resolverContextoEspacio,
  type EspacioAccesoExtraRow,
  type EspacioMensajeRow,
  type EspacioRecursoRow,
} from "@/lib/espacios"
import {
  normalizarDocumentosNotas,
  type DocumentoNota,
} from "@/lib/documentos-notas"
import { obtenerFechaISOArgentina } from "@/lib/fechas"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type ReservaEspacioRow = {
  id: number
  estado: string
  created_at?: string | null
  medio_pago?: string | null
  monto?: string | null
  monto_transferencia?: string | null
  monto_mercado_pago?: string | null
  porcentaje_recargo_mercado_pago?: number | null
  comprobante_nombre_archivo?: string | null
  disponibilidades?: {
    id: number
    titulo?: string | null
    actividad_slug?: string | null
    fecha?: string | null
    hora?: string | null
    duracion?: string | null
    meet_link?: string | null
    requiere_pago?: boolean | null
    estado?: string | null
    notas_documentos?: unknown
  } | null
}

type DisponibilidadFijaEspacioRow = {
  id: number
  titulo?: string | null
  actividad_slug?: string | null
  fecha?: string | null
  hora?: string | null
  duracion?: string | null
  meet_link?: string | null
  estado?: string | null
  participante_email?: string | null
  requiere_pago?: boolean | null
  notas_documentos?: unknown
}

type Body = {
  actividadSlug?: string
  participanteEmail?: string
}

function motivoPagoParaEncuentro(
  actividadSlug: string,
  motivoPago: string
) {
  if (motivoPago === "sin_actividad") {
    return actividadSlug === "mentorias"
      ? "Todavía falta asignar tu modalidad y tu pago de Mentoría para habilitar esta reunión."
      : "Todavía falta asignar el encuadre económico de esta actividad para habilitar este ingreso."
  }

  if (motivoPago === "sesion") {
    return "Este ingreso se habilita con el pago y la confirmación de cada sesión."
  }

  const nombre = actividadSlug === "terapia" ? "sesión" : "reunión"
  return `El ingreso a esta ${nombre} se habilita cuando el pago del período actual está aprobado.`
}

function inicioDeHoy() {
  return obtenerFechaISOArgentina()
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body

    if (!body.actividadSlug) {
      return NextResponse.json(
        { error: "Falta actividadSlug." },
        { status: 400 }
      )
    }

    const contexto = await resolverContextoEspacio({
      actividadSlug: body.actividadSlug,
      participanteEmail: body.participanteEmail,
    })

    if ("response" in contexto) {
      return contexto.response
    }

    const supabase = createAdminSupabaseClient()

    if (!esActividadEspacio(body.actividadSlug)) {
      return NextResponse.json(
        { error: "Actividad inválida para este espacio." },
        { status: 400 }
      )
    }

    const actividadSlug = body.actividadSlug

    const espacio = contexto.espacio

    if (!espacio) {
      return NextResponse.json(
        { error: "No se encontró el espacio configurado." },
        { status: 404 }
      )
    }

    const estadoPago =
      !contexto.esAdmin &&
      (body.actividadSlug === "terapia" || body.actividadSlug === "mentorias")
        ? await obtenerEstadoPagoActividadActual(
            body.actividadSlug,
            contexto.participanteEmail
          )
        : {
            habilitado: true,
            motivo: "pagado" as const,
            modalidad: "mensual" as const,
          }

    const estadoMensajeria = {
      habilitado: true,
      motivo: "pagado" as const,
    }
    let notasParticipante: DocumentoNota[] = []

    if (contexto.esAdmin && contexto.participanteEmail) {
      const { data: usuarioNotas } = await supabase
        .from("usuarios_plataforma")
        .select("notas_documentos")
        .eq("email", contexto.participanteEmail)
        .maybeSingle()

      notasParticipante = normalizarDocumentosNotas(
        usuarioNotas?.notas_documentos
      )
    }

    const { data: mensajes, error: mensajesError } = await supabase
      .from("espacios_mensajes")
      .select("*")
      .eq("espacio_id", espacio.id)
      .order("created_at", { ascending: true })

    if (mensajesError) {
      throw mensajesError
    }

    let recursosQuery = supabase
      .from("espacios_recursos")
      .select("*")
      .eq("espacio_id", espacio.id)
      .order("created_at", { ascending: false })

    if (!contexto.esAdmin) {
      recursosQuery = recursosQuery.eq("visible", true)
    }

    const { data: recursos, error: recursosError } = await recursosQuery

    if (recursosError) {
      throw recursosError
    }

    const { data: reservas, error: reservasError } = await supabase
      .from("reservas")
      .select(
        "id, estado, created_at, medio_pago, monto, monto_transferencia, monto_mercado_pago, porcentaje_recargo_mercado_pago, comprobante_nombre_archivo, disponibilidades(*)"
      )
      .eq("participante_email", contexto.participanteEmail)
      .order("created_at", { ascending: false })

    if (reservasError) {
      throw reservasError
    }

    const hoy = inicioDeHoy()

    const { data: disponibilidadesFijas, error: disponibilidadesFijasError } =
      await supabase
        .from("disponibilidades")
        .select("*")
        .eq("actividad_slug", actividadSlug)
        .eq("modo", "actividad_fija")
        .gte("fecha", hoy)
        .order("fecha", { ascending: true })
        .order("hora", { ascending: true })

    if (disponibilidadesFijasError) {
      throw disponibilidadesFijasError
    }

    let accesosExtra: EspacioAccesoExtraRow[] = []

    if (actividadSlug === "mentorias" || actividadSlug === "terapia") {
      const { data, error } = await supabase
        .from("espacios_accesos_extra")
        .select("*")
        .eq("espacio_id", espacio.id)
        .order("actividad_destino_slug", { ascending: true })

      if (error) {
        throw error
      }

      accesosExtra = (data || []) as EspacioAccesoExtraRow[]
    }

    const encuentrosReservados = ((reservas || []) as unknown as ReservaEspacioRow[])
      .filter(
        (item) =>
          item.disponibilidades?.actividad_slug === actividadSlug &&
          item.disponibilidades?.fecha &&
          item.disponibilidades.fecha >= hoy
      )
      .map((item) => {
        const link = item.disponibilidades?.meet_link || null
        const confirmada =
          item.estado === "confirmada" ||
          item.disponibilidades?.estado === "confirmada"
        const requierePago = item.disponibilidades?.requiere_pago !== false

        return {
          id: item.id,
          reservaId: item.id,
          disponibilidadId: item.disponibilidades?.id || null,
          titulo: item.disponibilidades?.titulo || "Encuentro",
          fecha: item.disponibilidades?.fecha || "",
          hora: item.disponibilidades?.hora || "",
          duracion: item.disponibilidades?.duracion || "",
          estado: item.estado,
          medioPago: item.medio_pago || null,
          montoTransferencia: item.monto_transferencia || item.monto || null,
          montoMercadoPago: item.monto_mercado_pago || null,
          porcentajeRecargoMercadoPago:
            item.porcentaje_recargo_mercado_pago ?? null,
          comprobanteNombreArchivo: item.comprobante_nombre_archivo || null,
          meetLink: link,
          notasDocumentos: contexto.esAdmin
            ? [
                ...notasParticipante,
                ...normalizarDocumentosNotas(
                  item.disponibilidades?.notas_documentos
                ),
              ]
            : [],
          puedeIngresar: Boolean(
            link &&
              (contexto.esAdmin ||
                (confirmada &&
                  (!requierePago ||
                    estadoPago.habilitado ||
                    (actividadSlug === "terapia" &&
                      estadoPago.modalidad === "sesion"))))
          ),
          motivoBloqueo: !link
            ? "Falta link de videollamada."
            : !contexto.esAdmin && requierePago && !estadoPago.habilitado
              ? actividadSlug === "terapia" &&
                estadoPago.modalidad === "sesion" &&
                confirmada
                ? null
                : motivoPagoParaEncuentro(actividadSlug, estadoPago.motivo)
              : !contexto.esAdmin && !confirmada
              ? "El ingreso se habilita al confirmarse la reserva/pago."
              : null,
        }
      })
      .sort((a, b) => {
        const claveA = `${a.fecha}T${a.hora || "00:00"}`
        const claveB = `${b.fecha}T${b.hora || "00:00"}`
        return claveA.localeCompare(claveB)
      })

    const encuentrosFijos = ((disponibilidadesFijas || []) as DisponibilidadFijaEspacioRow[])
      .filter((item) => {
        const participanteAsignado =
          String(item.participante_email || "").trim().toLowerCase()
        return participanteAsignado === contexto.participanteEmail
      })
      .map((item) => {
        const link = item.meet_link || null

        return {
          id: `fija-${item.id}`,
          reservaId: null,
          disponibilidadId: item.id,
          titulo: item.titulo || "Encuentro",
          fecha: item.fecha || "",
          hora: item.hora || "",
          duracion: item.duracion || "",
          estado: item.estado || "disponible",
          meetLink: link,
          notasDocumentos: contexto.esAdmin
            ? [
                ...notasParticipante,
                ...normalizarDocumentosNotas(item.notas_documentos),
              ]
            : [],
          puedeIngresar: Boolean(link && (contexto.esAdmin || estadoPago.habilitado)),
          motivoBloqueo: !link
            ? "Falta link de videollamada."
            : !contexto.esAdmin && !estadoPago.habilitado
              ? motivoPagoParaEncuentro(actividadSlug, estadoPago.motivo)
              : null,
        }
      })

    const encuentros = [...encuentrosReservados, ...encuentrosFijos].sort((a, b) => {
      const claveA = `${a.fecha}T${a.hora || "00:00"}`
      const claveB = `${b.fecha}T${b.hora || "00:00"}`
      return claveA.localeCompare(claveB)
    })

    return NextResponse.json({
      ok: true,
      configuracionPendiente: false,
      esAdmin: contexto.esAdmin,
      mensajeriaHabilitada: estadoMensajeria.habilitado,
      motivoMensajeria: estadoMensajeria.motivo,
      pagoHabilitado: estadoPago.habilitado,
      motivoPago: estadoPago.motivo,
      modalidadPago: estadoPago.modalidad,
      participanteActual: {
        email: contexto.participanteEmail,
        nombre: contexto.participanteNombre,
      },
      mensajes: (mensajes || []) as EspacioMensajeRow[],
      encuentros,
      recursos: (recursos || []) as EspacioRecursoRow[],
      accesosExtra,
    })
  } catch (error) {
    if (esErrorConfiguracionEspacios(error)) {
      return NextResponse.json({
        ok: true,
        configuracionPendiente: true,
        esAdmin: false,
        mensajeriaHabilitada: true,
        motivoMensajeria: "pagado",
        pagoHabilitado: false,
        motivoPago: "sin_actividad",
        modalidadPago: "mensual",
        participanteActual: null,
        participantes: [],
        mensajes: [],
        encuentros: [],
        recursos: [],
        accesosExtra: [],
      })
    }

    return NextResponse.json(
      {
        error: "No se pudo cargar el espacio.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
