import {
  Archivo,
  Bricolage_Grotesque,
  Instrument_Sans,
  Public_Sans,
} from "next/font/google"

// ÚNICA constante para elegir la pareja tipográfica de toda la página.
// Cambiar acá — nada más — para pasar de la Opción A a la Opción B.
export const OPCION_TIPOGRAFIA: "A" | "B" = "A"

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--pip-font-titulo-a",
})

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--pip-font-cuerpo-a",
})

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--pip-font-titulo-b",
})

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--pip-font-cuerpo-b",
})

// Clases de next/font (cargan las 4 tipografías; la que no está activa en
// OPCION_TIPOGRAFIA simplemente no se referencia en el CSS, pero de todas
// formas queda disponible para cuando se quiera cambiar/comparar).
export const FUENTES_CLASSNAME = `${bricolage.variable} ${instrumentSans.variable} ${archivo.variable} ${publicSans.variable}`

export const FUENTE_TITULO_VAR =
  OPCION_TIPOGRAFIA === "A" ? "var(--pip-font-titulo-a)" : "var(--pip-font-titulo-b)"

export const FUENTE_CUERPO_VAR =
  OPCION_TIPOGRAFIA === "A" ? "var(--pip-font-cuerpo-a)" : "var(--pip-font-cuerpo-b)"
