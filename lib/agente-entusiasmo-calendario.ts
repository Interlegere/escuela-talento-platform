import { obtenerFechaISOArgentina } from "@/lib/fechas"

// ⚠️ FECHA ANCLA — NO TOCAR una vez desplegada. ⚠️
//
// Define qué semanas son "par" (lunes/miércoles/viernes) e "impar"
// (martes/jueves). Se cuenta en semanas transcurridas desde este lunes
// (no con el número de semana ISO del calendario, que se traba una vez
// por año en los años de 53 semanas). La semana que contiene esta fecha
// es la semana 0 = par.
//
// Cambiar este valor después de desplegado da vuelta el ritmo de TODAS
// las semanas siguientes (lo que era lunes/miércoles/viernes pasa a ser
// martes/jueves y viceversa). Si el despliegue se corre de semana,
// actualizar a conciencia antes de subir — nunca de forma automática.
const ANCLA_LUNES = "2026-08-17"

function aFechaUTC(fechaISO: string) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number)
  return Date.UTC(anio, mes - 1, dia)
}

function semanasDesdeAncla(fechaISO: string) {
  const msPorSemana = 7 * 24 * 60 * 60 * 1000
  const diffMs = aFechaUTC(fechaISO) - aFechaUTC(ANCLA_LUNES)
  // Módulo seguro para diffs negativos (no debería ocurrir en producción,
  // ya que el cron solo corre después del despliegue, pero por las dudas).
  return Math.floor(diffMs / msPorSemana)
}

export function esSemanaPar(fechaISO: string = obtenerFechaISOArgentina()) {
  const semanas = semanasDesdeAncla(fechaISO)
  return ((semanas % 2) + 2) % 2 === 0
}

/**
 * Semana par: lunes(1), miércoles(3), viernes(5).
 * Semana impar: martes(2), jueves(4).
 * `diaSemana` sigue la convención de Date#getUTCDay (domingo = 0).
 */
export function esDiaDeEnvioHoy(fechaISO: string = obtenerFechaISOArgentina()) {
  const diaSemana = new Date(aFechaUTC(fechaISO)).getUTCDay()
  const par = esSemanaPar(fechaISO)

  if (par) {
    return diaSemana === 1 || diaSemana === 3 || diaSemana === 5
  }

  return diaSemana === 2 || diaSemana === 4
}
