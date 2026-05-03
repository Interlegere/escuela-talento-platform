import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import {
  obtenerRecargoMercadoPagoPorcentajeConfigurado,
} from "@/lib/payment-pricing"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  mercadoPagoRecargoPorcentaje?: string | number
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

    const porcentaje = await obtenerRecargoMercadoPagoPorcentajeConfigurado()

    return NextResponse.json({
      ok: true,
      mercadoPagoRecargoPorcentaje: porcentaje,
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
    const porcentaje = normalizarNumero(body.mercadoPagoRecargoPorcentaje)

    if (!Number.isFinite(porcentaje) || porcentaje < 0) {
      return NextResponse.json(
        { error: "Ingresá un porcentaje válido mayor o igual a 0." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from("configuracion_plataforma")
      .upsert(
        {
          clave: "mercado_pago_recargo_porcentaje",
          valor_texto: String(porcentaje),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "clave",
        }
      )
      .select("clave, valor_texto")
      .single()

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
      configuracion: data,
      mercadoPagoRecargoPorcentaje: porcentaje,
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
