// Material que todavía puede no existir (video del hero, fotos del taller).
// Cada bloque de la landing consulta este objeto y decide si se renderiza
// — así el deploy nunca espera a que llegue el archivo. Sumar contenido
// después es un solo commit acá, sin tocar componentes.
export type Testimonio = {
  nombre: string // "Dolores"
  proyecto?: string // "Altia" — opcional, no todos vienen de un proyecto con Instagram
  instagram?: string // "https://www.instagram.com/altia.limpiezadeobra/"
  foto?: string // "/testimonios/dolores.jpg" — opcional, si no la mandan va sin foto
  // Logo del proyecto, chico, al lado del nombre del proyecto — nunca en
  // el lugar de `foto` (la cara de la persona no se reemplaza por un logo).
  logoProyecto?: string // "/proyectos/altia.jpg"
  // Para quien tiene más de un proyecto propio (ej. Juli, India Eventos +
  // Arcadia Park) — reemplaza a `logoProyecto`, cada logo con su propio alt
  // (nunca el nombre combinado de los dos proyectos).
  logosProyecto?: { archivo: string; alt: string }[]
  texto: string // literal, tal cual lo escribió la persona — nunca corregido
  video?: string // opcional, si en vez de texto mandan video
}

export const ASSETS = {
  heroVideo: null as string | null, // 'proyecto-inposible/hero.mp4' cuando exista
  testimonios: [
    {
      nombre: "Julieta",
      foto: "/testimonios/juli.jpg",
      proyecto: "India Eventos + Arcadia Park",
      logosProyecto: [
        { archivo: "/proyectos/india.jpg", alt: "India Eventos" },
        { archivo: "/proyectos/arcadia-park.jpg", alt: "Arcadia Park" },
      ],
      texto:
        "Empecé con Nico porque estaba muy trabada, siempre encontraba algo que me impedía avanzar o empezar mis proyectos. En esos meses no solo pude poner en marcha mi proyecto, sino que creció muchísimo más de lo que alguna vez hubiera imaginado. Pero sobre todo siento que cambié yo, dejé de frenarme y entendí que puedo lograr mucho más de lo que pensaba.",
    },
    {
      nombre: "Dolores",
      proyecto: "Altia",
      instagram: "https://www.instagram.com/altia.limpiezadeobra/",
      foto: "/testimonios/dolores.jpg",
      logoProyecto: "/proyectos/altia.jpg",
      texto:
        "Nicolás me ayudó a descubrir el propósito que impulsa mi carrera. Lograr que Altia nazca, crezca, funcione y se consolide es, sin duda, un logro compartido.",
    },
    {
      nombre: "Verónica",
      proyecto: "CreArTé",
      instagram: "https://www.instagram.com/crearte.decoo/",
      foto: "/testimonios/veronica.jpg",
      logoProyecto: "/proyectos/crearte.jpg",
      texto:
        "Valoro enormemente el espacio que propiciaste Nico para entrenarme y accionar a lo que digo que quiero.",
    },
    {
      nombre: "Florencia",
      foto: "/testimonios/florencia.jpg",
      texto:
        "Agradezco mucho Nico todos tus aportes y brindarme las herramientas para animarme a ir más allá de lo que mi límite imaginario me ponía.",
    },
  ] as Testimonio[],
  fotosTaller: [] as string[],
}
