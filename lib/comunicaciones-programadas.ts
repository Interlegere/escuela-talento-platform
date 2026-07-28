import { obtenerPartesArgentina } from "@/lib/fechas"

export type Recurrencia = "una_vez" | "semanal" | "mensual" | "intervalo_dias"

export type ReglaProgramacion = {
  recurrencia: Recurrencia
  fechaUnaVez?: string | null
  diaSemana?: number | null
  diaMes?: number | null
  intervaloDias?: number | null
  hora: string
  ultimaEjecucionAt?: string | null
}

function argentinaLocalADate(
  year: number,
  month: number,
  day: number,
  hora: string
) {
  const [hh, mm] = hora.split(":").map(Number)
  return new Date(Date.UTC(year, month - 1, day, (hh || 0) + 3, mm || 0, 0))
}

function pesoDiaSemana(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

function ultimoDiaDelMes(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function sumarDiasCalendario(year: number, month: number, day: number, dias: number) {
  const fecha = new Date(Date.UTC(year, month - 1, day + dias))
  return {
    year: fecha.getUTCFullYear(),
    month: fecha.getUTCMonth() + 1,
    day: fecha.getUTCDate(),
  }
}

export function calcularProximaEjecucion(
  regla: ReglaProgramacion,
  desde: Date = new Date()
): Date {
  if (regla.recurrencia === "una_vez") {
    if (!regla.fechaUnaVez) {
      throw new Error("Falta la fecha para una programación de una sola vez.")
    }
    const [y, m, d] = regla.fechaUnaVez.split("-").map(Number)
    return argentinaLocalADate(y, m, d, regla.hora)
  }

  if (regla.recurrencia === "semanal") {
    if (regla.diaSemana === undefined || regla.diaSemana === null) {
      throw new Error("Falta el día de la semana para la recurrencia semanal.")
    }

    let { year, month, day } = obtenerPartesArgentina(desde)

    for (let i = 0; i < 8; i++) {
      if (pesoDiaSemana(year, month, day) === regla.diaSemana) {
        const candidato = argentinaLocalADate(year, month, day, regla.hora)
        if (candidato.getTime() >= desde.getTime()) {
          return candidato
        }
      }
      ;({ year, month, day } = sumarDiasCalendario(year, month, day, 1))
    }

    throw new Error("No se pudo calcular la próxima ejecución semanal.")
  }

  if (regla.recurrencia === "mensual") {
    if (!regla.diaMes) {
      throw new Error("Falta el día del mes para la recurrencia mensual.")
    }

    let { year, month } = obtenerPartesArgentina(desde)

    for (let i = 0; i < 14; i++) {
      const diaClamp = Math.min(regla.diaMes, ultimoDiaDelMes(year, month))
      const candidato = argentinaLocalADate(year, month, diaClamp, regla.hora)

      if (candidato.getTime() >= desde.getTime()) {
        return candidato
      }

      month += 1
      if (month > 12) {
        month = 1
        year += 1
      }
    }

    throw new Error("No se pudo calcular la próxima ejecución mensual.")
  }

  if (regla.recurrencia === "intervalo_dias") {
    if (!regla.intervaloDias || regla.intervaloDias < 1) {
      throw new Error("Falta el intervalo de días.")
    }

    if (regla.ultimaEjecucionAt) {
      const partesBase = obtenerPartesArgentina(new Date(regla.ultimaEjecucionAt))
      const { year, month, day } = sumarDiasCalendario(
        partesBase.year,
        partesBase.month,
        partesBase.day,
        regla.intervaloDias
      )
      return argentinaLocalADate(year, month, day, regla.hora)
    }

    if (!regla.fechaUnaVez) {
      throw new Error("Falta la fecha de inicio para el intervalo de días.")
    }

    const [y, m, d] = regla.fechaUnaVez.split("-").map(Number)
    return argentinaLocalADate(y, m, d, regla.hora)
  }

  throw new Error("Tipo de recurrencia desconocido.")
}
