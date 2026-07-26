import type { ActivitySlug } from "@/lib/authz"
import { normalizarModalidadPago } from "@/lib/billing"
import { asegurarActividadBase } from "@/lib/core-activities"
import {
  obtenerHonorarioBasePorActividadConfigurado,
  obtenerPreciosComboConfigurados,
} from "@/lib/payment-pricing"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type SupabaseAdmin = ReturnType<typeof createAdminSupabaseClient>

type SyncUsuarioActividadParams = {
  supabase: SupabaseAdmin
  usuarioId: string
  usuarioEmail: string
  actividadSlug: ActivitySlug
  habilitada: boolean
  notas?: string | null
}

type SyncInscripcionParams = {
  supabase: SupabaseAdmin
  actividadId: number
  participanteEmail: string
  participanteNombre: string
  activa: boolean
}

type AsegurarHonorarioYPagoParams = {
  supabase: SupabaseAdmin
  actividadId: number
  actividadSlug: ActivitySlug
  participanteEmail: string
  participanteNombre: string
  medioPago?: string | null
}

type HonorarioAdminRow = {
  id: number
  actividad_id: number
  participante_email: string
  participante_nombre?: string | null
  honorario_mensual: string | number
  modalidad_pago?: string | null
  moneda?: string | null
  activo?: boolean | null
}

type ResultadoProvisionPago = {
  honorarioCreado?: boolean
  pagoCreado?: boolean
  advertencia?: string | null
}

function normalizarEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase()
}

function esModalidadEspecial(
  modalidad?: string | null
): modalidad is "becado" | "invitado" | "sin_cobro" {
  return (
    modalidad === "becado" ||
    modalidad === "invitado" ||
    modalidad === "sin_cobro"
  )
}

export async function syncUsuarioActividadAdmin(params: SyncUsuarioActividadParams) {
  const { supabase, usuarioId, actividadSlug, habilitada } = params
  const usuarioEmail = normalizarEmail(params.usuarioEmail)

  if (!usuarioId || !usuarioEmail) {
    throw new Error("Faltan datos del usuario para sincronizar actividades.")
  }

  const payload = {
    usuario_id: usuarioId,
    usuario_email: usuarioEmail,
    actividad_slug: actividadSlug,
    estado: habilitada ? "activa" : "inactiva",
    origen: "admin",
    notas: params.notas ?? null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from("usuario_actividades").upsert(payload, {
    onConflict: "usuario_email,actividad_slug",
  })

  if (error) {
    throw new Error(`No se pudo sincronizar usuario_actividades: ${error.message}`)
  }
}

export async function syncInscripcionAdmin(params: SyncInscripcionParams) {
  const { supabase, actividadId, activa } = params
  const participanteEmail = normalizarEmail(params.participanteEmail)
  const participanteNombre = String(params.participanteNombre || "").trim()

  if (!actividadId || !participanteEmail) {
    throw new Error("Faltan datos para sincronizar inscripción.")
  }

  const { data: inscripciones, error: inscripcionesError } = await supabase
    .from("inscripciones")
    .select("id, estado")
    .eq("actividad_id", actividadId)
    .eq("participante_email", participanteEmail)
    .order("id", { ascending: false })

  if (inscripcionesError) {
    throw new Error(`No se pudo consultar inscripciones: ${inscripcionesError.message}`)
  }

  const existentes = inscripciones || []
  const activaExistente =
    existentes.find((item) => item.estado === "activa") || existentes[0] || null

  if (activa) {
    if (activaExistente?.id) {
      const { error: updateError } = await supabase
        .from("inscripciones")
        .update({
          participante_nombre: participanteNombre || null,
          estado: "activa",
        })
        .eq("id", activaExistente.id)

      if (updateError) {
        throw new Error(`No se pudo reactivar la inscripción: ${updateError.message}`)
      }
      return
    }

    const { error: insertError } = await supabase.from("inscripciones").insert({
      actividad_id: actividadId,
      participante_nombre: participanteNombre || null,
      participante_email: participanteEmail,
      estado: "activa",
    })

    if (insertError) {
      throw new Error(`No se pudo crear la inscripción: ${insertError.message}`)
    }

    return
  }

  if (existentes.length === 0) {
    return
  }

  const idsActivos = existentes
    .filter((item) => item.estado === "activa")
    .map((item) => item.id)

  if (idsActivos.length === 0) {
    return
  }

  const { error: deactivateError } = await supabase
    .from("inscripciones")
    .update({ estado: "inactiva" })
    .in("id", idsActivos)

  if (deactivateError) {
    throw new Error(`No se pudo desactivar la inscripción: ${deactivateError.message}`)
  }
}

export async function syncHonorarioEstadoAdmin(params: {
  supabase: SupabaseAdmin
  actividadId: number
  participanteEmail: string
  activo: boolean
}) {
  const { supabase, actividadId, activo } = params
  const participanteEmail = normalizarEmail(params.participanteEmail)

  if (!actividadId || !participanteEmail) {
    throw new Error("Faltan datos para sincronizar el estado del honorario.")
  }

  const { error } = await supabase
    .from("honorarios_participante")
    .update({
      activo,
      updated_at: new Date().toISOString(),
    })
    .eq("actividad_id", actividadId)
    .eq("participante_email", participanteEmail)

  if (error) {
    throw new Error(`No se pudo sincronizar el estado del honorario: ${error.message}`)
  }
}

export async function asegurarHonorarioYPagoAdmin(
  params: AsegurarHonorarioYPagoParams
): Promise<ResultadoProvisionPago> {
  const { supabase, actividadId, actividadSlug } = params
  const participanteEmail = normalizarEmail(params.participanteEmail)
  const participanteNombre = String(params.participanteNombre || "").trim()
  const medioPago = params.medioPago || null

  if (!actividadId || !participanteEmail) {
    return {
      advertencia:
        "Faltan datos para provisionar honorario y pago de la actividad.",
    }
  }

  const { data: honorarioExistente, error: honorarioError } = await supabase
    .from("honorarios_participante")
    .select("*")
    .eq("actividad_id", actividadId)
    .eq("participante_email", participanteEmail)
    .maybeSingle()

  if (honorarioError) {
    throw new Error(`No se pudo consultar honorarios: ${honorarioError.message}`)
  }

  let honorario = honorarioExistente as HonorarioAdminRow | null
  let honorarioCreado = false

  if (honorario) {
    if (honorario.activo === false) {
      const { data: honorarioReactivado, error: honorarioReactivadoError } =
        await supabase
          .from("honorarios_participante")
          .update({
            participante_nombre: participanteNombre || null,
            activo: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", honorario.id)
          .select("*")
          .single()

      if (honorarioReactivadoError || !honorarioReactivado) {
        throw new Error(
          `No se pudo reactivar el honorario existente: ${honorarioReactivadoError?.message || "sin detalle"}`
        )
      }

      honorario = honorarioReactivado as HonorarioAdminRow
    }
  } else {
    if (
      actividadSlug !== "casatalentos" &&
      actividadSlug !== "conectando-sentidos" &&
      actividadSlug !== "terapia"
    ) {
      return {
        advertencia:
          "La actividad quedó habilitada, pero el honorario debe configurarse manualmente (es un pago personalizado).",
      }
    }

    const honorarioBase = await obtenerHonorarioBasePorActividadConfigurado(
      actividadSlug
    )

    if (!Number.isFinite(honorarioBase) || honorarioBase <= 0) {
      return {
        advertencia:
          actividadSlug === "casatalentos"
            ? "CasaTalentos quedó habilitada, pero falta configurar su honorario base en Administración."
            : actividadSlug === "conectando-sentidos"
              ? "Conectando Sentidos quedó habilitada, pero falta configurar su honorario base en Administración."
              : "Terapia quedó habilitada, pero falta configurar su honorario base en Administración.",
      }
    }

    const { data: nuevoHonorario, error: nuevoHonorarioError } = await supabase
      .from("honorarios_participante")
      .upsert(
        {
          actividad_id: actividadId,
          participante_email: participanteEmail,
          participante_nombre: participanteNombre || null,
          honorario_mensual: honorarioBase,
          modalidad_pago: actividadSlug === "terapia" ? "sesion" : "mensual",
          moneda: "ARS",
          activo: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "actividad_id,participante_email",
        }
      )
      .select("*")
      .single()

    if (nuevoHonorarioError || !nuevoHonorario) {
      throw new Error(
        `No se pudo crear honorario base: ${nuevoHonorarioError?.message || "sin detalle"}`
      )
    }

    honorario = nuevoHonorario as HonorarioAdminRow
    honorarioCreado = true
  }

  const modalidadPago = normalizarModalidadPago(
    honorario.modalidad_pago,
    actividadSlug
  )
  const modalidadEspecial = esModalidadEspecial(honorario.modalidad_pago)

  if (modalidadPago === "sesion") {
    return {
      honorarioCreado,
      advertencia:
        "La actividad quedó habilitada. El cobro por sesión se genera al reservar cada encuentro.",
    }
  }

  await syncInscripcionAdmin({
    supabase,
    actividadId,
    participanteEmail,
    participanteNombre,
    activa: true,
  })

  const { data: inscripcion, error: inscripcionError } = await supabase
    .from("inscripciones")
    .select("id")
    .eq("actividad_id", actividadId)
    .eq("participante_email", participanteEmail)
    .eq("estado", "activa")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (inscripcionError || !inscripcion?.id) {
    throw new Error(
      `No se pudo obtener la inscripción activa para generar el cobro.`
    )
  }

  const ahora = new Date()
  const anio = ahora.getFullYear()
  const mes = ahora.getMonth() + 1

  let pagoExistente = null
  let pagoExistenteError = null

  if (modalidadPago === "proceso") {
    const resultado = await supabase
      .from("pagos_mensuales")
      .select("*")
      .eq("inscripcion_id", inscripcion.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    pagoExistente = resultado.data
    pagoExistenteError = resultado.error
  } else {
    const resultado = await supabase
      .from("pagos_mensuales")
      .select("*")
      .eq("inscripcion_id", inscripcion.id)
      .eq("anio", anio)
      .eq("mes", mes)
      .maybeSingle()

    pagoExistente = resultado.data
    pagoExistenteError = resultado.error
  }

  if (pagoExistenteError) {
    throw new Error(
      `No se pudo consultar el pago vigente: ${pagoExistenteError.message}`
    )
  }

  const monto = String(honorario.honorario_mensual)
  const moneda = honorario.moneda || "ARS"

  if (pagoExistente) {
    const cambiosPago: Record<string, unknown> = {}

    if (
      String(pagoExistente.monto) !== monto ||
      String(pagoExistente.moneda || "") !== moneda
    ) {
      cambiosPago.monto = monto
      cambiosPago.moneda = moneda
    }

    if (medioPago && String(pagoExistente.medio_pago || "") !== medioPago) {
      cambiosPago.medio_pago = medioPago
    }

    if (modalidadEspecial && pagoExistente.estado !== "pagado") {
      cambiosPago.estado = "pagado"
    }

    if (Object.keys(cambiosPago).length > 0) {
      const { error: pagoUpdateError } = await supabase
        .from("pagos_mensuales")
        .update(cambiosPago)
        .eq("id", pagoExistente.id)

      if (pagoUpdateError) {
        throw new Error(
          `No se pudo sincronizar el monto del cobro: ${pagoUpdateError.message}`
        )
      }
    }

    return {
      honorarioCreado,
      pagoCreado: false,
    }
  }

  const { error: nuevoPagoError } = await supabase
    .from("pagos_mensuales")
    .insert({
      actividad_id: actividadId,
      inscripcion_id: inscripcion.id,
      anio,
      mes,
      estado: modalidadEspecial ? "pagado" : "pendiente",
      monto,
      moneda,
      medio_pago: medioPago,
    })

  if (nuevoPagoError) {
    throw new Error(
      `No se pudo crear el cobro vigente: ${nuevoPagoError.message}`
    )
  }

  return {
    honorarioCreado,
    pagoCreado: true,
  }
}

export async function sincronizarPrecioComboSiCorresponde(
  supabase: SupabaseAdmin,
  participanteEmailInput: string
): Promise<void> {
  const participanteEmail = normalizarEmail(participanteEmailInput)

  if (!participanteEmail) {
    return
  }

  const [actividadCT, actividadCS, actividadTerapia] = await Promise.all([
    asegurarActividadBase("casatalentos"),
    asegurarActividadBase("conectando-sentidos"),
    asegurarActividadBase("terapia"),
  ])

  const { data: inscripciones, error: inscripcionesError } = await supabase
    .from("inscripciones")
    .select("actividad_id, estado")
    .eq("participante_email", participanteEmail)
    .in("actividad_id", [actividadCT.id, actividadCS.id, actividadTerapia.id])

  if (inscripcionesError) {
    return
  }

  const activasPorActividadId = new Set(
    (inscripciones || [])
      .filter((item) => item.estado === "activa")
      .map((item) => item.actividad_id)
  )

  const tieneCombo =
    activasPorActividadId.has(actividadCT.id) &&
    activasPorActividadId.has(actividadCS.id)

  const { ctCsHonorario, terapiaSesion } = await obtenerPreciosComboConfigurados()
  const comboIndividualCtCs =
    ctCsHonorario > 0 ? Math.round(ctCsHonorario / 2) : null

  for (const actividad of [actividadCT, actividadCS]) {
    const { data: honorario } = await supabase
      .from("honorarios_participante")
      .select("id, honorario_mensual, activo")
      .eq("actividad_id", actividad.id)
      .eq("participante_email", participanteEmail)
      .maybeSingle()

    if (!honorario || honorario.activo === false) {
      continue
    }

    if (tieneCombo && comboIndividualCtCs !== null) {
      if (Number(honorario.honorario_mensual) !== comboIndividualCtCs) {
        await supabase
          .from("honorarios_participante")
          .update({
            honorario_mensual: comboIndividualCtCs,
            updated_at: new Date().toISOString(),
          })
          .eq("id", honorario.id)
      }
      continue
    }

    if (!tieneCombo && comboIndividualCtCs !== null) {
      // Sólo revierte si el valor sigue siendo el del combo (no pisa una
      // edición manual posterior del honorario).
      if (Number(honorario.honorario_mensual) === comboIndividualCtCs) {
        const baseEstandar = await obtenerHonorarioBasePorActividadConfigurado(
          actividad.slug
        )

        if (baseEstandar > 0) {
          await supabase
            .from("honorarios_participante")
            .update({
              honorario_mensual: baseEstandar,
              updated_at: new Date().toISOString(),
            })
            .eq("id", honorario.id)
        }
      }
    }
  }

  const { data: honorarioTerapia } = await supabase
    .from("honorarios_participante")
    .select("id, honorario_mensual, modalidad_pago, activo")
    .eq("actividad_id", actividadTerapia.id)
    .eq("participante_email", participanteEmail)
    .maybeSingle()

  if (!honorarioTerapia || honorarioTerapia.activo === false) {
    return
  }

  const modalidadTerapia = normalizarModalidadPago(
    honorarioTerapia.modalidad_pago,
    "terapia"
  )

  if (modalidadTerapia !== "sesion") {
    return
  }

  if (tieneCombo && terapiaSesion > 0) {
    if (Number(honorarioTerapia.honorario_mensual) !== terapiaSesion) {
      await supabase
        .from("honorarios_participante")
        .update({
          honorario_mensual: terapiaSesion,
          updated_at: new Date().toISOString(),
        })
        .eq("id", honorarioTerapia.id)
    }
    return
  }

  if (
    !tieneCombo &&
    terapiaSesion > 0 &&
    Number(honorarioTerapia.honorario_mensual) === terapiaSesion
  ) {
    const baseTerapia = await obtenerHonorarioBasePorActividadConfigurado(
      "terapia"
    )

    if (baseTerapia > 0) {
      await supabase
        .from("honorarios_participante")
        .update({
          honorario_mensual: baseTerapia,
          updated_at: new Date().toISOString(),
        })
        .eq("id", honorarioTerapia.id)
    }
  }
}
