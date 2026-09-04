// Único lugar donde viven los valores de tipografía/espaciado de la
// página — ninguna sección escribe un tamaño o un ancho a mano.
export const TOKEN_TEXTO = "max-w-[680px] text-[18px] leading-[1.65] sm:text-[19px]"
export const TOKEN_TEXTO_CHICO = "text-[15px]"
export const TOKEN_ANCHO_PX = 680
export const TOKEN_ANCHO_ANCHO_PX = 860
// Prompt 11 pide bajar el alto total a 9.000-10.000px sin cortar texto —
// esto es lo que se ajustó para lograrlo: 56/80 (Round 6) baja a 44/64.
// Sigue siendo un padding real, solo menos generoso.
export const TOKEN_PAD_SECCION = "py-[28px] md:py-[40px]"
