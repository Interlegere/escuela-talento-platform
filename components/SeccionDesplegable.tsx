"use client"

import { usePersistentState } from "@/hooks/usePersistentState"

export default function SeccionDesplegable({
  titulo,
  children,
  abiertaPorDefecto = false,
  storageKey,
  mantenerMontado = false,
}: {
  titulo: React.ReactNode
  children: React.ReactNode
  abiertaPorDefecto?: boolean
  storageKey?: string
  mantenerMontado?: boolean
}) {
  const [abierta, setAbierta] = usePersistentState(
    storageKey || "entheos:v1:ui:seccion:sin-persistencia",
    abiertaPorDefecto,
    { enabled: Boolean(storageKey) }
  )

  return (
    <section className="workspace-panel overflow-hidden text-gray-900">
      <button
        type="button"
        onClick={() => setAbierta((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 rounded-[1.2rem] bg-transparent px-1 py-1 text-left text-gray-900 transition hover:bg-[rgba(255,247,235,0.65)]"
        aria-expanded={abierta}
      >
        <div className="flex items-center gap-4">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
              abierta
                ? "border-[var(--line-strong)] bg-[rgba(203,138,36,0.12)] text-[var(--accent-strong)]"
                : "border-[var(--line)] bg-[rgba(255,251,244,0.88)] text-[var(--sea)]"
            }`}
          >
            {abierta ? "−" : "+"}
          </span>
          <div className="text-lg font-semibold text-gray-900">{titulo}</div>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--line)] bg-[rgba(255,251,244,0.92)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          {abierta ? "Ocultar" : "Abrir"}
        </span>
      </button>

      {(abierta || mantenerMontado) && (
        <div className="mt-4 border-t border-[var(--line)] pt-4 text-gray-900">
          <div hidden={!abierta}>{children}</div>
        </div>
      )}
    </section>
  )
}
