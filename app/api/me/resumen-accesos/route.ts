import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  listPermissionsForRole,
  requireAuthenticatedActor,
  resolveActivityAccess,
  type ActivitySlug,
} from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import {
  charlaIntroFechaTexto,
  charlaIntroMeetUrl,
  charlaIntroSubtitulo,
  charlaIntroTitulo,
} from "@/lib/mailing"

const actividades: ActivitySlug[] = [
  "casatalentos",
  "conectando-sentidos",
  "mentorias",
  "terapia",
  "membresia",
]

export async function GET() {
  try {
    const auth = await requireAuthenticatedActor()

    if ("response" in auth) {
      return auth.response
    }

    const accesos = await Promise.all(
      actividades.map(async (slug) => {
        const adminPermission = getActivityAdminPermission(slug)
        const tienePermisoAdmin = adminPermission
          ? listPermissionsForRole(auth.actor.role).includes(adminPermission)
          : false

        if (tienePermisoAdmin) {
          return {
            slug,
            acceso: true,
            motivo: "permiso_admin",
          }
        }

        try {
          const access = await resolveActivityAccess(slug, auth.actor.email)
          return {
            slug,
            acceso: access.acceso,
            motivo: access.motivo,
          }
        } catch (error) {
          if (String(error).includes("Actividad no encontrada")) {
            return {
              slug,
              acceso: false,
              motivo: "actividad_no_configurada",
            }
          }

          throw error
        }
      })
    )

    const supabase = createAdminSupabaseClient()
    const { data: usuarioData } = await supabase
      .from("usuarios_plataforma")
      .select("charla_intro_habilitada")
      .eq("email", auth.actor.email)
      .maybeSingle()

    const charlaIntroHabilitada =
      usuarioData?.charla_intro_habilitada === true &&
      auth.actor.role !== "admin"

    return NextResponse.json({
      ok: true,
      actor: {
        email: auth.actor.email,
        name: auth.actor.name,
        role: auth.actor.role,
      },
      permissions: listPermissionsForRole(auth.actor.role),
      usuario: {
        charlaIntroHabilitada,
      },
      charlaIntro: {
        habilitada: charlaIntroHabilitada,
        titulo: charlaIntroTitulo(),
        subtitulo: charlaIntroSubtitulo(),
        fechaTexto: charlaIntroFechaTexto() || null,
        meetUrl: charlaIntroMeetUrl() || null,
      },
      accesos,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar el resumen de accesos.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
