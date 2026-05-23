import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import {
  enviarComunicacionIndividual,
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
      })
      if (resultado.deshabilitado) {
        return NextResponse.json(
          { error: resultado.motivo || "Segmento no disponible." },
          { status: 400 }
        )
      }

      destinatarios = resultado.destinatarios
    }

    if (destinatarios.length === 0) {
      return NextResponse.json(
        { error: "No hay destinatarios para enviar." },
        { status: 400 }
      )
    }

    const resumen = {
      enviados: 0,
      errores: 0,
      omitidos: 0,
      total: destinatarios.length,
      detalles: [] as Array<{
        email: string
        estado: "enviado" | "error" | "omitido"
        error?: string | null
      }>,
    }

    for (const destinatario of destinatarios) {
      try {
        const envio = await enviarComunicacionIndividual({
          destinatarioEmail: destinatario.email,
          destinatarioNombre: destinatario.nombreCompleto,
          asunto,
          html,
          texto,
          tipo: esPrueba ? "prueba" : tipoValido(body.tipo),
          actividadSlug:
            body.actividadSlug || destinatario.actividadSlug || null,
          variables: {
            nombre: destinatario.nombre,
            apellido: destinatario.apellido,
            nombre_completo: destinatario.nombreCompleto,
            email: destinatario.email,
            actividad: body.actividadSlug || destinatario.actividadSlug || "",
          },
          metadata: {
            origen: esPrueba
              ? "admin_comunicaciones_prueba"
              : "admin_comunicaciones_segmento",
            segmento,
            razon: destinatario.razon,
            fuente: destinatario.fuente,
            contactoId: destinatario.contactoId,
            usuarioId: destinatario.usuarioId,
            enviadoPor: auth.actor.email,
          },
        })

        if (envio.resultado.enviado) {
          resumen.enviados += 1
          resumen.detalles.push({
            email: destinatario.email,
            estado: "enviado",
          })
        } else {
          resumen.errores += 1
          resumen.detalles.push({
            email: destinatario.email,
            estado: "error",
            error: envio.resultado.motivo,
          })
        }
      } catch (error) {
        resumen.errores += 1
        resumen.detalles.push({
          email: destinatario.email,
          estado: "error",
          error:
            error instanceof Error
              ? error.message
              : "No se pudo enviar la comunicación.",
        })
      }
    }

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
