import Link from "next/link"

// Pie mínimo, compartido por la landing y por /gracias — la única mención
// de identidad/ubicación legal de toda la página, en tinta al 60%. Lleva la
// identificación del prestador (Ley 24.240, art. 4) y los links exigidos
// por la Disposición 954/2025 (arrepentimiento y baja de servicio).
export default function PieDePagina() {
  return (
    <footer className="px-4 py-8 text-center text-xs leading-relaxed text-[var(--tinta)]/60 sm:px-6">
      <p>ENTHEOS · Escuela Norte para el Talento, el Entusiasmo y el Orden de los Sentidos</p>
      <p>Lic. Nicolás Busico · Mat. 10618 · CUIT 20-35967909-3 · Córdoba, Argentina</p>
      <p>nicolasbusico@entheosescuela.com</p>
      <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <Link href="/terminos-y-condiciones" className="underline underline-offset-2">
          Términos y Condiciones
        </Link>
        <span aria-hidden>·</span>
        <Link href="/arrepentimiento" className="underline underline-offset-2">
          Botón de Arrepentimiento
        </Link>
        <span aria-hidden>·</span>
        <Link href="/baja" className="underline underline-offset-2">
          Baja de servicio
        </Link>
      </p>
    </footer>
  )
}
