/**
 * Contenido de la web institucional (raíz del dominio).
 *
 * El texto vive acá y no dentro del JSX para que se pueda editar sin tocar
 * layout — mismo criterio que `lib/landing-content.ts`.
 *
 * Fuente: documento de trabajo `entheos-web-institucional-texto.md`,
 * alineado con el Documento Fundacional v0.5.
 */

export const conversemosHref = "#conversemos"

export const acronimo =
  "Escuela Norte para el desarrollo del Talento, el Entusiasmo y el Orden de los Sentidos."

export const aperturaParrafos = [
  "Desde 2018, deportistas, artistas, emprendedores, empresarios, profesionales y personas que quieren dedicarse a un proyecto que creen imposible nos encontramos para construir un rumbo propio, hacerlo crecer y conectar con un propósito que le dé entusiasmo a la vida.",
  "Encuentros grupales, sesiones, mentorías, asesorías e intervenciones institucionales acompañan cada momento del recorrido: aprendemos a usar mejor lo que tenemos y a tomar decisiones más precisas sobre nuestros talentos.",
]

export const problemaParrafos = [
  "Tener un talento no alcanza. Lo difícil es saber qué hacer con él.",
  "A veces todavía no encontró forma: probamos cosas, empezamos, cambiamos de rumbo, y no terminamos de dar con lo nuestro. A veces ya sabemos qué tenemos pero lo dejamos en un rincón —lo hacemos cuando sobra tiempo, lo empezamos y lo abandonamos, no nos animamos a mostrarlo. Y a veces llegamos lejos y no sabemos cómo vivir eso que conseguimos: crecieron los resultados y quedaron atrás la salud, los vínculos, el disfrute.",
  "Ninguna de las tres es falta de motivación. Es una cuestión de lugar: qué lugar ocupa ese talento en la propia vida, y qué se hace con él todas las semanas.",
  "Eso no se resuelve leyendo ni decidiendo un lunes. Se resuelve con un espacio donde producir, con alguien que escuche de verdad lo que está pasando, y con otras personas alrededor haciendo lo mismo.",
]

export type EspacioInstitucional = {
  titulo: string
  texto: string
}

export const espacios: EspacioInstitucional[] = [
  {
    titulo: "Encuentros semanales de producción",
    texto:
      "Cada uno trae lo que está haciendo —un proyecto, una obra, un entrenamiento, una idea que quiere armar— y lo pone sobre la mesa. Se muestra, se comenta, se corrige, y a la semana siguiente vuelve avanzado. El ritmo es lo que sostiene: no dependemos de la inspiración.",
  },
  {
    titulo: "Sesiones individuales",
    texto:
      "Espacio uno a uno para lo que no se resuelve en grupo: lo que traba, lo que se repite, lo que duele. Las conduce un psicólogo.",
  },
  {
    titulo: "Mentorías",
    texto:
      "Acompañamiento cercano sobre un proyecto concreto, con una dedicación que el grupo no permite.",
  },
  {
    titulo: "Talleres abiertos",
    texto:
      "Encuentros puntuales para trabajar sobre proyectos que todavía están tomando forma. No hace falta ser parte de la escuela para venir.",
  },
  {
    titulo: "Trabajo dentro de instituciones",
    texto:
      "Vamos a clubes, equipos, escuelas y empresas, donde el talento, los vínculos y el rendimiento se juegan en situaciones reales.",
  },
]

export const paraQueSirveParrafos = [
  "Para que eso que sabemos hacer deje de estar guardado.",
  "Para pasar de tener una idea a tener algo hecho, mostrado y mejorado. Para sostener un proyecto más allá de la semana en que nos entusiasmó. Para dejar de postergar lo que más nos importa. Y, cuando ya se logró mucho, para encontrar una manera de vivirlo que no sea aguantarlo.",
  "No prometemos transformaciones automáticas. Lo que hay acá es trabajo: producir, mostrar, corregir, sostener. Lo que cambia es que no se hace solo, y que hay alguien mirando de cerca lo que a uno se le hace difícil ver.",
]

/**
 * Resultados: pendiente de material real (hechos concretos + capturas con
 * autorización). Mientras el array esté vacío, la sección no se renderiza —
 * preferimos que no exista antes que mostrarla vacía o rellenarla con frases
 * genéricas, que restarían justo donde esta página tiene que sumar.
 */
export type ResultadoInstitucional = {
  hecho: string
  quien?: string
}

export const resultados: ResultadoInstitucional[] = []

export const nicolasParrafos = [
  "Nicolás Busico es psicólogo, egresado de la Universidad Nacional de Córdoba, y fundador de ENTHEOS. Hace más de diez años trabaja con el talento de otras personas —en el deporte, en el arte, en los emprendimientos— y esa misma pasión es la que lo llevó a crear la escuela. Conduce los espacios y sostiene las conversaciones iniciales.",
]

export const comunidadParrafo =
  "La escuela también somos nosotros: gente de rubros y momentos distintos, que no compite entre sí y que termina siendo parte del sostén de los demás. Eso no es un beneficio agregado — es cómo funciona."

export const porQueExisteParrafos = [
  "Hoy es más fácil que nunca producir algo parecido a lo que produce cualquier otro. Las herramientas se igualaron, las formas se copian rápido, y la inteligencia artificial aceleró todo eso. En ese contexto, lo que hacemos de un modo que nadie más haría vale menos incluso a nuestros propios ojos.",
  "ENTHEOS existe para dar vuelta eso: para volver a poner en el centro lo propio, entrenarlo, producirlo y sostenerlo.",
]

export const etimologia =
  "ENTHEOS y entusiasmo son, literalmente, la misma palabra: las dos vienen del griego éntheos — la chispa que llevamos dentro para encender los rumbos más valiosos en la vida de cada persona."

export const empezarParrafos = [
  "A ENTHEOS se llega por lugares distintos: un taller abierto, el pedido de una sesión, un trabajo dentro de un club, la recomendación de alguien que ya participa.",
  "En todos los casos hay una conversación primero. Ahí escuchamos qué estás haciendo, qué querés hacer y qué se está trabando, y recién después proponemos por dónde empezar. No vendemos un curso: armamos un recorrido.",
]

export type PuertaInstitucional = {
  label: string
  href: string
  detalle: string
  principal?: boolean
}

export const puertas: PuertaInstitucional[] = [
  {
    label: "Conversemos",
    href: conversemosHref,
    detalle: "Para empezar un recorrido propio.",
    principal: true,
  },
  {
    label: "Próximo taller abierto",
    href: conversemosHref,
    detalle: "Un encuentro suelto, sin ser parte de la escuela.",
  },
  {
    label: "Para clubes, escuelas y empresas",
    href: conversemosHref,
    detalle: "Una reunión de diagnóstico.",
  },
]
