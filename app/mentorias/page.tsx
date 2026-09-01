"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppSession } from "@/components/auth/AppSessionProvider"
import EspacioAcompanamiento from "@/components/espacios/EspacioAcompanamiento"

export default function MentoriasPage() {
  const { data: session, status } = useAppSession()
  const router = useRouter()
  // Las mentorías 1 a 1 siguen en pie (agendadas y facturadas igual que
  // siempre) — lo que cambia es que el participante ya no usa esta página
  // como su espacio de trabajo, sino Entusiasmento (Coordenadas,
  // Producciones, Pitch, Tareas). Admin/colaborador siguen viendo esta
  // página tal cual, para gestionar mensajes/recursos/accesos.
  const noEsAdmin = status === "authenticated" && session?.user?.role !== "admin"

  useEffect(() => {
    if (noEsAdmin) {
      router.replace("/casatalentos")
    }
  }, [noEsAdmin, router])

  if (noEsAdmin) {
    return null
  }

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
