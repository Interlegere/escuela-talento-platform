"use client"

import EspacioAcompanamiento from "@/components/espacios/EspacioAcompanamiento"

export default function MentoriasPage() {
  return (
    <EspacioAcompanamiento
      actividadSlug="mentorias"
      titulo="Mentorías"
      subtitulo="Donde lo imposible se vuelve posible"
      etiquetaMensajes="Mensajes"
      etiquetaEncuentros="Reuniones agendadas"
      mostrarAccesos
    />
  )
}
