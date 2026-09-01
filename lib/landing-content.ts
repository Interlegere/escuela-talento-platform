export type LandingMoment = {
  id: "descubrir" | "desarrollar" | "integrar"
  title: string
  intro: string[]
  interpretation: string[]
  reading: string[]
  highlight: string
  image: {
    src: string
    alt: string
  }
}

export type LandingChangeMovement = {
  title: string
  text: string
  highlight?: string
}

export const conversationHref = "#primera-conversacion"

export const earlyPositions = [
  "Tal vez todavía no encontraste una dirección porque la seguís buscando afuera de vos.",
  "O empezaste a construir algo valioso, pero lo mantenés en privado, limitado, como una promesa que siempre puede esperar.",
  "O construiste mucho y pareciera que no te falta nada, aunque todavía no encontraste una manera de habitar eso que lograste.",
]

export const landingMoments: LandingMoment[] = [
  {
    id: "descubrir",
    title: "Todavía no encontraste una forma propia",
    intro: [
      "Probás. Buscás. Te anotás. Empezás. Cambiás de dirección.",
      "Cumplís, te adaptás y parecés activo desde afuera, pero nada termina de organizarse como una forma verdaderamente tuya.",
      "Otros parecen tener rumbo. Parecen saber qué hacer y haber encontrado una manera más clara de avanzar.",
      "Te comparás. Te frustrás. Y terminás frenándote todavía más.",
    ],
    interpretation: [
      "No tengo talento.",
      "Soy indeciso.",
      "Ya debería saberlo.",
      "No soy suficientemente bueno en nada.",
    ],
    reading: [
      "Tal vez no necesitás elegir más rápido.",
      "Tal vez necesitás leer mejor qué capacidades, inclinaciones, temores, historias y posibilidades están mezcladas ahí.",
      "A veces no falta talento.",
      "Falta un mapa para reconocerlo, probarlo y orientarlo hasta que empiece a tomar cuerpo.",
    ],
    highlight:
      "Falta un mapa para reconocerlo, probarlo y orientarlo hasta que empiece a tomar cuerpo.",
    image: {
      src: "/landing/moment-discover.svg",
      alt: "Persona buscando una forma concreta entre notas, pruebas y materiales abiertos.",
    },
  },
  {
    id: "desarrollar",
    title: "Sabés en qué sos bueno. Incluso lo intentaste. Pero seguís postergándolo.",
    intro: [
      "Hay algo que reconocés en vos.",
      "Puede aparecer en el arte, el deporte, los negocios, tu profesión o en una manera particular de pensar, crear, enseñar, entrenar, escribir o resolver.",
      "Pero queda relegado.",
      "Lo hacés cuando podés, cuando sobra tiempo, cuando aparece la inspiración o cuando no hay urgencias.",
      "Empezás con intensidad y después te interrumpís.",
      "Se vuelve privado.",
      "Se vuelve promesa.",
      "Se vuelve “algún día”.",
      "Mientras tanto, estás ocupado.",
      "Pero estar ocupado no es lo mismo que estar construyendo aquello que te importa.",
      "Lo valioso queda en una zona intermedia: existe, pero no crece; lo reconocés, pero no lo asumís; lo deseás, pero no lo organizás.",
    ],
    interpretation: [
      "Me falta motivación.",
      "No tengo disciplina.",
      "Todavía no es el momento.",
      "Cuando esté más preparado, lo voy a hacer.",
    ],
    reading: [
      "No todo lo urgente construye lo importante.",
      "Desarrollar un talento no es solamente tener una capacidad.",
      "También implica darle un lugar real, entrenarla cuando pierde novedad y sostener decisiones que ya no pueden depender sólo de la inspiración.",
      "La postergación no siempre significa que no querés hacerlo.",
      "A veces muestra que todavía no encontraste los motivos necesarios para hacerlo crecer.",
      "Lo urgente no necesariamente construye lo importante.",
    ],
    highlight: "Lo urgente no necesariamente construye lo importante.",
    image: {
      src: "/landing/moment-build.svg",
      alt: "Persona trabajando sobre una producción que necesita continuidad y exposición.",
    },
  },
  {
    id: "integrar",
    title: "Construiste mucho, pero no sabés cómo habitarlo",
    intro: [
      "Llegaste a lugares que antes parecían lejanos.",
      "Construiste una profesión, una empresa, una carrera, una habilidad, una posición, un nombre o una forma de reconocimiento.",
      "Aprendiste a desarrollarte, a sostener exigencias, a producir, a resolver y a tener éxito.",
      "Desde afuera, parece que está todo bien.",
      "Pero por dentro aparece otra pregunta:",
      "¿Por qué algo que costó tanto lograr no se vive como imaginabas?",
      "¿Por qué se siente vacío aquello que se suponía valioso?",
      "Y como costó tanto llegar, cuestionar la forma en que lo estás viviendo puede parecer injusto, ingrato o peligroso.",
    ],
    interpretation: [
      "Es normal estar así.",
      "Es el costo de crecer.",
      "No puedo aflojar ahora.",
      "Hay gente que quisiera estar en mi lugar.",
    ],
    reading: [
      "Pero haber logrado algo no significa necesariamente que lo estés disfrutando.",
      "No se trata de abandonar lo que construiste.",
      "Se trata de revisar qué lugar ocupa, qué costos naturalizaste y qué decidís conservar como verdaderamente valioso de ese éxito que te ganaste.",
      "No todo logro se vuelve habitable por el solo hecho de haber sido alcanzado.",
    ],
    highlight:
      "No todo logro se vuelve habitable por el solo hecho de haber sido alcanzado.",
    image: {
      src: "/landing/moment-integrate.svg",
      alt: "Persona revisando cómo sostener lo construido sin perder vida, descanso y dirección.",
    },
  },
]

export const changeMovements: LandingChangeMovement[] = [
  {
    title: "Cambia tu relación con lo que hacés.",
    text: "Lo que era una actividad secundaria, un escape o una promesa privada empieza a tener lugar, uso y continuidad.",
  },
  {
    title: "También empezás a mirar tus decisiones de otra manera.",
    text: "Algunas que parecían cómodas muestran adaptación, urgencia, expectativas externas, miedo a equivocarte o dificultad para sostener lo importante.",
    highlight: "No todo lo urgente construye lo importante.",
  },
  {
    title: "Cuando algo propio encuentra un lugar real, también se mueven otras partes de tu vida.",
    text: "También se mueven el cuerpo, los vínculos, el descanso, el disfrute, la responsabilidad y la dirección de tu vida cotidiana.",
  },
]

export const conversationScene = [
  "Tal vez reconociste una búsqueda que todavía no encuentra dirección.",
  "Tal vez viste con más claridad algo propio que seguís postergando.",
  "O empezaste a preguntarte cómo vivir de otra manera aquello que tanto te costó construir.",
  "Primero conversamos con vos.",
  "Queremos conocer qué estás viviendo, qué lugar ocupa hoy tu talento y qué querés empezar a transformar.",
  "A partir de esa conversación, te mostramos qué puerta de la escuela puede tener más sentido para vos.",
  "No venís solamente a contar lo que te pasa.",
  "Venís a descubrir cómo empezar a trabajarlo dentro de una escuela, junto con otras personas, a través de experiencias, prácticas y espacios concretos.",
]
