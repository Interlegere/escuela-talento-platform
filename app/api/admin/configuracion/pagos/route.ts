import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import {
  obtenerRecargoMercadoPagoPorcentajeConfigurado,
  obtenerHonorariosBaseEscuelaConfigurados,
} from "@/lib/payment-pricing"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  mercadoPagoRecargoPorcentaje?: string | number
  casatalentosHonorarioBase?: string | number
  conectandoSentidosHonorarioBase?: string | number
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

    const [porcentaje, honorariosBase] = await Promise.all([
      obtenerRecargoMercadoPagoPorcentajeConfigurado(),
      obtenerHonorariosBaseEscuelaConfigurados(),
    ])

    return NextResponse.json({
      ok: true,
      mercadoPagoRecargoPorcentaje: porcentaje,
      casatalentosHonorarioBase: honorariosBase.casatalentos,
      conectandoSentidosHonorarioBase: honorariosBase.conectandoSentidos,
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
    const [porcentajeActual, honorariosBaseActuales] = await Promise.all([
      obtenerRecargoMercadoPagoPorcentajeConfigurado(),
      obtenerHonorariosBaseEscuelaConfigurados(),
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
        { error: "Ingresá un honorario base válido para CasaTalentos." },
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
