import { NextResponse } from "next/server"
import { requirePermission, type ActivitySlug } from "@/lib/authz"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { normalizarModalidadPago } from "@/lib/billing"

type Body = {
  actividadSlug: ActivitySlug
  participanteEmail: string
  participanteNombre?: string
  honorarioMensual: string | number
  modalidadPago?: string
  moneda?: string
  activo?: boolean
}

type ActividadRow = {
  id: number
  slug: string
  nombre?: string | null
}

type HonorarioRow = {
  id: number
  actividad_id: number
  participante_email: string
  participante_nombre?: string | null
  honorario_mensual: string | number
  modalidad_pago?: string | null
  moneda?: string | null
  activo?: boolean | null
  updated_at?: string | null
}

type InscripcionRow = {
  id: number
  actividad_id: number
  participante_email?: string | null
  estado?: string | null
}

type PagoRow = {
  id: number
  inscripcion_id: number | null
  estado?: string | null
  monto?: string | number | null
  moneda?: string | null
  anio?: number | null
  mes?: number | null
  created_at?: string | null
}

type UsuarioPlataformaRow = {
  nombre?: string | null
  apellido?: string | null
  email?: string | null
  activo?: boolean | null
}

function normalizarMonto(input: string | number) {
  const raw = String(input ?? "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "")

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : NaN
}

export async function GET() {
  try {
    const auth = await requirePermission("pagos.review")

    if ("response" in auth) {
      return auth.response
    }

    const supabase = createAdminSupabaseClient()

    const [{ data: actividades, error: actividadesError }, { data: honorarios, error: honorariosError }] =
      await Promise.all([
        supabase
          .from("actividades")
          .select("id, slug, nombre")
          .in("slug", ["casatalentos", "conectando-sentidos", "mentorias", "terapia"])
          .order("nombre", { ascending: true }),
        supabase
          .from("honorarios_participante")
          .select("*")
          .order("updated_at", { ascending: false }),
      ])

    if (actividadesError) {
      return NextResponse.json(
        { error: "No se pudieron cargar las actividades", detalle: actividadesError },
        { status: 500 }
      )
    }

    if (honorariosError) {
      return NextResponse.json(
        { error: "No se pudieron cargar los honorarios", detalle: honorariosError },
        { status: 500 }
      )
    }

    const honorariosRows = ((honorarios as HonorarioRow[] | null) || [])
    const actividadesPorId = new Map(
      (((actividades as ActividadRow[] | null) || [])).map((item) => [
        item.id,
        { slug: item.slug, nombre: item.nombre || item.slug },
      ])
    )

    const actividadIds = Array.from(
      new Set(honorariosRows.map((item) => item.actividad_id).filter(Boolean))
    )
    const emails = Array.from(
      new Set(
        honorariosRows
          .map((item) => String(item.participante_email || "").trim().toLowerCase())
          .filter(Boolean)
      )
    )

    const [{ data: inscripciones, error: inscripcionesError }, { data: pagos, error: pagosError }] =
      await Promise.all([
        actividadIds.length > 0 && emails.length > 0
          ? supabase
              .from("inscripciones")
              .select("id, actividad_id, participante_email, estado")
              .in("actividad_id", actividadIds)
              .in("participante_email", emails)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("pagos_mensuales")
          .select("id, inscripcion_id, estado, monto, moneda, anio, mes, created_at")
          .order("created_at", { ascending: false }),
      ])

    if (inscripcionesError) {
      return NextResponse.json(
        { error: "No se pudieron cargar las inscripciones de honorarios", detalle: inscripcionesError },
        { status: 500 }
      )
    }

    if (pagosError) {
      return NextResponse.json(
        { error: "No se pudieron cargar los cobros vinculados", detalle: pagosError },
        { status: 500 }
      )
    }

    const inscripcionPorClave = new Map<string, InscripcionRow>()

    for (const item of ((inscripciones as InscripcionRow[] | null) || [])) {
      const clave = `${item.actividad_id}:${String(item.participante_email || "")
        .trim()
        .toLowerCase()}`

      if (!inscripcionPorClave.has(clave) || item.estado === "activa") {
        inscripcionPorClave.set(clave, item)
      }
    }

    const ultimoPagoPorInscripcion = new Map<number, PagoRow>()

    for (const item of ((pagos as PagoRow[] | null) || [])) {
      if (!item.inscripcion_id || ultimoPagoPorInscripcion.has(item.inscripcion_id)) {
        continue
      }

      ultimoPagoPorInscripcion.set(item.inscripcion_id, item)
    }

    return NextResponse.json({
      ok: true,
      actividades: (actividades || []).map((item: ActividadRow) => ({
        id: item.id,
        slug: item.slug,
        nombre: item.nombre || item.slug,
      })),
      honorarios: honorariosRows.map((item) => {
        const actividadSlug = actividadesPorId.get(item.actividad_id)?.slug || ""
        const claveInscripcion = `${item.actividad_id}:${String(item.participante_email || "")
          .trim()
          .toLowerCase()}`
        const inscripcion = inscripcionPorClave.get(claveInscripcion)
        const ultimoPago = inscripcion?.id
          ? ultimoPagoPorInscripcion.get(inscripcion.id)
          : null

        return {
          id: item.id,
          actividad_id: item.actividad_id,
          actividad_slug: actividadSlug,
          actividad_nombre: actividadesPorId.get(item.actividad_id)?.nombre || "",
          participante_email: item.participante_email || "",
          participante_nombre: item.participante_nombre || "",
          honorario_mensual: item.honorario_mensual,
          modalidad_pago: normalizarModalidadPago(
            item.modalidad_pago,
            actividadSlug
          ),
          moneda: item.moneda || "ARS",
          activo: item.activo !== false,
          updated_at: item.updated_at,
          ultimo_pago: ultimoPago
            ? {
                id: ultimoPago.id,
                estado: ultimoPago.estado || "",
                monto: ultimoPago.monto || "",
                moneda: ultimoPago.moneda || item.moneda || "ARS",
                anio: ultimoPago.anio,
                mes: ultimoPago.mes,
                created_at: ultimoPago.created_at,
              }
            : null,
        }
      }),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno cargando honorarios",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("pagos.review")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const actividadSlug = body.actividadSlug
    const participanteEmail = String(body.participanteEmail || "").trim().toLowerCase()
    const participanteNombre = String(body.participanteNombre || "").trim()
    const honorarioMensual = normalizarMonto(body.honorarioMensual)
    const modalidadPago = normalizarModalidadPago(body.modalidadPago, actividadSlug)
    const moneda = String(body.moneda || "ARS").trim().toUpperCase() || "ARS"
    const activo = body.activo !== false

    if (!actividadSlug) {
      return NextResponse.json(
        { error: "Seleccioná primero la actividad para asignar el honorario." },
        { status: 400 }
      )
    }

    if (!participanteEmail) {
      return NextResponse.json(
        { error: "Ingresá el email del participante." },
        { status: 400 }
      )
    }

    if (Number.isNaN(honorarioMensual) || honorarioMensual <= 0) {
      return NextResponse.json(
        {
          error:
            "Ingresá un honorario válido mayor a 0. Escribí sólo el número y elegí la moneda aparte.",
        },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: usuario, error: usuarioError } = await supabase
      .from("usuarios_plataforma")
      .select("nombre, apellido, email, activo")
      .eq("email", participanteEmail)
      .maybeSingle()

    if (usuarioError) {
      return NextResponse.json(
        {
          error:
            "No se pudo validar el usuario. Verificá que exista la tabla usuarios_plataforma.",
          detalle: usuarioError,
        },
        { status: 500 }
      )
    }

    if (!usuario) {
      return NextResponse.json(
        {
          error:
            "Ese participante no existe en Admin Usuarios. Primero creá el usuario y luego asignale la actividad.",
        },
        { status: 400 }
      )
    }

    const usuarioRow = usuario as UsuarioPlataformaRow

    if (usuarioRow.activo === false) {
      return NextResponse.json(
        {
          error:
            "Ese usuario está inactivo. Reactivalo desde Admin Usuarios antes de asignarle una actividad.",
        },
        { status: 400 }
      )
    }

    const nombreDesdeUsuario = [usuarioRow.nombre, usuarioRow.apellido]
      .filter(Boolean)
      .join(" ")

    const { data: actividad, error: actividadError } = await supabase
      .from("actividades")
      .select("id, slug, nombre")
      .eq("slug", actividadSlug)
      .single()

    if (actividadError || !actividad) {
      return NextResponse.json(
        { error: "No se encontró la actividad.", detalle: actividadError },
        { status: 404 }
      )
    }

    const payload = {
      actividad_id: actividad.id,
      participante_email: participanteEmail,
      participante_nombre: nombreDesdeUsuario || participanteNombre || null,
      honorario_mensual: honorarioMensual,
      modalidad_pago: modalidadPago,
      moneda,
      activo,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("honorarios_participante")
      .upsert(payload, {
        onConflict: "actividad_id,participante_email",
      })
      .select("*")
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: "No se pudo guardar el honorario.", detalle: error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      honorario: {
        id: data.id,
        actividad_slug: actividad.slug,
        actividad_nombre: actividad.nombre || actividad.slug,
        participante_email: data.participante_email,
        participante_nombre: data.participante_nombre || "",
        honorario_mensual: data.honorario_mensual,
        modalidad_pago: normalizarModalidadPago(data.modalidad_pago, actividad.slug),
        moneda: data.moneda,
        activo: data.activo !== false,
        updated_at: data.updated_at,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno guardando honorario",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
