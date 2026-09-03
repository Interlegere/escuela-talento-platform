// Frase sacada del párrafo y destacada — mismo texto, nunca reescrito.
// Los tres destacados de los tres ejes van siempre en naranja, para que se
// lean como una serie (el verde brote quedó reservado solo para las tildes
// de "Es para vos si").
export default function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <p className="[font-family:var(--font-titulo)] my-6 text-[30px] font-bold leading-snug text-[var(--naranja)]">
      {children}
    </p>
  )
}
