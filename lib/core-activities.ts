import type { ActivitySlug } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const ACTIVIDADES_BASE: Record<
  Exclude<ActivitySlug, "membresia">,
  { nombre: string }
> = {
  casatalentos: {
    nombre: "CasaTalentos",
  },
  "conectando-sentidos": {
    nombre: "Conectando Sentidos",
  },
  mentorias: {
    nombre: "Mentorías",
  },
  terapia: {
    nombre: "Terapia",
  },
}

type ActividadBasica = {
  id: number
  slug: string
  nombre?: string | null
}

export async function asegurarActividadBase(
  actividadSlug: Exclude<ActivitySlug, "membresia">
) {
  const supabase = createAdminSupabaseClient()

  const { data: existente, error: existenteError } = await supabase
    .from("actividades")
    .select("id, slug, nombre")
    .eq("slug", actividadSlug)
    .maybeSingle()

  if (existenteError) {
    throw existenteError
  }

  if (existente?.id) {
    return existente as ActividadBasica
  }

  const definicion = ACTIVIDADES_BASE[actividadSlug]

  const { data: creada, error: creadaError } = await supabase
    .from("actividades")
    .upsert(
      {
        slug: actividadSlug,
        nombre: definicion.nombre,
      },
      {
        onConflict: "slug",
        ignoreDuplicates: false,
      }
    )
    .select("id, slug, nombre")
    .single()

  if (creadaError || !creada) {
    throw creadaError || new Error("No se pudo asegurar la actividad base.")
  }

  return creada as ActividadBasica
}
