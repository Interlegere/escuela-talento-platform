// Flag temporal: Entusiasmento (Mi espacio/CoFruto) todavía se está
// terminando de armar. Cambiar a `true` cuando esté listo para que lo usen
// los participantes — hasta entonces solo admin lo ve completo.
export const ENTUSIASMENTO_ABIERTO_A_PARTICIPANTES = false

// Excepción puntual mientras el flag de arriba sigue en false: emails que
// igual pueden entrar a probarlo como participante (ej. para probar un bug
// reportado, o como destinatario de prueba del agente de IA durante la
// beta). Sacar de acá cuando ya no haga falta.
//
// IMPORTANTE: "consultasbpe@gmail.com" (Cuchulain) está acá a propósito
// como único destinatario real del agente semanal (lib/agente-entusiasmo.ts)
// mientras dura la beta de tono. Cuando se abra ENTUSIASMENTO_ABIERTO_A_PARTICIPANTES
// a todos, revisar si conviene sacarla de esta lista (Fase E).
export const ENTUSIASMENTO_BETA_EMAILS = ["consultasbpe@gmail.com"]

export function tieneAccesoEntusiasmento(email: string, esAdmin: boolean) {
  return (
    esAdmin ||
    ENTUSIASMENTO_ABIERTO_A_PARTICIPANTES ||
    ENTUSIASMENTO_BETA_EMAILS.includes(String(email || "").trim().toLowerCase())
  )
}
