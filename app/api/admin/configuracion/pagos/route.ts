import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import {
  obtenerRecargoMercadoPagoPorcentajeConfigurado,
  obtenerHonorariosBaseEscuelaConfigurados,
  obtenerDiasGraciaConfigurados,
} from "@/lib/payment-pricing"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  mercadoPagoRecargoPorcentaje?: string | number
  casatalentosHonorarioBase?: string | number
  conectandoSentidosHonorarioBase?: string | number
  terapiaHonorarioBase?: string | number
  comboCtCsHonorarioBase?: string | number
  comboTerapiaSesionPrecio?: string | number
  casatalentosGraciaDias?: string | number
  conectandoSentidosGraciaDias?: string | number
  membresiaGraciaDias?: string | number
}

function normalizarNumero(input: string | number | null | undefined) {
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

    const [porcentaje, honorariosBase, diasGracia] = await Promise.all([
      obtenerRecargoMercadoPagoPorcentajeConfigurado(),
      obtenerHonorariosBaseEscuelaConfigurados(),
      obtenerDiasGraciaConfigurados(),
    ])

    return NextResponse.json({
      ok: true,
      mercadoPagoRecargoPorcentaje: porcentaje,
      casatalentosHonorarioBase: honorariosBase.casatalentos,
      conectandoSentidosHonorarioBase: honorariosBase.conectandoSentidos,
      terapiaHonorarioBase: honorariosBase.terapia,
      comboCtCsHonorarioBase: honorariosBase.comboCtCs,
      comboTerapiaSesionPrecio: honorariosBase.comboTerapiaSesion,
      casatalentosGraciaDias: diasGracia.casatalentos,
      conectandoSentidosGraciaDias: diasGracia.conectandoSentidos,
      membresiaGraciaDias: diasGracia.membresia,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar la configuración de pagos.",
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

    const body = (await req.json()) as Body
    const [porcentajeActual, honorariosBaseActuales, diasGraciaActuales] =
      await Promise.all([
        obtenerRecargoMercadoPagoPorcentajeConfigurado(),
        obtenerHonorariosBaseEscuelaConfigurados(),
        obtenerDiasGraciaConfigurados(),
      ])
    const porcentaje =
      body.mercadoPagoRecargoPorcentaje === undefined
        ? porcentajeActual
        : normalizarNumero(body.mercadoPagoRecargoPorcentaje)
    const casatalentosHonorarioBase =
      body.casatalentosHonorarioBase === undefined
        ? honorariosBaseActuales.casatalentos
        : normalizarNumero(body.casatalentosHonorarioBase)
    const conectandoSentidosHonorarioBase =
      body.conectandoSentidosHonorarioBase === undefined
        ? honorariosBaseActuales.conectandoSentidos
        : normalizarNumero(body.conectandoSentidosHonorarioBase)
    const terapiaHonorarioBase =
      body.terapiaHonorarioBase === undefined
        ? honorariosBaseActuales.terapia
        : normalizarNumero(body.terapiaHonorarioBase)
    const comboCtCsHonorarioBase =
      body.comboCtCsHonorarioBase === undefined
        ? honorariosBaseActuales.comboCtCs
        : normalizarNumero(body.comboCtCsHonorarioBase)
    const comboTerapiaSesionPrecio =
      body.comboTerapiaSesionPrecio === undefined
        ? honorariosBaseActuales.comboTerapiaSesion
        : normalizarNumero(body.comboTerapiaSesionPrecio)
    const casatalentosGraciaDias =
      body.casatalentosGraciaDias === undefined
        ? diasGraciaActuales.casatalentos
        : normalizarNumero(body.casatalentosGraciaDias)
    const conectandoSentidosGraciaDias =
      body.conectandoSentidosGraciaDias === undefined
        ? diasGraciaActuales.conectandoSentidos
        : normalizarNumero(body.conectandoSentidosGraciaDias)
    const membresiaGraciaDias =
      body.membresiaGraciaDias === undefined
        ? diasGraciaActuales.membresia
        : normalizarNumero(body.membresiaGraciaDias)

    if (!Number.isFinite(porcentaje) || porcentaje < 0) {
      return NextResponse.json(
        { error: "Ingresá un porcentaje válido mayor o igual a 0." },
        { status: 400 }
      )
    }

    if (
      !Number.isFinite(casatalentosHonorarioBase) ||
      casatalentosHonorarioBase < 0
    ) {
      return NextResponse.json(
        { error: "Ingresá un honorario base válido para Entusiasmento." },
        { status: 400 }
      )
    }

    if (
      !Number.isFinite(conectandoSentidosHonorarioBase) ||
      conectandoSentidosHonorarioBase < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Ingresá un honorario base válido para Conectando Sentidos.",
        },
        { status: 400 }
      )
    }

    if (!Number.isFinite(terapiaHonorarioBase) || terapiaHonorarioBase < 0) {
      return NextResponse.json(
        { error: "Ingresá un honorario base válido para Terapia." },
        { status: 400 }
      )
    }

    if (!Number.isFinite(comboCtCsHonorarioBase) || comboCtCsHonorarioBase < 0) {
      return NextResponse.json(
        {
          error:
            "Ingresá un honorario válido para Actividades combinadas (Entusiasmento + Conectando Sentidos).",
        },
        { status: 400 }
      )
    }

    if (
      !Number.isFinite(comboTerapiaSesionPrecio) ||
      comboTerapiaSesionPrecio < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Ingresá un precio válido para las sesiones de Terapia con descuento.",
        },
        { status: 400 }
      )
    }

    if (
      !Number.isFinite(casatalentosGraciaDias) ||
      casatalentosGraciaDias < 0 ||
      !Number.isFinite(conectandoSentidosGraciaDias) ||
      conectandoSentidosGraciaDias < 0 ||
      !Number.isFinite(membresiaGraciaDias) ||
      membresiaGraciaDias < 0
    ) {
      return NextResponse.json(
        {
          error: "Ingresá una cantidad de días de prórroga válida (0 o más) para cada actividad.",
        },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const { error } = await supabase
      .from("configuracion_plataforma")
      .upsert(
        [
          {
            clave: "mercado_pago_recargo_porcentaje",
            valor_texto: String(porcentaje),
            updated_at: new Date().toISOString(),
          },
          {
            clave: "casatalentos_honorario_base",
            valor_texto: String(casatalentosHonorarioBase),
            updated_at: new Date().toISOString(),
          },
          {
            clave: "conectando_sentidos_honorario_base",
            valor_texto: String(conectandoSentidosHonorarioBase),
            updated_at: new Date().toISOString(),
          },
          {
            clave: "terapia_honorario_base",
            valor_texto: String(terapiaHonorarioBase),
            updated_at: new Date().toISOString(),
          },
          {
            clave: "combo_ct_cs_honorario_base",
            valor_texto: String(comboCtCsHonorarioBase),
            updated_at: new Date().toISOString(),
          },
          {
            clave: "combo_terapia_sesion_precio",
            valor_texto: String(comboTerapiaSesionPrecio),
            updated_at: new Date().toISOString(),
          },
          {
            clave: "casatalentos_gracia_dias",
            valor_texto: String(casatalentosGraciaDias),
            updated_at: new Date().toISOString(),
          },
          {
            clave: "conectando_sentidos_gracia_dias",
            valor_texto: String(conectandoSentidosGraciaDias),
            updated_at: new Date().toISOString(),
          },
          {
            clave: "membresia_gracia_dias",
            valor_texto: String(membresiaGraciaDias),
            updated_at: new Date().toISOString(),
          },
        ],
        {
          onConflict: "clave",
        }
      )

    if (error) {
      return NextResponse.json(
        {
          error:
            "No se pudo guardar la configuración. Si todavía no existe la tabla, corré primero el SQL nuevo.",
          detalle: error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      mercadoPagoRecargoPorcentaje: porcentaje,
      casatalentosHonorarioBase,
      conectandoSentidosHonorarioBase,
      terapiaHonorarioBase,
      comboCtCsHonorarioBase,
      comboTerapiaSesionPrecio,
      casatalentosGraciaDias,
      conectandoSentidosGraciaDias,
      membresiaGraciaDias,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo guardar la configuración de pagos.",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
