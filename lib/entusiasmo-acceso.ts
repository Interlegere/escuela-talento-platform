// Entusiasmento (Mi espacio/CoFruto) ya está abierto a todos los
// participantes activos de la actividad — no solo admin/beta. Volver a
// `false` para cerrarlo de nuevo si hiciera falta (ej. mantenimiento).
export const ENTUSIASMENTO_ABIERTO_A_PARTICIPANTES = true

// Lista histórica de excepciones puntuales, ya sin efecto real ahora que
// el flag de arriba es `true` (queda `esAdmin || true || ...`). Se
// mantiene el array (en vez de vaciarlo) porque el agente diario
// (lib/agente-entusiasmo.ts) también llama a tieneAccesoEntusiasmento — si
// en el futuro se vuelve a cerrar el acceso general, esta lista permite
// reabrirlo para casos puntuales sin tocar código en dos lugares.
export const ENTUSIASMENTO_BETA_EMAILS = ["consultasbpe@gmail.com"]

export function tieneAccesoEntusiasmento(email: string, esAdmin: boolean) {
  return (
    esAdmin ||
    ENTUSIASMENTO_ABIERTO_A_PARTICIPANTES ||
    ENTUSIASMENTO_BETA_EMAILS.includes(String(email || "").trim().toLowerCase())
  )
}
