import { NextResponse } from "next/server"
import {
  getActivityAdminPermission,
  listPermissionsForRole,
  requireAuthenticatedActor,
  resolveActivityAccess,
  type ActivitySlug,
} from "@/lib/authz"

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

    return NextResponse.json({
      ok: true,
      actor: {
        email: auth.actor.email,
        name: auth.actor.name,
        role: auth.actor.role,
      },
      permissions: listPermissionsForRole(auth.actor.role),
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
