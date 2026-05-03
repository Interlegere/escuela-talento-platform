import { NextResponse } from "next/server"
import {
  requireAuthenticatedActor,
  type ActivitySlug,
} from "@/lib/authz"
import { asegurarActividadBase } from "@/lib/core-activities"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { normalizarModalidadPago } from "@/lib/billing"

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const body = await req.json()

    const actividadSlug = body.actividadSlug as ActivitySlug
    const participanteEmail =
      auth.actor.role === "admin" && body.participanteEmail
        ? String(body.participanteEmail).trim().toLowerCase()
        : auth.actor.email

    if (!actividadSlug || !participanteEmail) {
      return NextResponse.json(
        { error: "Faltan datos" },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    if (actividadSlug !== "membresia") {
      await asegurarActividadBase(actividadSlug as Exclude<ActivitySlug, "membresia">)
    }

    const { data: actividad } = await supabase
      .from("actividades")
      .select("*")
      .eq("slug", actividadSlug)
      .single()

    if (!actividad) {
      return NextResponse.json(
        { error: "Actividad no encontrada" },
        { status: 404 }
      )
    }

    const { data: inscripcion } = await supabase
      .from("inscripciones")
      .select("*")
      .eq("actividad_id", actividad.id)
      .eq("participante_email", participanteEmail)
      .eq("estado", "activa")
      .maybeSingle()

    if (!inscripcion) {
      return NextResponse.json({
        acceso: false,
        motivo: "sin_inscripcion",
      })
    }

    const { data: honorario } = await supabase
      .from("honorarios_participante")
      .select("modalidad_pago")
      .eq("actividad_id", actividad.id)
      .eq("participante_email", participanteEmail)
      .eq("activo", true)
      .maybeSingle()

    const modalidadPago = normalizarModalidadPago(
      honorario?.modalidad_pago,
      actividadSlug
    )

    if (modalidadPago === "sesion") {
      return NextResponse.json({
        acceso: false,
        motivo: "sesion",
        modalidadPago,
      })
    }

    let pago = null

    if (modalidadPago === "proceso") {
      const resultado = await supabase
        .from("pagos_mensuales")
        .select("*")
        .eq("inscripcion_id", inscripcion.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      pago = resultado.data
    } else {
      const ahora = new Date()
      const anio = ahora.getFullYear()
      const mes = ahora.getMonth() + 1

      const resultado = await supabase
        .from("pagos_mensuales")
        .select("*")
        .eq("inscripcion_id", inscripcion.id)
        .eq("anio", anio)
        .eq("mes", mes)
        .maybeSingle()

      pago = resultado.data
    }

    if (!pago) {
      return NextResponse.json({
        acceso: false,
        motivo: "sin_pago",
        modalidadPago,
      })
    }

    if (pago.estado === "pagado") {
      return NextResponse.json({
        acceso: true,
        modalidadPago,
      })
    }

    return NextResponse.json({
      acceso: false,
      motivo: pago.estado,
      modalidadPago,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Error validando acceso", detalle: String(error) },
      { status: 500 }
    )
  }
}
