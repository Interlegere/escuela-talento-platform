import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import type { Session } from "next-auth"
import { authOptions } from "@/lib/auth"
import { estaDentroDeGraciaMensual } from "@/lib/activity-rules"
import { normalizarModalidadPago } from "@/lib/billing"
import { asegurarActividadBase } from "@/lib/core-activities"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

export type GlobalRole = "admin" | "colaborador" | "participante"
export type ActivitySlug =
  | "casatalentos"
  | "conectando-sentidos"
  | "mentorias"
  | "terapia"
  | "membresia"

export type Permission =
  | "admin.access"
  | "pagos.review"
  | "grabaciones.manage"
  | "agenda.manage"
  | "agenda.reserve"
  | "casatalentos.view"
  | "casatalentos.participate"
  | "casatalentos.vote"
  | "casatalentos.comment"
  | "casatalentos.admin"
  | "conectando.view"
  | "conectando.admin"
  | "mentorias.view"
  | "mentorias.admin"
  | "terapia.view"
  | "terapia.admin"

export type Actor = {
  session: Session
  role: GlobalRole
  email: string
  name: string
}

type PermissionActor = Pick<Actor, "role">

type ActivityAccessResult = {
  acceso: boolean
  motivo: string | null
  actividad?: ActividadRecord | null
  recursos: RecursoRecord[]
}

type ActividadRecord = {
  id: number
  slug: string
  nombre?: string
}

type RecursoRecord = {
  id: number
  slug?: string | null
  nombre?: string | null
  descripcion?: string | null
  tipo?: string | null
  proveedor?: string | null
  url?: string | null
  drive_file_id?: string | null
}

type ActividadRecursoRow = {
  recursos: RecursoRecord | null
}

type AccesoIndividualRow = {
  recurso_id?: number | string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  habilitado?: boolean | null
  recursos?: RecursoRecord | null
}

type EspacioAcompanamientoAccesoRow = {
  id: number
  actividad_slug: ActivitySlug
}

function esTablaEspaciosFaltante(detalle: unknown) {
  const texto = String(detalle || "").toLowerCase()
  return (
    texto.includes("relation") ||
    texto.includes("does not exist") ||
    texto.includes("could not find the table") ||
    texto.includes("espacios_")
  )
}

function construirRecursosFinales(params: {
  recursosActividad: ActividadRecursoRow[]
  overrides: AccesoIndividualRow[]
}) {
  const { recursosActividad, overrides } = params
  const ahoraTs = new Date().toISOString()
  const mapaOverrides = new Map<string, AccesoIndividualRow>()

  for (const item of overrides) {
    const inicioOk = !item.fecha_inicio || item.fecha_inicio <= ahoraTs
    const finOk = !item.fecha_fin || item.fecha_fin >= ahoraTs

    if (inicioOk && finOk) {
      mapaOverrides.set(String(item.recurso_id), item)
    }
  }

  const recursosBase = recursosActividad
    .map((item) => item.recursos)
    .filter(Boolean)

  const recursosFinales = recursosBase.filter((recurso): recurso is RecursoRecord => {
    if (!recurso) {
      return false
    }

    const override = mapaOverrides.get(String(recurso.id))

    if (!override) {
      return true
    }

    return override.habilitado === true
  })

  const recursosExtra = overrides
    .filter((override) => override.habilitado === true && override.recursos)
    .filter((override) => {
      const inicioOk = !override.fecha_inicio || override.fecha_inicio <= ahoraTs
      const finOk = !override.fecha_fin || override.fecha_fin >= ahoraTs
      return inicioOk && finOk
    })
    .map((override) => override.recursos)
    .filter((recurso): recurso is RecursoRecord => Boolean(recurso))
    .filter(
      (recurso) => !recursosFinales.some((item) => item.id === recurso.id)
    )

  return [...recursosFinales, ...recursosExtra]
}

async function cargarRecursosActividad(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  actividadId: number,
  email: string
) {
  const { data: recursosActividad, error: recursosError } = await supabase
    .from("actividad_recursos")
    .select("*, recursos(*)")
    .eq("actividad_id", actividadId)
    .eq("activo", true)

  if (recursosError) {
    throw new Error("Error cargando recursos")
  }

  const { data: overrides } = await supabase
    .from("accesos_individuales")
    .select("*, recursos(*)")
    .eq("participante_email", email)

  return construirRecursosFinales({
    recursosActividad: (recursosActividad || []) as ActividadRecursoRow[],
    overrides: (overrides || []) as AccesoIndividualRow[],
  })
}

async function tieneAccesoExtraDesdeEspacios(
  actividadDestinoSlug: ActivitySlug,
  participanteEmail: string
) {
  if (
    actividadDestinoSlug !== "casatalentos" &&
    actividadDestinoSlug !== "conectando-sentidos"
  ) {
    return false
  }

  const supabase = createAdminSupabaseClient()
  const email = participanteEmail.trim().toLowerCase()

  const { data: espacios, error: espaciosError } = await supabase
    .from("espacios_acompanamiento")
    .select("id, actividad_slug")
    .eq("participante_email", email)
    .in("actividad_slug", ["mentorias", "terapia"])

  if (espaciosError) {
    if (esTablaEspaciosFaltante(espaciosError.message)) {
      return false
    }

    throw espaciosError
  }

  const espaciosActivos = (espacios || []) as EspacioAcompanamientoAccesoRow[]

  if (espaciosActivos.length === 0) {
    return false
  }

  const espacioIds = espaciosActivos.map((item) => item.id)

  const { data: extras, error: extrasError } = await supabase
    .from("espacios_accesos_extra")
    .select("espacio_id, habilitado, actividad_destino_slug")
    .in("espacio_id", espacioIds)
    .eq("actividad_destino_slug", actividadDestinoSlug)
    .eq("habilitado", true)

  if (extrasError) {
    if (esTablaEspaciosFaltante(extrasError.message)) {
      return false
    }

    throw extrasError
  }

  const extrasActivos = extras || []

  if (extrasActivos.length === 0) {
    return false
  }

  for (const espacio of espaciosActivos) {
    const tieneToggle = extrasActivos.some((item) => item.espacio_id === espacio.id)

    if (!tieneToggle) {
      continue
    }

    const { data: actividadOrigen } = await supabase
      .from("actividades")
      .select("id")
      .eq("slug", espacio.actividad_slug)
      .maybeSingle()

    if (!actividadOrigen?.id) {
      continue
    }

    const { data: inscripcion } = await supabase
      .from("inscripciones")
      .select("id")
      .eq("actividad_id", actividadOrigen.id)
      .eq("participante_email", email)
      .eq("estado", "activa")
      .maybeSingle()

    if (!inscripcion?.id) {
      continue
    }

    const ahora = new Date()
    const anio = ahora.getFullYear()
    const mes = ahora.getMonth() + 1

    const { data: pago } = await supabase
      .from("pagos_mensuales")
      .select("estado")
      .eq("inscripcion_id", inscripcion.id)
      .eq("anio", anio)
      .eq("mes", mes)
      .maybeSingle()

    if (pago?.estado === "pagado") {
      return true
    }
  }

  return false
}

type AuthResult =
  | { actor: Actor; response?: never }
  | { actor?: never; response: NextResponse }

const rolePermissions: Record<GlobalRole, Permission[]> = {
  admin: [
    "admin.access",
    "pagos.review",
    "grabaciones.manage",
    "agenda.manage",
    "agenda.reserve",
    "casatalentos.view",
    "casatalentos.participate",
    "casatalentos.vote",
    "casatalentos.comment",
    "casatalentos.admin",
    "conectando.view",
    "conectando.admin",
    "mentorias.view",
    "mentorias.admin",
    "terapia.view",
    "terapia.admin",
  ],
  colaborador: [
    "agenda.manage",
    "agenda.reserve",
    "grabaciones.manage",
    "casatalentos.view",
    "casatalentos.comment",
    "conectando.view",
    "mentorias.view",
    "terapia.view",
  ],
  participante: [
    "agenda.reserve",
    "casatalentos.view",
    "casatalentos.participate",
    "casatalentos.vote",
    "casatalentos.comment",
    "conectando.view",
    "mentorias.view",
    "terapia.view",
  ],
}

const activityPermissionMap: Record<
  ActivitySlug,
  {
    viewPermission: Permission
    adminPermission?: Permission
  }
> = {
  casatalentos: {
    viewPermission: "casatalentos.view",
    adminPermission: "casatalentos.admin",
  },
  "conectando-sentidos": {
    viewPermission: "conectando.view",
    adminPermission: "conectando.admin",
  },
  mentorias: {
    viewPermission: "mentorias.view",
    adminPermission: "mentorias.admin",
  },
  terapia: {
    viewPermission: "terapia.view",
    adminPermission: "terapia.admin",
  },
  membresia: {
    viewPermission: "admin.access",
  },
}

function normalizarRole(role?: string | null): GlobalRole {
  if (role === "admin" || role === "colaborador") {
    return role
  }

  return "participante"
}

export async function getCurrentActor(): Promise<Actor | null> {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.trim().toLowerCase()

  if (!session || !email) {
    return null
  }

  return {
    session,
    role: normalizarRole(session.user.role),
    email,
    name: session.user.name?.trim() || "Usuario",
  }
}

export async function requireAuthenticatedActor(): Promise<AuthResult> {
  const actor = await getCurrentActor()

  if (!actor) {
    return {
      response: NextResponse.json(
        { error: "Necesitás iniciar sesión." },
        { status: 401 }
      ),
    }
  }

  return { actor }
}

export function hasPermission(actor: PermissionActor, permission: Permission) {
  return rolePermissions[actor.role].includes(permission)
}

export function hasAnyPermission(actor: PermissionActor, permissions: Permission[]) {
  return permissions.some((permission) => hasPermission(actor, permission))
}

export function listPermissionsForRole(role: GlobalRole) {
  return [...rolePermissions[role]]
}

export function getActivityViewPermission(
  actividadSlug: ActivitySlug
): Permission {
  return activityPermissionMap[actividadSlug].viewPermission
}

export function getActivityAdminPermission(
  actividadSlug: ActivitySlug
): Permission | undefined {
  return activityPermissionMap[actividadSlug].adminPermission
}

export async function requirePermission(
  permission: Permission
): Promise<AuthResult> {
  const auth = await requireAuthenticatedActor()

  if ("response" in auth) {
    return auth
  }

  if (!hasPermission(auth.actor, permission)) {
    return {
      response: NextResponse.json(
        { error: "No tenés permisos para realizar esta acción." },
        { status: 403 }
      ),
    }
  }

  return auth
}

export async function resolveActivityAccess(
  actividadSlug: ActivitySlug,
  participanteEmail: string
): Promise<ActivityAccessResult> {
  const email = participanteEmail.trim().toLowerCase()

  if (!email) {
    return {
      acceso: false,
      motivo: "sin_email",
      recursos: [],
    }
  }

  const supabase = createAdminSupabaseClient()

  const actividadAsegurada =
    actividadSlug === "membresia"
      ? null
      : await asegurarActividadBase(
          actividadSlug as Exclude<ActivitySlug, "membresia">
        )

  const { data: actividad, error: actividadError } = await supabase
    .from("actividades")
    .select("*")
    .eq("slug", actividadAsegurada?.slug || actividadSlug)
    .maybeSingle()

  if (actividadError) {
    throw new Error("Actividad no encontrada")
  }

  if (!actividad) {
    throw new Error("Actividad no encontrada")
  }

  if (await tieneAccesoExtraDesdeEspacios(actividadSlug, email)) {
    const recursos = await cargarRecursosActividad(supabase, actividad.id, email)

    return {
      acceso: true,
      motivo: "acceso_extra",
      actividad,
      recursos,
    }
  }

  const { data: inscripcion } = await supabase
    .from("inscripciones")
    .select("*")
    .eq("actividad_id", actividad.id)
    .eq("participante_email", email)
    .eq("estado", "activa")
    .maybeSingle()

  if (!inscripcion) {
    return {
      acceso: false,
      motivo: "sin_inscripcion",
      actividad,
      recursos: [],
    }
  }

  const { data: honorario } = await supabase
    .from("honorarios_participante")
    .select("modalidad_pago")
    .eq("actividad_id", actividad.id)
    .eq("participante_email", email)
    .eq("activo", true)
    .maybeSingle()

  const modalidadPago = normalizarModalidadPago(
    honorario?.modalidad_pago,
    actividadSlug
  )

  const ahora = new Date()
  let pago = null

  if (modalidadPago === "proceso" || modalidadPago === "sesion") {
    const resultado = await supabase
      .from("pagos_mensuales")
      .select("*")
      .eq("inscripcion_id", inscripcion.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    pago = resultado.data
  } else {
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

  if (!pago || pago.estado !== "pagado") {
    if (actividadSlug === "mentorias") {
      const recursos = await cargarRecursosActividad(supabase, actividad.id, email)

      return {
        acceso: true,
        motivo: pago?.estado || "sin_pago",
        actividad,
        recursos,
      }
    }

    if (actividadSlug === "terapia") {
      return {
        acceso: false,
        motivo: pago?.estado || "sin_pago",
        actividad,
        recursos: [],
      }
    }

    if (estaDentroDeGraciaMensual(actividadSlug, ahora)) {
      const recursos = await cargarRecursosActividad(supabase, actividad.id, email)

      return {
        acceso: true,
        motivo: "gracia_pago",
        actividad,
        recursos,
      }
    }

    return {
      acceso: false,
      motivo: pago?.estado || "sin_pago",
      actividad,
      recursos: [],
    }
  }

  const recursos = await cargarRecursosActividad(supabase, actividad.id, email)

  return {
    acceso: true,
    motivo: null,
    actividad,
    recursos,
  }
}

export async function requireActivityAccess(
  actividadSlug: ActivitySlug,
  adminPermission?: Permission
): Promise<
  | { actor: Actor; access: ActivityAccessResult; response?: never }
  | { actor?: never; access?: never; response: NextResponse }
> {
  const auth = await requireAuthenticatedActor()

  if ("response" in auth) {
    return { response: auth.response as NextResponse }
  }

  if (adminPermission && hasPermission(auth.actor, adminPermission)) {
    return {
      actor: auth.actor,
      access: {
        acceso: true,
        motivo: "permiso_admin",
        recursos: [],
      },
    }
  }

  const access = await resolveActivityAccess(actividadSlug, auth.actor.email)

  if (!access.acceso) {
    return {
      response: NextResponse.json(
        {
          error: "No tenés acceso activo a esta actividad.",
          motivo: access.motivo,
        },
        { status: 403 }
      ),
    }
  }

  return {
    actor: auth.actor,
    access,
  }
}
