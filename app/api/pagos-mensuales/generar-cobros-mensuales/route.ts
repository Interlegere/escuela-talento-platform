import { NextResponse } from "next/server"
import type { ActivitySlug } from "@/lib/authz"
import { asegurarHonorarioYPagoAdmin } from "@/lib/admin-activity-sync"
import { asegurarActividadBase } from "@/lib/core-activities"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const ACTIVIDADES_MENSUALES: Exclude<ActivitySlug, "mentorias" | "terapia">[] = [
  "casatalentos",
  "conectando-sentidos",
  "membresia",
]

type InscripcionRow = {
  id: number
  participante_email: string
  participante_nombre?: string | null
}

type ResumenActividad = {
  procesados: number
  honorariosCreados: number
  pagosCreados: number
  advertencias: string[]
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = req.headers.get("authorization")

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const supabase = createAdminSupabaseClient()
    const resumen: Record<string, ResumenActividad> = {}
    const errores: { actividadSlug: string; participanteEmail: string; motivo: string }[] = []

    for (const actividadSlug of ACTIVIDADES_MENSUALES) {
      const actividadResumen: ResumenActividad = {
        procesados: 0,
        honorariosCreados: 0,
        pagosCreados: 0,
        advertencias: [],
      }
      resumen[actividadSlug] = actividadResumen

      const actividadId =
        actividadSlug === "membresia"
          ? await (async () => {
              const { data } = await supabase
                .from("actividades")
                .select("id")
                .eq("slug", "membresia")
                .maybeSingle()
              return data?.id || null
            })()
          : (await asegurarActividadBase(actividadSlug)).id

      if (!actividadId) {
        continue
      }

      const { data: inscripciones, error: inscripcionesError } = await supabase
        .from("inscripciones")
        .select("id, participante_email, participante_nombre")
        .eq("actividad_id", actividadId)
        .eq("estado", "activa")

      if (inscripcionesError) {
        errores.push({
          actividadSlug,
          participanteEmail: "",
          motivo: `No se pudieron listar las inscripciones: ${inscripcionesError.message}`,
        })
        continue
      }

      for (const inscripcion of (inscripciones as InscripcionRow[] | null) || []) {
        const participanteEmail = String(inscripcion.participante_email || "")
          .trim()
          .toLowerCase()

        if (!participanteEmail) {
          continue
        }

        actividadResumen.procesados += 1

        try {
          const resultado = await asegurarHonorarioYPagoAdmin({
            supabase,
            actividadId,
            actividadSlug,
            participanteEmail,
            participanteNombre: String(inscripcion.participante_nombre || "").trim(),
          })

          if (resultado.honorarioCreado) {
            actividadResumen.honorariosCreados += 1
          }

          if (resultado.pagoCreado) {
            actividadResumen.pagosCreados += 1
          }

          if (resultado.advertencia) {
            actividadResumen.advertencias.push(
              `${participanteEmail}: ${resultado.advertencia}`
            )
          }
        } catch (error) {
          errores.push({
            actividadSlug,
            participanteEmail,
            motivo: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    return NextResponse.json({
      ok: true,
      fecha: new Date().toISOString(),
      resumen,
      errores,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno generando los cobros mensuales",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
