// Número de WhatsApp de Nicolás, sin el "+", sin espacios y sin guiones
// (formato que pide wa.me) — el "9" después del "54" es obligatorio para
// móviles argentinos. Compartido entre Entusiasmento (mensaje de acceso,
// mail de bienvenida) y Proyecto In+Posible (landing, /gracias, mail de
// confirmación de la preinscripción) — vive acá, no en un módulo de
// campaña, porque Entusiasmento no puede depender de una landing con
// fecha de vencimiento que se trabaja en paralelo.
export const WHATSAPP_CONTACTO: string | null = "5493515166582"

export function crearLinkWhatsapp(mensaje: string) {
  if (!WHATSAPP_CONTACTO) return null
  return `https://wa.me/${WHATSAPP_CONTACTO}?text=${encodeURIComponent(mensaje)}`
}
