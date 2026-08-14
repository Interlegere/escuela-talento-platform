import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  hasPermission,
  requireActivityAccess,
} from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const BUCKET = process.env.SUPABASE_ENTUSIASMO_BUCKET || "entusiasmo-producciones"

type ProyectoRow = {
  id: number
  participante_email: string
  participante_nombre: string | null
  nombre: string | null
  que: string | null
  para_que: string | null
  problema_solucion: string | null
  resultado_semanal: string | null
  resultado_mensual: string | null
  resultado_trimestral: string | null
  resultado_anual: string | null
  habilidad_a_desarrollar: string | null
  que_te_entusiasma: string | null
  pitch_contenido: string | null
  pitch_storage_path: string | null
  pitch_mime_type: string | null
  pitch_actualizado_at: string | null
  agente_recordatorio_texto: string | null
  agente_recordatorio_generado_at: string | null
  created_at: string
  updated_at: string
}

type Body = {
  participanteEmail?: string
  nombre?: string
  que?: string
  paraQue?: string
  problemaSolucion?: string
  resultadoSemanal?: string
  resultadoMensual?: string
  resultadoTrimestral?: string
  resultadoAnual?: string
  habilidadADesarrollar?: string
  queTeEntusiasma?: string
  pitchContenido?: string
}

export async function GET(req: Request) {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return auth.response
    }

    const url = new URL(req.url)
    const emailConsultado = url.searchParams.get("email")?.trim().toLowerCase()
    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")

    if (emailConsultado && emailConsultado !== auth.actor.email && !esAdmin) {
      return NextResponse.json(
        { error: "No podés ver el proyecto de otra persona." },
        { status: 403 }
      )
    }

    const emailObjetivo = emailConsultado || auth.actor.email
    const supabase = createAdminSupabaseClient()

    const { data, error } = await supabase
      .from("entusiasmo_proyectos")
      .select("*")
      .eq("participante_email", emailObjetivo)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo cargar el proyecto.", detalle: error },
        { status: 500 }
      )
    }

    const proyecto = (data as ProyectoRow | null) || null
    let pitchSignedUrl: string | null = null

    if (proyecto?.pitch_storage_path) {
      const { data: signedData } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(proyecto.pitch_storage_path, 60 * 60)

      pitchSignedUrl = signedData?.signedUrl || null
    }

    return NextResponse.json({ ok: true, proyecto, pitchSignedUrl })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno cargando el proyecto.", detalle: String(error) },
      { status: 500 }
    )
  }
}

// Campos de coordenadas que se versionan (no incluye pitch_contenido ni
// resultado_semanal, que ya no se editan desde la UI de Coordenadas).
const CAMPOS_VERSIONABLES: Array<{ campoBody: keyof Body; columna: string }> = [
  { campoBody: "nombre", columna: "nombre" },
  { campoBody: "que", columna: "que" },
  { campoBody: "paraQue", columna: "para_que" },
  { campoBody: "problemaSolucion", columna: "problema_solucion" },
  { campoBody: "resultadoMensual", columna: "resultado_mensual" },
  { campoBody: "resultadoTrimestral", columna: "resultado_trimestral" },
  { campoBody: "resultadoAnual", columna: "resultado_anual" },
  { campoBody: "habilidadADesarrollar", columna: "habilidad_a_desarrollar" },
  { campoBody: "queTeEntusiasma", columna: "que_te_entusiasma" },
]

export async function PUT(req: Request) {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const esAdmin = hasPermission(auth.actor, "casatalentos.admin")
    const emailSolicitado = body.participanteEmail?.trim().toLowerCase()

    if (emailSolicitado && emailSolicitado !== auth.actor.email && !esAdmin) {
      return NextResponse.json(
        { error: "No podés editar el proyecto de otra persona." },
        { status: 403 }
      )
    }

    const emailObjetivo = emailSolicitado || auth.actor.email
    const esPropio = emailObjetivo === auth.actor.email
    const supabase = createAdminSupabaseClient()

    const { data: existente } = await supabase
      .from("entusiasmo_proyectos")
      .select("id, participante_nombre, nombre, que, para_que, problema_solucion, resultado_mensual, resultado_trimestral, resultado_anual, habilidad_a_desarrollar, que_te_entusiasma")
      .eq("participante_email", emailObjetivo)
      .maybeSingle()

    const participanteNombre = esPropio
      ? auth.actor.name || null
      : existente?.participante_nombre || null

    const { data, error } = await supabase
      .from("entusiasmo_proyectos")
      .upsert(
        {
          participante_email: emailObjetivo,
          participante_nombre: participanteNombre,
          nombre: body.nombre ?? null,
          que: body.que ?? null,
          para_que: body.paraQue ?? null,
          problema_solucion: body.problemaSolucion ?? null,
          resultado_semanal: body.resultadoSemanal ?? null,
          resultado_mensual: body.resultadoMensual ?? null,
          resultado_trimestral: body.resultadoTrimestral ?? null,
          resultado_anual: body.resultadoAnual ?? null,
          habilidad_a_desarrollar: body.habilidadADesarrollar ?? null,
          que_te_entusiasma: body.queTeEntusiasma ?? null,
          pitch_contenido: body.pitchContenido ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "participante_email" }
      )
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        { error: "No se pudo guardar el proyecto.", detalle: error },
        { status: 500 }
      )
    }

    // Antes de perder el valor anterior de cada campo, lo archivamos como
    // una versión — así el participante puede reescribir sus coordenadas
    // después de un aporte sin perder lo que había escrito antes.
    if (existente) {
      const versiones = CAMPOS_VERSIONABLES.filter(({ campoBody, columna }) => {
        const valorAnterior = (existente as Record<string, unknown>)[columna] as string | null
        const valorNuevo = body[campoBody]
        return (
          valorAnterior &&
          valorAnterior.trim() &&
          valorAnterior !== (valorNuevo ?? null)
        )
      }).map(({ columna }) => ({
        proyecto_id: existente.id,
        campo: columna,
        contenido: (existente as Record<string, unknown>)[columna] as string,
      }))

      if (versiones.length > 0) {
        await supabase.from("entusiasmo_coordenadas_versiones").insert(versiones)
      }
    }

    return NextResponse.json({ ok: true, proyecto: data as ProyectoRow })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno guardando el proyecto.", detalle: String(error) },
      { status: 500 }
    )
  }
}
