import { TOKEN_MARCADOR_DORADO } from "@/app/proyecto-inposible/tokens"

// Frase sacada del párrafo y destacada — mismo texto, nunca reescrito.
// Los tres destacados de los tres ejes van siempre en tinta con un marcador
// dorado detrás (nunca dorado como color de letra), para que se lean como
// una serie (el verde brote quedó reservado solo para las tildes de "Es
// para vos si"). El marcador va en un <span> que envuelve solo el texto,
// no en el <p>, para que box-decoration-break: clone resalte cada línea
// por separado si la frase se corta en dos.
export default function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <p className="[font-family:var(--font-titulo)] my-6 text-[30px] font-bold leading-[1.75] text-[var(--tinta)]">
      <span style={TOKEN_MARCADOR_DORADO}>{children}</span>
    </p>
  )
}
