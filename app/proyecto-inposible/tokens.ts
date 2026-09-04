import type { CSSProperties } from "react"

// Único lugar donde viven los valores de tipografía/espaciado de la
// página — ninguna sección escribe un tamaño o un ancho a mano.
export const TOKEN_TEXTO = "max-w-[680px] text-[18px] leading-[1.65] sm:text-[19px]"
export const TOKEN_TEXTO_CHICO = "text-[15px]"
export const TOKEN_ANCHO_PX = 680
export const TOKEN_ANCHO_ANCHO_PX = 860

// El "resaltador": fondo dorado completo detrás del texto (nunca el color
// de la letra — regla de toda la página, el dorado nunca es texto sobre
// fondo claro), con el mismo halo que los botones en vez de una franja al
// 38% (esa versión quedaba a mitad de camino entre subrayado y resaltado).
// box-decoration-break: clone hace que cada línea que el texto corta
// reciba su propio bloque dorado con su propio padding/esquinas/halo, en
// vez de un solo rectángulo estirado a lo alto de todo el párrafo — el
// párrafo que lo contiene necesita line-height: 1.75 para que, si el
// texto ocupa 2-3 renglones, los bloques no se toquen entre sí.
export const TOKEN_MARCADOR_DORADO: CSSProperties = {
  backgroundColor: "var(--dorado)",
  color: "var(--tinta)",
  padding: "0.10em 0.32em",
  borderRadius: "8px",
  boxShadow: "0 0 16px rgba(249,195,62,0.45), 0 0 32px rgba(249,195,62,0.20)",
  boxDecorationBreak: "clone",
  WebkitBoxDecorationBreak: "clone",
} as CSSProperties
// Prompt 11 pide bajar el alto total a 9.000-10.000px sin cortar texto —
// esto es lo que se ajustó para lograrlo: 56/80 (Round 6) baja a 44/64.
// Sigue siendo un padding real, solo menos generoso.
export const TOKEN_PAD_SECCION = "py-[28px] md:py-[40px]"
