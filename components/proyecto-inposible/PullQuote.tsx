// Frase sacada del párrafo y destacada — mismo texto, nunca reescrito.
export default function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display my-8 text-2xl font-semibold leading-snug text-[var(--naranja)] sm:text-3xl">
      {children}
    </p>
  )
}
