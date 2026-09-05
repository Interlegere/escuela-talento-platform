import type { Metadata } from "next"
import { existsSync } from "node:fs"
import path from "node:path"
import GraciasContenido from "@/components/proyecto-inposible/GraciasContenido"

// Página posterior al envío: nunca debe indexarse ni aparecer en buscadores
// (a diferencia de /proyecto-inposible, que sí es pública e indexable).
export const metadata: Metadata = {
  title: "¡Gracias! — Proyecto In+Posible",
  robots: { index: false, follow: false },
}

// Mismo criterio que el hero: si el logo todavía no existe, no se deja un
// hueco ni un ícono roto — se resuelve acá (Server Component) porque
// GraciasContenido es "use client" y no puede usar fs.
const LOGO_EXISTE = existsSync(path.join(process.cwd(), "public", "logo-entheos.png"))

export default function GraciasPage() {
  return <GraciasContenido logoExiste={LOGO_EXISTE} />
}
