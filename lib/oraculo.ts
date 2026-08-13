export const FRASES_ORACULO = [
  "¡Que disfrutes de tu viaje!",
  "A surfear la ola",
  "No todo es lo que parece",
  "Un paso más hace la diferencia",
  "¿Cuál es tu mejor versión a lograr hoy?",
  "Desde adentro hacia afuera",
  "¡Brinda por tus logros!",
  "Profundiza siempre con un norte claro",
  "Que te importe lo que aportas",
  "El control es una forma de reducir las formas que sucedan las cosas que querés",
  "¿Qué es lo que no estás haciendo aún dentro de todo lo que sí hacés para lograr lo que querés?",
  "Si buscas donde siempre, encuentras lo de siempre. Encuentra donde nunca, y obtén lo que desde ahora.",
  "Recibir es usar lo que se te dió.",
  "Avanza para saber lo que esperas que el saber te muestre para avanzar.",
  "¿Por qué el otro sí logra lo que tú no? (La respuesta está en tu interior)",
  "Tu reflejo está donde no lo ves, porque querer verte en lo externo, es hacer aparecer el espejo.",
  "¿Por qué tu sí logras, lo que otros no?",
]

export function obtenerFraseOraculoDelDia(email: string, fecha: Date = new Date()) {
  const emailNormalizado = String(email || "").trim().toLowerCase() || "participante"
  const claveDia = [fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate()].join("-")
  const semilla = `${claveDia}:${emailNormalizado}`
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const indice = semilla % FRASES_ORACULO.length
  return FRASES_ORACULO[indice] || FRASES_ORACULO[0]
}
