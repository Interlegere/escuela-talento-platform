"use client"

import EspacioAcompanamiento from "@/components/espacios/EspacioAcompanamiento"

export default function TerapiaPage() {
  return (
    <EspacioAcompanamiento
      actividadSlug="terapia"
      titulo="Terapia"
      subtitulo="Camino para la transformación del cuerpo, alma y vida."
      etiquetaMensajes="Mensajes"
      etiquetaEncuentros="Sesiones agendadas"
      mostrarAccesos
    />
  )
}
