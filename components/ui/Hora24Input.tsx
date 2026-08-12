"use client"

const HORAS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"))
const MINUTOS = Array.from({ length: 60 }, (_, m) => String(m).padStart(2, "0"))

type Props = {
  value: string
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
}

export default function Hora24Input({ value, onChange, className, disabled }: Props) {
  const [horaActual, minutoActual] = value ? value.split(":") : ["", ""]

  const actualizar = (hora: string, minuto: string) => {
    if (!hora || !minuto) {
      onChange("")
      return
    }
    onChange(`${hora}:${minuto}`)
  }

  return (
    <div className={`flex items-center gap-1 ${className || ""}`}>
      <select
        aria-label="Hora"
        value={horaActual}
        disabled={disabled}
        onChange={(e) => actualizar(e.target.value, minutoActual || "00")}
        className="workspace-field w-auto"
      >
        <option value="">--</option>
        {HORAS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span aria-hidden>:</span>
      <select
        aria-label="Minuto"
        value={minutoActual}
        disabled={disabled}
        onChange={(e) => actualizar(horaActual || "00", e.target.value)}
        className="workspace-field w-auto"
      >
        <option value="">--</option>
        {MINUTOS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  )
}
