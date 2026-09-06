// Proyectos que pasaron por Proyecto In+Posible — compartido entre la tira
// estática del hero y el carrusel grande de la sección "Proyectos".
export type Proyecto = {
  nombre: string
  archivo: string
  instagram: string | null
}

export const PROYECTOS: Proyecto[] = [
  { nombre: "Altia", archivo: "altia.jpg", instagram: "https://www.instagram.com/altia.limpiezadeobra/" },
  { nombre: "India Eventos", archivo: "india.jpg", instagram: "https://www.instagram.com/indiaeventoscordoba/" },
  { nombre: "CreArTé", archivo: "crearte.jpg", instagram: "https://www.instagram.com/crearte.decoo/" },
  { nombre: "Felicia Films", archivo: "felicia-films.jpg", instagram: "https://www.instagram.com/imfeliciafilms/" },
  { nombre: "Arcadia Park", archivo: "arcadia-park.jpg", instagram: "https://www.instagram.com/arcadiapark.cba/" },

  { nombre: "FADEXA", archivo: "fadexa.jpg", instagram: "https://www.instagram.com/fadexa_/" },
  { nombre: "TadByte", archivo: "tadbyte.jpg", instagram: null },
  { nombre: "Re.Creo", archivo: "recreo.jpg", instagram: "https://www.instagram.com/re.creo.librosinfantiles/" },
]
