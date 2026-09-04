import type { CSSProperties } from "react"

// Único lugar donde viven los valores de tipografía/espaciado de la
// página — ninguna sección escribe un tamaño o un ancho a mano.
export const TOKEN_TEXTO = "max-w-[680px] text-[18px] leading-[1.65] sm:text-[19px]"
export const TOKEN_TEXTO_CHICO = "text-[15px]"
export const TOKEN_ANCHO_PX = 680
export const TOKEN_ANCHO_ANCHO_PX = 860

// El "resaltador": simula una marca de fibra dorada hecha a mano detrás del
// texto — nunca el color de la letra (regla de toda la página: el dorado
// nunca es texto sobre fondo claro). box-decoration-break: clone hace que
// cada línea que el texto corta reciba su propio tramo de degradé, en vez
// de una sola franja estirada a lo alto de todo el bloque.
export const TOKEN_MARCADOR_DORADO: CSSProperties = {
  backgroundImage: "linear-gradient(to top, var(--dorado) 0%, var(--dorado) 38%, transparent 38%)",
  boxDecorationBreak: "clone",
  WebkitBoxDecorationBreak: "clone",
} as CSSProperties
// Prompt 11 pide bajar el alto total a 9.000-10.000px sin cortar texto —
// esto es lo que se ajustó para lograrlo: 56/80 (Round 6) baja a 44/64.
// Sigue siendo un padding real, solo menos generoso.
export const TOKEN_PAD_SECCION = "py-[28px] md:py-[40px]"
