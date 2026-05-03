export type EstadoDisponibilidadAgenda =
  | "disponible"
  | "pendiente_pago"
  | "confirmada"

export type ModoAgendaDisponibilidad =
  | "disponibilidad"
  | "actividad_fija"
  | "bloqueo"

export type DisponibilidadAgenda = {
  id: number
  titulo: string
  tipo: string
  actividad_slug?: string | null
  modo: ModoAgendaDisponibilidad
  fecha: string
  hora: string
  duracion: string
  meet_link: string
  requiere_pago: boolean
  precio: string
  estado: EstadoDisponibilidadAgenda
}
