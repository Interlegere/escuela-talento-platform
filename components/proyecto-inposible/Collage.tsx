import Image from "next/image"

// Cierra "El todos mejora gracias al cada uno" — a ancho completo, sin
// márgenes ni borde, alto acotado para que en desktop no ocupe una
// pantalla entera.
export default function Collage() {
  return (
    <div className="relative h-[320px] w-full sm:h-[420px] lg:h-[520px]">
      <Image
        src="/talentos-collage.jpg"
        alt="Collage de talentos en el deporte, el arte, los emprendimientos, empresas y naturaleza que pasaron por ENTHEOS"
        fill
        sizes="100vw"
        priority={false}
        className="object-cover"
      />
    </div>
  )
}
