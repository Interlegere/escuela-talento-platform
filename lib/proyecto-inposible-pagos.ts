// Datos de pago de Proyecto In+Posible (CVU, links de Mercado Pago, cuenta
// internacional). NUNCA importar este archivo desde la landing pública
// (app/proyecto-inposible/page.tsx) ni desde el formulario — solo desde
// app/api/preinscripcion/route.ts (mails) y app/proyecto-inposible/gracias
// (pantalla posterior al envío), que son los dos únicos lugares donde
// Nicolás pidió que aparezcan.
export const TRANSFERENCIA_ARS = {
  alias: "interlegere.mp",
  cvu: "0000003100050972462973",
  titular: "Nicolás Busico",
}

// Ojo: existen otros links de Mercado Pago con otros montos — no se usan.
export const MERCADOPAGO = {
  mensual: { monto: 200000, link: "https://mpago.la/16bxUfq" },
  unico: { monto: 550000, link: "https://mpago.la/2uHLiHD" },
}

export const TRANSFERENCIA_INTERNACIONAL = {
  titular: "Nicolás Busico",
  banco: "Lead Bank",
  tipoCuenta: "checking",
  cuenta: "211420210325",
  // Pendiente: Lead Bank todavía no confirmó el SWIFT/BIC — sin ese dato,
  // alguien girando desde fuera de EE.UU. no tiene forma real de usar el
  // número de ruta (es de uso interno de EE.UU., su banco le va a pedir
  // el SWIFT). No inventar un valor: agregar `swift` acá apenas se tenga.
  swift: null as string | null,
  ruta: "101019644",
  direccion: "08, 04, Falda del Carmen, Córdoba X5189, Argentina",
}
