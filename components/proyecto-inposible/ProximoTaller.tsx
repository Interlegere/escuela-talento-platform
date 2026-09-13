"use client"

import { formatearProximoTallerLargo, proximoTaller } from "@/lib/proyecto-inposible"

// El próximo taller en vivo, calculado en el navegador de quien visita —
// así nunca queda una fecha vieja congelada desde el último deploy, ni
// siquiera en las secciones de la landing que se sirven estáticas.
// "clausula": una línea propia (con su <span className="block">) para el
// bloque de datos del hero — "Próximo taller en vivo: lunes 14 de
// septiembre", sin punto.
// "oracion": un fragmento de texto plano para insertar dentro de un <p>
// ya existente, junto a otro texto que sí se sigue mostrando siempre —
// "El próximo taller en vivo es el lunes 14 de septiembre."
// "parrafo-cierre": igual que "oracion" pero con su propio <p> (para el
// cierre de la página, donde no hay ningún otro texto al lado).
// Si ya pasaron los tres talleres, no renderiza nada — ni la línea/párrafo,
// ni un hueco en su lugar.
export default function ProximoTaller({
  variante,
}: {
  variante: "clausula" | "oracion" | "parrafo-cierre"
}) {
  const taller = proximoTaller()

  if (!taller) return null

  const fecha = formatearProximoTallerLargo(taller)

  if (variante === "clausula") {
    return (
      <span className="block" suppressHydrationWarning>
        Próximo taller en vivo: {fecha}
      </span>
    )
  }

  if (variante === "parrafo-cierre") {
    return (
      <p className="mt-4 text-[19px] font-bold opacity-90" suppressHydrationWarning>
        El próximo taller en vivo es el {fecha}.
      </p>
    )
  }

  return <>El próximo taller en vivo es el {fecha}.</>
}
