import { NextResponse } from "next/server"
import { getActivityAdminPermission, requireActivityAccess } from "@/lib/authz"
import { listarParticipantesActividad } from "@/lib/espacios"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const BUCKET = process.env.SUPABASE_ENTUSIASMO_BUCKET || "entusiasmo-producciones"
const MAX_PRODUCCIONES_POR_PUESTO = 4

type ProyectoRow = {
  id: number
  participante_email: string
  pitch_storage_path: string | null
  pitch_mime_type: string | null
}

type ProduccionRow = {
  id: number
  proyecto_id: number
  tipo: string
  titulo: string | null
  contenido: string | null
  storage_path: string | null
}

export async function GET() {
  try {
    const auth = await requireActivityAccess(
      "casatalentos",
      getActivityAdminPermission("casatalentos")
    )

    if ("response" in auth) {
      return auth.response
    }

    const supabase = createAdminSupabaseClient()
    const participantes = await listarParticipantesActividad("casatalentos")

    const { data: proyectos } = await supabase
      .from("entusiasmo_proyectos")
      .select("id, participante_email, pitch_storage_path, pitch_mime_type")

    const proyectosRows = (proyectos as ProyectoRow[]) || []
    const proyectoPorEmail = new Map(
      proyectosRows.map((p) => [p.participante_email, p])
    )
    const proyectoIds = proyectosRows.map((p) => p.id)

    const produccionesPorProyecto = new Map<number, ProduccionRow[]>()

    if (proyectoIds.length > 0) {
      const { data: producciones } = await supabase
        .from("entusiasmo_producciones")
        .select("id, proyecto_id, tipo, titulo, contenido, storage_path")
        .in("proyecto_id", proyectoIds)
        .eq("visible", true)
        .order("created_at", { ascending: false })

      for (const item of (producciones as ProduccionRow[]) || []) {
        const lista = produccionesPorProyecto.get(item.proyecto_id) || []
        if (lista.length < MAX_PRODUCCIONES_POR_PUESTO) {
          lista.push(item)
        }
        produccionesPorProyecto.set(item.proyecto_id, lista)
      }
    }

    const paths: string[] = []
    for (const p of proyectosRows) {
      if (p.pitch_storage_path) paths.push(p.pitch_storage_path)
    }
    for (const lista of produccionesPorProyecto.values()) {
      for (const item of lista) {
        if (item.storage_path) paths.push(item.storage_path)
      }
    }

    const signedUrls = new Map<string, string>()

    if (paths.length > 0) {
      const { data: signedData } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths, 60 * 60)

      for (const item of signedData || []) {
        if (item.path && item.signedUrl) {
          signedUrls.set(item.path, item.signedUrl)
        }
      }
    }

    const emailPropio = auth.actor.email

    const puestos = participantes
      .map((p) => {
        const proyecto = proyectoPorEmail.get(p.email)
        const producciones = proyecto
          ? produccionesPorProyecto.get(proyecto.id) || []
          : []

        return {
          email: p.email,
          nombre: p.nombre,
          esPropio: p.email === emailPropio,
          pitchSignedUrl: proyecto?.pitch_storage_path
            ? signedUrls.get(proyecto.pitch_storage_path) || null
            : null,
          pitchMimeType: proyecto?.pitch_mime_type || null,
          producciones: producciones.map((item) => ({
            id: item.id,
            tipo: item.tipo,
            titulo: item.titulo,
            contenido: item.contenido,
            signedUrl: item.storage_path
              ? signedUrls.get(item.storage_path) || null
              : null,
          })),
        }
      })
      .filter((p) => p.pitchSignedUrl || p.producciones.length > 0)
      .sort((a, b) => (a.esPropio === b.esPropio ? 0 : a.esPropio ? -1 : 1))

    return NextResponse.json({ ok: true, puestos })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno cargando CoFruto.", detalle: String(error) },
      { status: 500 }
    )
  }
}
