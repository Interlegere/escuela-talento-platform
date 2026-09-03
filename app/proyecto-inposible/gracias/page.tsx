import type { Metadata } from "next"
import GraciasContenido from "@/components/proyecto-inposible/GraciasContenido"

// Página posterior al envío: nunca debe indexarse ni aparecer en buscadores
// (a diferencia de /proyecto-inposible, que sí es pública e indexable).
export const metadata: Metadata = {
  title: "¡Gracias! — Proyecto In+Posible",
  robots: { index: false, follow: false },
}

export default function GraciasPage() {
  return <GraciasContenido />
}
