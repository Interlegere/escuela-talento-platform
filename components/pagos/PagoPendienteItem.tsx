"use client"

import PagoMensualCard from "@/components/pagos/PagoMensualCard"
import PagoReservaTerapiaCard from "@/components/pagos/PagoReservaTerapiaCard"
import type { BillingMode } from "@/lib/billing"
import type { PagoUiItem } from "@/lib/payment-ui"

type Props = {
  item: PagoUiItem
  retornoMercadoPago?: {
    status: "success" | "failure" | "pending"
    pagoMensualId?: number | null
    reservaId?: number | null
  } | null
  onActualizado?: () => Promise<void> | void
}

function estadoLabel(estado: PagoUiItem["estado"]) {
  switch (estado) {
    case "pendiente_pago":
      return "Pendiente"
    case "en_revision":
      return "En revisión"
    case "rechazado":
      return "Requiere acción"
    case "pagado":
      return "Resuelto"
    case "bonificado":
      return "Bonificado"
    case "sin_cargo":
      return "Sin cargo"
  }
}

function estadoBadgeClass(estado: PagoUiItem["estado"]) {
  switch (estado) {
    case "pendiente_pago":
      return "border-amber-200 bg-amber-50 text-amber-900"
    case "en_revision":
      return "border-sky-200 bg-sky-50 text-sky-900"
    case "rechazado":
      return "border-red-200 bg-red-50 text-red-700"
    case "pagado":
      return "border-emerald-200 bg-emerald-50 text-emerald-800"
    case "bonificado":
    case "sin_cargo":
      return "border-[var(--line)] bg-white/80 text-gray-700"
  }
}

function formatoMonto(item: PagoUiItem) {
  if (item.monto == null) return "Monto a confirmar"
  return `${item.moneda || "ARS"} ${item.monto}`
}

export default function PagoPendienteItem({
  item,
  retornoMercadoPago = null,
  onActualizado,
}: Props) {
  const mostrarAcciones =
    item.estado === "pendiente_pago" || item.estado === "rechazado"

  return (
    <article className="workspace-panel space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="workspace-eyebrow">{item.actividadNombre}</span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${estadoBadgeClass(
                item.estado
              )}`}
            >
              {estadoLabel(item.estado)}
            </span>
          </div>
          <div>
            <h3 className="workspace-title-sm">{item.titulo}</h3>
            <p className="workspace-inline-note mt-2">{item.descripcion}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,250,242,0.75)] px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Monto
          </p>
          <p className="text-lg font-semibold text-[var(--ink)]">
            {formatoMonto(item)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 text-sm text-gray-700 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Actividad
          </p>
          <p className="mt-1">{item.actividadNombre}</p>
        </div>
        {(item.fechaRelevante || item.vencimiento) && (
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              {item.fechaRelevante ? "Fecha" : "Período"}
            </p>
            <p className="mt-1">{item.fechaRelevante || item.vencimiento}</p>
          </div>
        )}
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Próximo paso
          </p>
          <p className="mt-1">{item.proximoPaso}</p>
        </div>
      </div>

      {item.estado === "en_revision" && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Recibimos tu comprobante. Estamos verificándolo y te avisaremos cuando se habilite.
        </div>
      )}

      {mostrarAcciones && item.origen === "sesion" && item.reservaId ? (
        <PagoReservaTerapiaCard
          reservaId={item.reservaId}
          montoTransferencia={item.montoTransferencia}
          montoMercadoPago={item.montoMercadoPago}
          porcentajeRecargoMercadoPago={item.porcentajeRecargoMercadoPago}
          comprobanteNombreArchivo={item.comprobanteNombreArchivo}
          variant="inline"
          onActualizado={onActualizado}
        />
      ) : null}

      {mostrarAcciones &&
      item.origen !== "sesion" &&
      item.participanteNombre &&
      item.participanteEmail ? (
        <PagoMensualCard
          actividadSlug={item.actividadSlug}
          participanteNombre={item.participanteNombre}
          participanteEmail={item.participanteEmail}
          modalidadPago={(item.modalidadPago || "mensual") as BillingMode}
          retornoMercadoPago={retornoMercadoPago}
          variant="inline"
        />
      ) : null}
    </article>
  )
}
