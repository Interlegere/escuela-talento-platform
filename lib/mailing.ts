import { obtenerPartesArgentina } from "@/lib/fechas"
import { crearLinkWhatsapp, WHATSAPP_CONTACTO } from "@/lib/whatsapp"
import { TALLERES, formatearProximoTallerLargo, type PlanPago } from "@/lib/proyecto-inposible"

type BienvenidaParams = {
  nombre: string
  email: string
  password: string
  role: string
}

type CharlaIntroParams = {
  nombre: string
  email: string
  password: string
}

type RecuperacionClaveParams = {
  nombre: string
  email: string
  resetUrl: string
}

export type PreinscripcionInstruccionesPago =
  | {
      esInternacional: false
      transferencia: { montoTexto: string; alias: string; cvu: string; titular: string }
      mercadopago: { montoTexto: string; link: string }
    }
  | {
      esInternacional: true
      montoTexto: string
      titular: string
      banco: string
      tipoCuenta: string
      cuenta: string
      ruta: string
      direccion: string
    }

type PreinscripcionParticipanteParams = {
  nombre: string
  email: string
  planPago: PlanPago
  planPagoTexto: string
  pago: PreinscripcionInstruccionesPago
}

type PreinscripcionAdminParams = {
  nombre: string
  apellido: string
  email: string
  whatsapp: string
  pais: string
  tieneProyectoTexto: string
  proyectoDescripcion: string
  planPagoTexto: string
  montoTexto: string
}

type MailingResult =
  | { enviado: true; proveedor: string; proveedorId?: string | null }
  | { enviado: false; motivo: string }

type EmailAttachment = {
  filename: string
  content: string
  content_type?: string
}

export function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "")
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function textoRol(role: string) {
  switch (role) {
    case "admin":
      return "administrador"
    case "colaborador":
      return "colaborador"
    default:
      return "participante"
  }
}

export function charlaIntroTitulo() {
  return (
    process.env.CHARLA_INTRO_TITULO ||
    "Las claves no evidentes para gestionar eficazmente tu tiempo"
  ).trim()
}

export function charlaIntroSubtitulo() {
  return (
    process.env.CHARLA_INTRO_SUBTITULO ||
    "¿Que es lo que genera falta de tiempo?"
  ).trim()
}

export function charlaIntroFechaTexto() {
  return (process.env.CHARLA_INTRO_FECHA_TEXTO || "").trim()
}

export function charlaIntroMeetUrl() {
  return (process.env.CHARLA_INTRO_MEET_URL || "").trim()
}

export function charlaIntroGrabacionUrl() {
  return (
    process.env.CHARLA_INTRO_GRABACION_URL ||
    "https://drive.google.com/file/d/1NSKHVju719fJZg7re48NrSpty04g3ej2/view?usp=sharing"
  ).trim()
}

function crearContenidoBienvenida(params: BienvenidaParams) {
  const url = appUrl()
  const nombre = params.nombre.trim() || "bienvenida/o"
  const role = textoRol(params.role)
  const subtitulo =
    "Escuela Norte para el Talento, el Entusiasmo y el Orden de los Sentidos"

  const text = [
    `Hola ${nombre},`,
    "",
    "Bienvenido/a a ENTHEOS.",
    subtitulo,
    "",
    "Te damos la bienvenida a la plataforma.",
    "",
    `Acceso: ${url}/login`,
    `Usuario: ${params.email}`,
    `Clave de acceso inicial: ${params.password}`,
    `Rol: ${role}`,
    "",
    "Para arrancar: entrá a Entusiasmento y escribí tus coordenadas — es tu primer paso, no hace falta que estén perfectas.",
    "",
    `Instalá ENTHEOS en tu celular: ${url}/app`,
    "",
    "Por seguridad, conservá estas credenciales y avisá si necesitás cambiarlas.",
    "",
    "Nos encontramos dentro de la plataforma.",
  ].join("\n")

  const html = `
    <div style="margin: 0; padding: 32px 16px; background: #f6efe2; font-family: Arial, sans-serif; color: #1f2933;">
      <div style="max-width: 640px; margin: 0 auto; background: #fffdf8; border: 1px solid #eadfc9; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(77, 54, 18, 0.08);">
        <div style="padding: 32px 32px 20px; background: linear-gradient(135deg, rgba(250,244,229,1) 0%, rgba(255,250,240,1) 55%, rgba(248,237,210,1) 100%);">
          <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a6a2f; font-weight: 700;">ENTHEOS</p>
          <h1 style="margin: 0 0 10px; font-size: 32px; line-height: 1.15; color: #18202a;">Bienvenido/a a ENTHEOS</h1>
          <p style="margin: 0; color: #6b7280; font-size: 16px; line-height: 1.5;">
            ${escapeHtml(subtitulo)}
          </p>
        </div>

        <div style="padding: 28px 32px 32px; line-height: 1.7;">
          <p style="margin: 0 0 14px;">Hola ${escapeHtml(nombre)},</p>
          <p style="margin: 0 0 16px;">
            Te damos la bienvenida a la plataforma. Ya podés ingresar con tus datos y comenzar tu recorrido dentro de ENTHEOS.
          </p>

          <div style="margin: 24px 0 28px;">
            <a
              href="${url}/login"
              style="display: inline-block; padding: 14px 22px; border-radius: 999px; background: #c98b1b; color: #ffffff; font-weight: 700; text-decoration: none;"
            >
              Ingresar a ENTHEOS
            </a>
          </div>

          <div style="border: 1px solid #e5dccb; border-radius: 18px; padding: 18px 20px; margin: 0 0 24px; background: #fffaf2;">
            <p style="margin: 0 0 10px;"><strong>Acceso:</strong> <a href="${url}/login">${url}/login</a></p>
            <p style="margin: 0 0 10px;"><strong>Usuario:</strong> ${escapeHtml(params.email)}</p>
            <p style="margin: 0 0 10px;"><strong>Clave de acceso inicial:</strong> ${escapeHtml(params.password)}</p>
            <p style="margin: 0;"><strong>Rol:</strong> ${escapeHtml(role)}</p>
          </div>

          <p style="margin: 0 0 16px;">
            <strong>Para arrancar:</strong> entrá a Entusiasmento y escribí tus coordenadas — es tu primer paso, no hace falta que estén perfectas.
          </p>

          <div style="margin: 0 0 24px; text-align: center;">
            <a
              href="${url}/app"
              style="display: inline-block; padding: 14px 22px; border-radius: 999px; background: #cf9130; color: #18202a; font-weight: 700; text-decoration: none;"
            >
              Instalá ENTHEOS en tu celular
            </a>
          </div>

          <p style="margin: 0 0 14px;">
            Por seguridad, conservá estas credenciales y avisá si necesitás cambiarlas.
          </p>
          <p style="margin: 0;">
            Nos encontramos dentro de la plataforma.
          </p>
        </div>
      </div>
    </div>
  `

  return {
    subject: "Bienvenido/a a ENTHEOS",
    text,
    html,
  }
}

function crearContenidoRecuperacionClave(params: RecuperacionClaveParams) {
  const nombre = params.nombre.trim() || "hola"
  const subtitulo = "Pediste recuperar tu clave de acceso a ENTHEOS"

  const text = [
    `Hola ${nombre},`,
    "",
    "Pediste recuperar tu clave de acceso a ENTHEOS.",
    "",
    `Elegí una clave nueva acá: ${params.resetUrl}`,
    "",
    "Este link vale por 1 hora y se puede usar una sola vez.",
    "",
    "Si no fuiste vos, ignorá este mail — tu clave actual sigue siendo válida.",
  ].join("\n")

  const html = `
    <div style="margin: 0; padding: 32px 16px; background: #f6efe2; font-family: Arial, sans-serif; color: #1f2933;">
      <div style="max-width: 640px; margin: 0 auto; background: #fffdf8; border: 1px solid #eadfc9; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(77, 54, 18, 0.08);">
        <div style="padding: 32px 32px 20px; background: linear-gradient(135deg, rgba(250,244,229,1) 0%, rgba(255,250,240,1) 55%, rgba(248,237,210,1) 100%);">
          <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a6a2f; font-weight: 700;">ENTHEOS</p>
          <h1 style="margin: 0 0 10px; font-size: 32px; line-height: 1.15; color: #18202a;">Recuperar tu clave</h1>
          <p style="margin: 0; color: #6b7280; font-size: 16px; line-height: 1.5;">
            ${escapeHtml(subtitulo)}
          </p>
        </div>

        <div style="padding: 28px 32px 32px; line-height: 1.7;">
          <p style="margin: 0 0 14px;">Hola ${escapeHtml(nombre)},</p>
          <p style="margin: 0 0 16px;">
            Tocá el botón de abajo para elegir una clave nueva. El link vale por 1 hora y se puede usar una sola vez.
          </p>

          <div style="margin: 24px 0 28px;">
            <a
              href="${params.resetUrl}"
              style="display: inline-block; padding: 14px 22px; border-radius: 999px; background: #c98b1b; color: #ffffff; font-weight: 700; text-decoration: none;"
            >
              Elegir clave nueva
            </a>
          </div>

          <p style="margin: 0 0 14px; font-size: 13px; color: #6b7280;">
            Si el botón no funciona, copiá y pegá este link en tu navegador:<br />
            <a href="${params.resetUrl}" style="color: #8a6a2f;">${escapeHtml(params.resetUrl)}</a>
          </p>

          <p style="margin: 0;">
            Si no pediste esto, ignorá el mail — tu clave actual sigue siendo válida.
          </p>
        </div>
      </div>
    </div>
  `

  return {
    subject: "Recuperar tu clave de acceso a ENTHEOS",
    text,
    html,
  }
}

// Lo que entra en los tres meses, siempre igual sin importar plan ni
// país — mismo listado que la tabla de precios de la landing (sin los
// montos, acá alcanza con decir qué es cada cosa).
const LO_QUE_COMPRASTE = [
  "Tres talleres creativos en vivo, uno por mes, a las 19:30.",
  "Entusiasmento, tu espacio propio en el celular, durante los tres meses.",
  "Tres sesiones 1 a 1 de una hora conmigo: una por mes.",
  "Soporte por WhatsApp de 9 a 18, las doce semanas.",
]

const AVISO_GRABACION =
  "Si alguno de esos talleres ya pasó cuando te inscribiste, te habilito la grabación: tenés siete días desde hoy para verla."

const linkComprobante = crearLinkWhatsapp("Hola Nicolás, te mando el comprobante de mi pago de Proyecto In+Posible.")

// Sin SWIFT/BIC (Lead Bank todavía no lo confirmó), los datos bancarios
// internacionales no le sirven a nadie transfiriendo desde otro país —
// el "Ruta" que había es de uso interno de EE.UU., y el banco de origen
// va a pedir el SWIFT sí o sí. Mismo criterio ya aplicado en
// GraciasContenido.tsx: mientras no esté el SWIFT, nada de datos
// bancarios acá — se deriva a coordinar por WhatsApp. Preferible una
// persona que escribe a una que intenta transferir, no puede, y no avisa.
const linkCoordinarExterior = crearLinkWhatsapp(
  "Hola Nicolás, me anoté en Proyecto In+Posible desde otro país y quiero coordinar el pago."
)

function crearContenidoPreinscripcionParticipante(params: PreinscripcionParticipanteParams) {
  const nombre = params.nombre.trim() || "hola"
  const talleres = TALLERES.map((t) => t.etiqueta)

  // Vencimiento de los meses 2 y 3 — solo aplica al plan mes a mes, sin
  // importar el país. Sale de los mismos TALLERES que usa la landing, no
  // de una fecha escrita a mano acá.
  const avisoMesesSiguientes =
    params.planPago === "mensual"
      ? `Los meses 2 y 3 se pagan de la misma forma, antes de cada taller: antes del ${formatearProximoTallerLargo(TALLERES[1])} y antes del ${formatearProximoTallerLargo(TALLERES[2])}.`
      : null

  // Cada método de pago lleva su propia aclaración de qué pasa después —
  // nunca una frase única al final que le asuma a todo el mundo el mismo
  // medio. Quien vaya a transferir manda comprobante; a quien paga con
  // Mercado Pago no se le pide nada, el cobro se acredita solo.
  const notaTransferencia = linkComprobante
    ? `Si transferís, mandame el comprobante por WhatsApp y te confirmo el lugar.`
    : `Si transferís, te confirmo el lugar apenas vea el pago acreditado.`
  const notaMercadoPago = `Con Mercado Pago el cobro se acredita solo — no hace falta que mandes nada, te confirmo el lugar apenas se acredite.`

  const bloquePagoTexto = params.pago.esInternacional
    ? [
        `Tu plan — ${params.pago.montoTexto}`,
        "",
        "Para pagar desde fuera de Argentina, escribime por WhatsApp y coordinamos la transferencia:",
        ...(linkCoordinarExterior ? [`wa.me/${WHATSAPP_CONTACTO}`] : []),
      ]
    : [
        `Por transferencia — ${params.pago.transferencia.montoTexto}`,
        `Alias: ${params.pago.transferencia.alias}`,
        `CVU: ${params.pago.transferencia.cvu}`,
        `Titular: ${params.pago.transferencia.titular}`,
        "",
        notaTransferencia,
        "",
        `Por Mercado Pago — ${params.pago.mercadopago.montoTexto}`,
        params.pago.mercadopago.link,
        "",
        notaMercadoPago,
      ]

  const bloquePagoHtml = params.pago.esInternacional
    ? `
      <div style="margin: 0 0 16px; padding: 16px; border: 1px solid #eadfc9; border-radius: 16px; background: #FFFCF7;">
        <p style="margin: 0 0 10px; font-weight: 700; color: #241F1C;">Tu plan — ${escapeHtml(params.pago.montoTexto)}</p>
        <p style="margin: 0; font-size: 14px; color: #5C5651;">
          Para pagar desde fuera de Argentina, escribime por WhatsApp y coordinamos la transferencia:${linkCoordinarExterior ? ` <a href="${linkCoordinarExterior}" style="color: #9a6218; font-weight: 700; text-decoration: none;">wa.me/${WHATSAPP_CONTACTO}</a>` : ""}
        </p>
      </div>
    `
    : `
      <div style="display: flex; gap: 12px; flex-wrap: wrap; margin: 0 0 16px;">
        <div style="flex: 1; min-width: 220px; padding: 16px; border: 1px solid #eadfc9; border-radius: 16px; background: #FFFCF7;">
          <p style="margin: 0 0 6px; font-weight: 700; color: #241F1C;">Por transferencia — ${escapeHtml(params.pago.transferencia.montoTexto)}</p>
          <p style="margin: 0 0 10px; font-size: 14px; color: #5C5651; line-height: 1.6;">
            Alias: ${escapeHtml(params.pago.transferencia.alias)}<br />
            CVU: ${escapeHtml(params.pago.transferencia.cvu)}<br />
            Titular: ${escapeHtml(params.pago.transferencia.titular)}
          </p>
          <p style="margin: 0; font-size: 13px; color: #5C5651;">${escapeHtml(notaTransferencia)}${linkComprobante ? ` <a href="${linkComprobante}" style="color: #9a6218; font-weight: 700; text-decoration: none;">wa.me/${WHATSAPP_CONTACTO}</a>` : ""}</p>
        </div>
        <div style="flex: 1; min-width: 220px; padding: 16px; border: 1px solid #eadfc9; border-radius: 16px; background: #FFFCF7;">
          <p style="margin: 0 0 6px; font-weight: 700; color: #241F1C;">Por Mercado Pago — ${escapeHtml(params.pago.mercadopago.montoTexto)}</p>
          <a href="${params.pago.mercadopago.link}" style="display: inline-block; margin: 0 0 10px; padding: 10px 16px; border-radius: 999px; background: #F9C33E; color: #241F1C; font-weight: 700; text-decoration: none; font-size: 14px;">
            Pagar con Mercado Pago
          </a>
          <p style="margin: 0; font-size: 13px; color: #5C5651;">${escapeHtml(notaMercadoPago)}</p>
        </div>
      </div>
    `

  const text = [
    `Hola ${nombre},`,
    "",
    "Recibimos tu inscripción a Proyecto In+Posible.",
    "",
    `Elegiste el plan: ${params.planPagoTexto}.`,
    "",
    "Esto es lo que entra en los tres meses:",
    ...LO_QUE_COMPRASTE.map((item) => `- ${item}`),
    "",
    "Los tres talleres en vivo son:",
    ...talleres.map((t) => `- ${t}, 19:30 hs`),
    "",
    AVISO_GRABACION,
    "",
    "Así podés pagar:",
    "",
    ...bloquePagoTexto,
    ...(avisoMesesSiguientes ? ["", avisoMesesSiguientes] : []),
    "",
    "En las próximas horas te llega el primer material de la inducción.",
    ...(linkComprobante ? ["", `Cualquier duda, escribime por WhatsApp: wa.me/${WHATSAPP_CONTACTO}`] : []),
  ].join("\n")

  const html = `
    <div style="margin: 0; padding: 32px 16px; background: #FBEFDC; font-family: Arial, sans-serif; color: #241F1C;">
      <div style="max-width: 640px; margin: 0 auto; background: #FFFCF7; border: 1px solid #eadfc9; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(77, 54, 18, 0.08);">
        <div style="padding: 32px 32px 20px; background: linear-gradient(135deg, #FFFCF7 0%, #FBEFDC 100%);">
          <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: #9A7415; font-weight: 700;">ENTHEOS</p>
          <h1 style="margin: 0 0 10px; font-size: 30px; line-height: 1.15; color: #241F1C;">Recibimos tu inscripción</h1>
          <p style="margin: 0; color: #5C5651; font-size: 16px; line-height: 1.5;">Plan elegido: ${escapeHtml(params.planPagoTexto)}</p>
        </div>

        <div style="padding: 28px 32px 32px; line-height: 1.7;">
          <p style="margin: 0 0 14px;">Hola ${escapeHtml(nombre)},</p>
          <p style="margin: 0 0 8px; font-weight: 700; color: #241F1C;">Esto es lo que entra en los tres meses:</p>
          <ul style="margin: 0 0 20px; padding-left: 20px; font-size: 14px; color: #5C5651; line-height: 1.7;">
            ${LO_QUE_COMPRASTE.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>

          <p style="margin: 0 0 8px; font-weight: 700; color: #241F1C;">Los tres talleres en vivo, 19:30 hs</p>
          <p style="margin: 0 0 8px; font-size: 14px; color: #5C5651;">
            ${talleres.map((t) => escapeHtml(t)).join("<br />")}
          </p>
          <p style="margin: 0 0 20px; font-size: 13px; color: #5C5651;">${escapeHtml(AVISO_GRABACION)}</p>

          <p style="margin: 0 0 12px; font-weight: 700; color: #241F1C;">Así podés pagar:</p>

          ${bloquePagoHtml}

          ${avisoMesesSiguientes ? `<p style="margin: 0 0 20px; font-size: 14px; color: #5C5651;">${escapeHtml(avisoMesesSiguientes)}</p>` : ""}

          <p style="margin: 0;">
            En las próximas horas te llega el primer material de la inducción, para llegar al primer taller con algo ya movido.
          </p>
        </div>
      </div>
    </div>
  `

  return {
    subject: "Tu inscripción a Proyecto In+Posible",
    text,
    html,
  }
}

function crearContenidoPreinscripcionAdmin(params: PreinscripcionAdminParams) {
  const p = obtenerPartesArgentina()
  const horaTexto = `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}/${p.year} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")} hs`

  const filas: Array<[string, string]> = [
    ["Recibido", horaTexto],
    ["Nombre", `${params.nombre} ${params.apellido}`],
    ["Email", params.email],
    ["WhatsApp", params.whatsapp],
    ["País", params.pais],
    ["¿Tiene proyecto?", params.tieneProyectoTexto],
    ["Proyecto", params.proyectoDescripcion || "(sin descripción)"],
    ["Plan de pago", params.planPagoTexto],
    ["Monto", params.montoTexto],
  ]

  const text = filas.map(([k, v]) => `${k}: ${v}`).join("\n")

  const html = `
    <div style="margin: 0; padding: 32px 16px; background: #f6efe2; font-family: Arial, sans-serif; color: #1f2933;">
      <div style="max-width: 640px; margin: 0 auto; background: #fffdf8; border: 1px solid #eadfc9; border-radius: 24px; overflow: hidden;">
        <div style="padding: 24px 32px; background: linear-gradient(135deg, rgba(250,244,229,1) 0%, rgba(255,250,240,1) 100%);">
          <p style="margin: 0 0 6px; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a6a2f; font-weight: 700;">Proyecto In+Posible</p>
          <h1 style="margin: 0; font-size: 24px; color: #18202a;">Nueva preinscripción</h1>
        </div>
        <div style="padding: 24px 32px 28px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            ${filas
              .map(
                ([k, v]) => `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0e6d2; color: #6b7280; width: 160px;">${escapeHtml(k)}</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0e6d2; color: #18202a;">${escapeHtml(v)}</td>
              </tr>
            `
              )
              .join("")}
          </table>
        </div>
      </div>
    </div>
  `

  return {
    subject: `Nueva preinscripción: ${params.nombre}`,
    text,
    html,
  }
}

function crearContenidoInvitacionCharlaIntro(params: CharlaIntroParams) {
  const url = appUrl()
  const nombre = params.nombre.trim() || "bienvenida/o"
  const subtitulo =
    "Escuela Norte para el Talento, el Entusiasmo y el Orden de los Sentidos"
  const tituloCharla = charlaIntroTitulo()
  const fechaCharla = charlaIntroFechaTexto()

  const textoFecha = fechaCharla ? `Fecha y horario: ${fechaCharla}` : ""

  const bloqueFecha = fechaCharla
    ? `
          <p style="margin: 0 0 10px;"><strong>Fecha y horario:</strong> ${escapeHtml(fechaCharla)}</p>
        `
    : ""

  const text = [
    `Hola ${nombre},`,
    "",
    "¡Ojalá estés teniendo un lindo día!",
    "",
    "En breve estarás recorriendo lógicas totalmente transformadoras y herramientas para apropiarte de todo eso que postergás, dejás esperando, te apurás o simplemente no creés posibles.",
    "",
    "¡Que la disfrutes y la aproveches!",
    "",
    "El ingreso a la grabación es por la misma vía que te enviamos antes: entrando con tu login a la plataforma.",
    "",
    "Disponibilidad limitada: desde el viernes 08 al domingo 10 de mayo",
    "",
    "Estamos atentos a cualquier duda que tengas y a cualquier cuestión que quieras continuar conversando.",
    "",
    `Acceso: ${url}/login`,
    `Participante: ${params.email}`,
    `Clave de acceso: ${params.password}`,
    textoFecha,
    "",
    "Atentamente,",
    "Nicolás Busico.",
  ]
    .filter(Boolean)
    .join("\n")

  const html = `
    <div style="margin: 0; padding: 32px 16px; background: #f6efe2; font-family: Arial, sans-serif; color: #1f2933;">
      <div style="max-width: 680px; margin: 0 auto; background: #fffdf8; border: 1px solid #eadfc9; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(77, 54, 18, 0.08);">
        <div style="padding: 32px 32px 20px; background: linear-gradient(135deg, rgba(250,244,229,1) 0%, rgba(255,250,240,1) 55%, rgba(248,237,210,1) 100%);">
          <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a6a2f; font-weight: 700;">ENTHEOS</p>
          <p style="margin: 0 0 10px; color: #6b7280; font-size: 16px; line-height: 1.5;">
            ${escapeHtml(subtitulo)}
          </p>
          <h1 style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 30px; font-weight: 600; line-height: 1.08; color: #18202a;">Grabación disponible</h1>
        </div>

        <div style="padding: 28px 32px 32px; line-height: 1.75;">
          <p style="margin: 0 0 14px;">Hola ${escapeHtml(nombre)},</p>
          <p style="margin: 0 0 16px;">
            ¡Ojalá estés teniendo un lindo día!
          </p>
          <p style="margin: 0 0 16px;">
            En breve estarás recorriendo lógicas totalmente transformadoras y herramientas para apropiarte de todo eso que postergás, dejás esperando, te apurás o simplemente no creés posibles.
          </p>

          <div style="margin: 0 0 22px; padding: 20px 22px; border-radius: 22px; background: #fff7ea; border: 1px solid #ead9b4;">
            <h2 style="margin: 0 0 10px; font-family: Georgia, 'Times New Roman', serif; font-size: 18px; font-weight: 600; line-height: 1.35; color: #18202a;">${escapeHtml(
              tituloCharla
            )}</h2>
            <p style="margin: 0; color: #6b7280; font-size: 15px; line-height: 1.6;">Disponibilidad limitada: desde el viernes 08 al domingo 10 de mayo</p>
          </div>

          <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.72; color: #1f2933; font-weight: 400; font-family: Arial, sans-serif;">
            ¡Que la disfrutes y la aproveches!
          </p>

          <p style="margin: 0 0 18px; font-size: 15px; line-height: 1.72; color: #1f2933; font-weight: 400; font-family: Arial, sans-serif;">
            El ingreso a la grabación es por la misma vía que te enviamos antes: entrando con tu login a la plataforma.
          </p>

          <p style="margin: 0 0 18px; font-size: 15px; line-height: 1.72; color: #1f2933; font-weight: 400; font-family: Arial, sans-serif;">
            Disponibilidad limitada: desde el viernes 08 al domingo 10 de mayo.
          </p>

          <p style="margin: 0 0 18px; font-size: 15px; line-height: 1.72; color: #1f2933; font-weight: 400; font-family: Arial, sans-serif;">
            Estamos atentos a cualquier duda que tengas y a cualquier cuestión que quieras continuar conversando.
          </p>

          <div style="border: 1px solid #e5dccb; border-radius: 18px; padding: 18px 20px; margin: 0 0 24px; background: #fffaf2;">
            <p style="margin: 0 0 10px;"><strong>Acceso:</strong> <a href="${url}/login">${url}/login</a></p>
            <p style="margin: 0 0 10px;"><strong>Participante:</strong> ${escapeHtml(params.email)}</p>
            <p style="margin: 0 0 10px;"><strong>Clave de acceso:</strong> ${escapeHtml(
              params.password
            )}</p>
            ${bloqueFecha}
          </div>

          <div style="margin: 24px 0 28px;">
            <a
              href="${url}/login"
              style="display: inline-block; padding: 14px 22px; border-radius: 999px; background: #dfad57; color: #ffffff; font-weight: 700; text-decoration: none;"
            >
              Ingresar a ENTHEOS
            </a>
          </div>

          <p style="margin: 0;">Atentamente,<br />Nicolás Busico.</p>
        </div>
      </div>
    </div>
  `

  return {
    subject:
      "Grabación charla introductoria: Las Claves no evidentes para gestionar eficazmente tu tiempo.",
    text,
    html,
  }
}

export async function enviarEmail({
  to,
  subject,
  text,
  html,
  attachments,
}: {
  to: string
  subject: string
  text: string
  html: string
  attachments?: EmailAttachment[]
}): Promise<MailingResult> {
  const resendApiKey = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM || process.env.RESEND_FROM
  const replyTo = process.env.MAIL_REPLY_TO || process.env.REPLY_TO

  if (!resendApiKey || !from) {
    return {
      enviado: false,
      motivo:
        "Mailing no configurado. Falta RESEND_API_KEY y/o MAIL_FROM en el entorno.",
    }
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(attachments?.length ? { attachments } : {}),
    }),
  })

  const detalle = await res.text().catch(() => "")

  if (!res.ok) {

    return {
      enviado: false,
      motivo: `No se pudo enviar el email. ${detalle}`,
    }
  }

  let proveedorId: string | null = null
  try {
    const parsed = JSON.parse(detalle) as { id?: string }
    proveedorId = parsed.id || null
  } catch {
    proveedorId = null
  }

  return {
    enviado: true,
    proveedor: "resend",
    proveedorId,
  }
}

export async function enviarBienvenidaUsuario(
  params: BienvenidaParams
): Promise<MailingResult> {
  const contenido = crearContenidoBienvenida(params)

  return enviarEmail({
    to: params.email,
    subject: contenido.subject,
    text: contenido.text,
    html: contenido.html,
  })
}

export async function enviarRecuperacionClaveUsuario(
  params: RecuperacionClaveParams
): Promise<MailingResult> {
  const contenido = crearContenidoRecuperacionClave(params)

  return enviarEmail({
    to: params.email,
    subject: contenido.subject,
    text: contenido.text,
    html: contenido.html,
  })
}

export async function enviarPreinscripcionParticipante(
  params: PreinscripcionParticipanteParams
): Promise<MailingResult> {
  const contenido = crearContenidoPreinscripcionParticipante(params)

  return enviarEmail({
    to: params.email,
    subject: contenido.subject,
    text: contenido.text,
    html: contenido.html,
  })
}

export async function enviarPreinscripcionAdmin(
  params: PreinscripcionAdminParams
): Promise<MailingResult> {
  const contenido = crearContenidoPreinscripcionAdmin(params)

  return enviarEmail({
    to: "nicolasbusico@entheosescuela.com",
    subject: contenido.subject,
    text: contenido.text,
    html: contenido.html,
  })
}

export async function enviarInvitacionCharlaIntro(
  params: CharlaIntroParams
): Promise<MailingResult> {
  const contenido = crearContenidoInvitacionCharlaIntro(params)

  return enviarEmail({
    to: params.email,
    subject: contenido.subject,
    text: contenido.text,
    html: contenido.html,
  })
}
