"use client"

// Onboarding de un solo paso para quien entra por primera vez y todavía no
// escribió ninguna coordenada. El llamador decide cuándo mostrarlo (todas
// las coordenadas vacías) y cuándo dejar de hacerlo (apenas escribe la
// primera, desaparece para siempre) — este componente solo se encarga de
// mostrarse y de disparar el primer paso al tocar el botón.
export default function PrimerosPasos({ onEmpezar }: { onEmpezar: () => void }) {
  return (
    <div className="space-y-3 rounded-[1.5rem] border-2 border-[var(--accent)] bg-[rgba(207,145,48,0.08)] p-5">
      <h2 className="text-lg font-bold tracking-tight text-[var(--accent-strong)]">
        Bienvenido/a a tu espacio
      </h2>
      <p className="text-sm text-gray-700">
        Acá vas a ir armando tu proyecto, paso a paso. El primer paso son tus
        coordenadas: dónde estás parado y hacia dónde vas. No hace falta que
        estén completas ni perfectas — se ajustan sobre la marcha.
      </p>
      <button type="button" onClick={onEmpezar} className="workspace-button-primary">
        Empezar por mis coordenadas
      </button>
    </div>
  )
}
