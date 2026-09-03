// Frase sacada del párrafo y destacada — mismo texto, nunca reescrito.
// color="verde" solo se usa en el eje 3 (semilla y primeros brotes).
export default function PullQuote({
  children,
  color = "naranja",
}: {
  children: React.ReactNode
  color?: "naranja" | "verde"
}) {
  return (
    <p
      className={`[font-family:var(--font-titulo)] my-6 text-2xl font-bold leading-snug sm:text-3xl ${
        color === "verde" ? "text-[var(--verde-brote)]" : "text-[var(--naranja)]"
      }`}
    >
      {children}
    </p>
  )
}
