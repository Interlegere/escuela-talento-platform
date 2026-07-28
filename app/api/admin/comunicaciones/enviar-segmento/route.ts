import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import {
  ejecutarEnvioMasivo,
  type FiltroPagoPendiente,
  listarDestinatariosSegmento,
  type DestinatarioComunicacion,
  type SegmentoComunicacion,
} from "@/lib/comunicaciones"

type Body = {
  asunto?: string
  html?: string
  texto?: string
  tipo?: string
  actividadSlug?: string | null
  segmento?: SegmentoComunicacion
  pruebaEmail?: string | null
  emailsManual?: string | null
  destinatariosSeleccionados?: Array<{ email?: string | null; fuente?: string | null }>
  destinatariosFiltrados?: Array<{ email?: string | null }>
  filtroPagoPendiente?: FiltroPagoPendiente | null
}

function normalizarEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase()
}

function tipoValido(tipo?: string | null) {
  const value = String(tipo || "").trim()
  return ["general", "actividad", "pago", "aviso", "newsletter", "prueba"].includes(
    value
  )
    ? value
    : "general"
}

function destinatarioPrueba(email: string): DestinatarioComunicacion {
  return {
    email,
    nombre: "Prueba",
    apellido: "",
    nombreCompleto: "Prueba",
    role: "admin",
    actividadSlug: null,
    fuente: "manual",
    activo: true,
    contactoId: null,
    usuarioId: null,
    razon: "Envío de prueba",
  }
}

function segmentoIncluyeContactosExternos(segmento?: SegmentoComunicacion | null) {
  return (
    segmento === "contactos_externos_activos" ||
    segmento === "contactos_externos_todos" ||
    segmento === "usuarios_y_contactos_activos" ||
    segmento === "lista_manual"
  )
}

function normalizarListaEmails(items?: Array<{ email?: string | null }> | null) {
  return new Set(
    (items || [])
      .map((item) => normalizarEmail(item.email))
      .filter(Boolean)
  )
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const body = (await req.json()) as Body
    const asunto = String(body.asunto || "").trim()
    const texto = String(body.texto || "").trim()
    const html = body.html ? String(body.html) : null
    const pruebaEmail = normalizarEmail(body.pruebaEmail)
    const esPrueba = Boolean(pruebaEmail)

    if (!asunto) {
      return NextResponse.json({ error: "Falta asunto." }, { status: 400 })
    }

    if (!texto && !html) {
      return NextResponse.json({ error: "Falta contenido." }, { status: 400 })
    }

    let destinatarios: DestinatarioComunicacion[] = []
    let segmento: SegmentoComunicacion | null = body.segmento || null

    if (esPrueba) {
      destinatarios = [destinatarioPrueba(pruebaEmail)]
      segmento = null
    } else {
      if (!segmento) {
        return NextResponse.json(
          { error: "Falta seleccionar un segmento." },
          { status: 400 }
        )
      }

      const tipoEnvio = tipoValido(body.tipo)
      if (tipoEnvio === "pago" && segmentoIncluyeContactosExternos(segmento)) {
        return NextResponse.json(
          {
            error:
              "Los contactos externos no deben usarse para comunicaciones transaccionales de pago.",
          },
          { status: 400 }
        )
      }

      const resultado = await listarDestinatariosSegmento({
        segmento,
        emailsManual: body.emailsManual || "",
        destinatariosSeleccionados: body.destinatariosSeleccionados || [],
        filtroPagoPendiente: body.filtroPagoPendiente || "todos",
      })
      if (resultado.deshabilitado) {
        return NextResponse.json(
          { error: resultado.motivo || "Segmento no disponible." },
          { status: 400 }
        )
      }

      destinatarios = resultado.destinatarios

      const emailsFiltrados = normalizarListaEmails(body.destinatariosFiltrados)
      if (emailsFiltrados.size > 0) {
        destinatarios = destinatarios.filter((item) =>
          emailsFiltrados.has(normalizarEmail(item.email))
        )
      }

      if (
        tipoEnvio === "pago" &&
        segmento === "destinatarios_especificos" &&
        destinatarios.some((item) => item.fuente !== "usuario_plataforma")
      ) {
        return NextResponse.json(
          {
            error:
              "Los contactos externos o emails manuales no deben usarse para comunicaciones transaccionales de pago.",
          },
          { status: 400 }
        )
      }
    }

    if (destinatarios.length === 0) {
      return NextResponse.json(
        { error: "No hay destinatarios para enviar." },
        { status: 400 }
      )
    }

    const resumen = await ejecutarEnvioMasivo({
      destinatarios,
      asunto,
      texto,
      html,
      tipo: tipoValido(body.tipo),
      actividadSlug: body.actividadSlug || null,
      segmento,
      enviadoPor: auth.actor.email,
      esPrueba,
    })

    return NextResponse.json({
      ok: resumen.errores === 0,
      resumen,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo enviar la comunicación.",
      },
      { status: 500 }
    )
  }
}
