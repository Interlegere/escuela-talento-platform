import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { limpiarNombreArchivo } from "@/lib/espacios"

const BUCKET_ENTUSIASMO =
  process.env.SUPABASE_ENTUSIASMO_BUCKET || "entusiasmo-producciones"
const BUCKET_CASATALENTOS = "casatalentos-videos"
const BUCKET_ESPACIOS = process.env.SUPABASE_ESPACIOS_BUCKET || "espacios-archivos"
const ACTIVIDADES_CON_ESPACIO = ["conectando-sentidos", "mentorias", "terapia"]

type Supabase = ReturnType<typeof createAdminSupabaseClient>

async function listarArchivosRecursivo(
  supabase: Supabase,
  bucket: string,
  prefijo: string
): Promise<string[]> {
  const { data, error } = await supabase.storage.from(bucket).list(prefijo, {
    limit: 500,
  })

  if (error || !data) return []

  const rutas: string[] = []

  for (const entrada of data) {
    const ruta = `${prefijo}/${entrada.name}`

    // Las "carpetas" de Supabase Storage no tienen id/metadata propios —
    // es la única forma de distinguirlas de un archivo real sin conocer
    // de antemano la estructura de subcarpetas de cada bucket.
    if (entrada.id) {
      rutas.push(ruta)
    } else {
      rutas.push(...(await listarArchivosRecursivo(supabase, bucket, ruta)))
    }
  }

  return rutas
}

async function borrarPrefijoCompleto(supabase: Supabase, bucket: string, prefijo: string) {
  const rutas = await listarArchivosRecursivo(supabase, bucket, prefijo)

  if (rutas.length === 0) return 0

  await supabase.storage.from(bucket).remove(rutas)
  return rutas.length
}

type ResultadoEliminacion = {
  ok: true
  conteos: Record<string, number>
  archivosBorrados: number
}

type ErrorEliminacion = {
  ok: false
  error: string
}

// Borra a una persona de la plataforma por completo: todas las filas
// relacionadas por email (vía la función de Postgres, atómica) más los
// archivos que le pertenecen en Storage. Solo permite borrar a alguien ya
// inactivo — el chequeo real está en la función de la base, acá se repite
// antes para poder dar un mensaje de error claro sin gastar el intento.
export async function eliminarUsuarioPlataformaCompleto(params: {
  id: string
  email: string
  eliminadoPorEmail: string
}): Promise<ResultadoEliminacion | ErrorEliminacion> {
  const supabase = createAdminSupabaseClient()
  const email = params.email.trim().toLowerCase()
  const emailLimpio = limpiarNombreArchivo(email)

  const { data: usuario } = await supabase
    .from("usuarios_plataforma")
    .select("id, activo")
    .eq("id", params.id)
    .maybeSingle()

  if (!usuario) {
    return { ok: false, error: "No se encontró a esa persona." }
  }

  if (usuario.activo) {
    return {
      ok: false,
      error: "Solo se puede eliminar a alguien que ya está inactivo.",
    }
  }

  // Se juntan las rutas de Storage ANTES de borrar las filas — una vez que
  // la función de la base corra, esas filas (y sus storage_path) ya no
  // van a existir para consultarlas.
  const rutasABorrar: string[] = []

  const { data: proyecto } = await supabase
    .from("entusiasmo_proyectos")
    .select("id, pitch_storage_path")
    .eq("participante_email", email)
    .maybeSingle<{ id: number; pitch_storage_path: string | null }>()

  if (proyecto?.pitch_storage_path) {
    rutasABorrar.push(proyecto.pitch_storage_path)
  }

  if (proyecto?.id) {
    const { data: producciones } = await supabase
      .from("entusiasmo_producciones")
      .select("storage_path")
      .eq("proyecto_id", proyecto.id)

    for (const item of (producciones as { storage_path: string | null }[]) || []) {
      if (item.storage_path) rutasABorrar.push(item.storage_path)
    }
  }

  const { data: videos } = await supabase
    .from("casatalentos_videos")
    .select("storage_path")
    .eq("participante_email", email)

  const rutasVideos = ((videos as { storage_path: string | null }[]) || [])
    .map((v) => v.storage_path)
    .filter((v): v is string => Boolean(v))

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "eliminar_usuario_completo",
    { p_email: email, p_eliminado_por: params.eliminadoPorEmail }
  )

  if (rpcError) {
    return {
      ok: false,
      error: rpcError.message || "No se pudo eliminar a esa persona.",
    }
  }

  let archivosBorrados = 0

  if (rutasABorrar.length > 0) {
    await supabase.storage.from(BUCKET_ENTUSIASMO).remove(rutasABorrar)
    archivosBorrados += rutasABorrar.length
  }

  if (rutasVideos.length > 0) {
    await supabase.storage.from(BUCKET_CASATALENTOS).remove(rutasVideos)
    archivosBorrados += rutasVideos.length
  }

  for (const actividad of ACTIVIDADES_CON_ESPACIO) {
    archivosBorrados += await borrarPrefijoCompleto(
      supabase,
      BUCKET_ESPACIOS,
      `${actividad}/${emailLimpio}`
    )
  }

  return {
    ok: true,
    conteos: (rpcData as Record<string, number>) || {},
    archivosBorrados,
  }
}

// Para avisar en /admin/usuarios si el email que se está por dar de alta
// ya tuvo una cuenta antes (se borró del todo, pero queda este registro
// liviano) — puramente informativo, nunca bloquea la creación.
export async function buscarHistorialEliminacion(email: string) {
  const supabase = createAdminSupabaseClient()

  const { data } = await supabase
    .from("usuarios_eliminados_historial")
    .select("nombre, eliminado_at")
    .eq("email", email.trim().toLowerCase())
    .order("eliminado_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ nombre: string | null; eliminado_at: string }>()

  return data || null
}
