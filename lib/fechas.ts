export const ZONA_ARGENTINA = "America/Argentina/Cordoba"

export type PartesArgentina = {
  weekdayShort: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function partesFechaArgentina(date: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_ARGENTINA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
}

export function obtenerPartesArgentina(date: Date = new Date()): PartesArgentina {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_ARGENTINA,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  const get = (type: string) => parts.find((part) => part.type === type)?.value || ""

  return {
    weekdayShort: get("weekday"),
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  }
}

export function obtenerFechaISOArgentina(date: Date = new Date()) {
  const parts = partesFechaArgentina(date)

  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  if (!year || !month || !day) {
    throw new Error("No se pudo resolver la fecha en zona Argentina.")
  }

  return `${year}-${month}-${day}`
}

export function obtenerRangoDiaArgentinaUTC(date: Date = new Date()) {
  const fecha = obtenerFechaISOArgentina(date)

  return {
    fecha,
    inicioUtc: `${fecha}T03:00:00.000Z`,
    finUtc: `${fecha}T26:59:59.999Z`,
  }
}

export function mismaFechaArgentina(
  fechaA?: string | Date | null,
  fechaB?: string | Date | null
) {
  if (!fechaA || !fechaB) {
    return false
  }

  const dateA = fechaA instanceof Date ? fechaA : new Date(fechaA)
  const dateB = fechaB instanceof Date ? fechaB : new Date(fechaB)

  if (Number.isNaN(dateA.getTime()) || Number.isNaN(dateB.getTime())) {
    return false
  }

  return obtenerFechaISOArgentina(dateA) === obtenerFechaISOArgentina(dateB)
}
