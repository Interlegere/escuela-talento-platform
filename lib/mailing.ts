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
    "Escuela Nodo para el THalento, el Entusiasmo y el Orden de los Sentidos"

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

function crearContenidoPreinscripcionParticipante(params: PreinscripcionParticipanteParams) {
  const nombre = params.nombre.trim() || "hola"
  const talleres = [
    "Lunes 14 de septiembre",
    "Lunes 12 de octubre",
    "Lunes 9 de noviembre",
  ]

  const bloquePago = params.pago.esInternacional
    ? `
      <div style="margin: 0 0 16px; padding: 16px; border: 1px solid #eadfc9; border-radius: 16px; background: #fffdf8;">
        <p style="margin: 0 0 6px; font-weight: 700; color: #18202a;">Transferencia internacional — ${escapeHtml(params.pago.montoTexto)}</p>
        <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.6;">
          Titular: ${escapeHtml(params.pago.titular)}<br />
          Banco: ${escapeHtml(params.pago.banco)}<br />
          Tipo de cuenta: ${escapeHtml(params.pago.tipoCuenta)}<br />
          Cuenta: ${escapeHtml(params.pago.cuenta)}<br />
          Ruta: ${escapeHtml(params.pago.ruta)}<br />
          Dirección: ${escapeHtml(params.pago.direccion)}
        </p>
      </div>
    `
    : `
      <div style="display: flex; gap: 12px; flex-wrap: wrap; margin: 0 0 16px;">
        <div style="flex: 1; min-width: 220px; padding: 16px; border: 1px solid #eadfc9; border-radius: 16px; background: #fffdf8;">
          <p style="margin: 0 0 6px; font-weight: 700; color: #18202a;">Por transferencia — ${escapeHtml(params.pago.transferencia.montoTexto)}</p>
          <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.6;">
            Alias: ${escapeHtml(params.pago.transferencia.alias)}<br />
            CVU: ${escapeHtml(params.pago.transferencia.cvu)}<br />
            Titular: ${escapeHtml(params.pago.transferencia.titular)}
          </p>
        </div>
        <div style="flex: 1; min-width: 220px; padding: 16px; border: 1px solid #eadfc9; border-radius: 16px; background: #fffdf8;">
          <p style="margin: 0 0 6px; font-weight: 700; color: #18202a;">Por Mercado Pago — ${escapeHtml(params.pago.mercadopago.montoTexto)}</p>
          <p style="margin: 0 0 10px; font-size: 14px; color: #4b5563;">Pagás con tarjeta o el medio que prefieras.</p>
          <a href="${params.pago.mercadopago.link}" style="display: inline-block; padding: 10px 16px; border-radius: 999px; background: #c98b1b; color: #ffffff; font-weight: 700; text-decoration: none; font-size: 14px;">
            Pagar con Mercado Pago
          </a>
        </div>
      </div>
    `

  const text = [
    `Hola ${nombre},`,
    "",
    "Ya reservamos tu lugar en Proyecto In+Posible.",
    "",
    `Elegiste el plan: ${params.planPagoTexto}.`,
    "",
    "Los tres talleres en vivo son:",
    ...talleres.map((t) => `- ${t}, 19 hs`),
    "",
    "En las próximas horas te llega el primer material de la inducción.",
  ].join("\n")

  const html = `
    <div style="margin: 0; padding: 32px 16px; background: #f6efe2; font-family: Arial, sans-serif; color: #1f2933;">
      <div style="max-width: 640px; margin: 0 auto; background: #fffdf8; border: 1px solid #eadfc9; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(77, 54, 18, 0.08);">
        <div style="padding: 32px 32px 20px; background: linear-gradient(135deg, rgba(250,244,229,1) 0%, rgba(255,250,240,1) 55%, rgba(248,237,210,1) 100%);">
          <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a6a2f; font-weight: 700;">ENTHEOS</p>
          <h1 style="margin: 0 0 10px; font-size: 30px; line-height: 1.15; color: #18202a;">Tu lugar en Proyecto In+Posible</h1>
          <p style="margin: 0; color: #6b7280; font-size: 16px; line-height: 1.5;">Plan elegido: ${escapeHtml(params.planPagoTexto)}</p>
        </div>

        <div style="padding: 28px 32px 32px; line-height: 1.7;">
          <p style="margin: 0 0 14px;">Hola ${escapeHtml(nombre)},</p>
          <p style="margin: 0 0 20px;">
            Reservamos tu lugar. Así podés señarlo:
          </p>

          ${bloquePago}

          <p style="margin: 0 0 8px; font-weight: 700; color: #18202a;">Los tres talleres en vivo, 19 hs</p>
          <p style="margin: 0 0 20px; font-size: 14px; color: #4b5563;">
            ${talleres.map((t) => escapeHtml(t)).join("<br />")}
          </p>

          <p style="margin: 0;">
            En las próximas horas te llega el primer material de la inducción, para llegar al primer taller con algo ya movido.
          </p>
        </div>
      </div>
    </div>
  `

  return {
    subject: "Tu lugar en Proyecto In+Posible",
    text,
    html,
  }
}

function crearContenidoPreinscripcionAdmin(params: PreinscripcionAdminParams) {
  const filas: Array<[string, string]> = [
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
    "Escuela Nodo para el Thalento, el Entusiasmo y el Orden de los Sentidos"
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
    `Usuario: ${params.email}`,
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
            <p style="margin: 0 0 10px;"><strong>Usuario:</strong> ${escapeHtml(params.email)}</p>
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
