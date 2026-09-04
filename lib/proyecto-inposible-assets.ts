// Material que todavía puede no existir (video del hero, testimonios, fotos
// del taller). Cada bloque de la landing consulta este objeto y decide si
// se renderiza — así el deploy nunca espera a que llegue el archivo. Sumar
// contenido después es un solo commit acá, sin tocar componentes.
export type Testimonio = {
  nombre: string // "Verónica Saracho"
  proyecto: string // "CreArTé"
  instagram: string // "https://www.instagram.com/crearte.decoo/"
  foto: string // "/testimonios/veronica.jpg"
  texto: string // dos o tres líneas
  video?: string // opcional, si en vez de texto mandan video
}

export const ASSETS = {
  heroVideo: null as string | null, // 'proyecto-inposible/hero.mp4' cuando exista
  testimonios: [] as Testimonio[],
  fotosTaller: [] as string[],
}
