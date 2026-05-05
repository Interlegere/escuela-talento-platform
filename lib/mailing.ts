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

type MailingResult =
  | { enviado: true; proveedor: string }
  | { enviado: false; motivo: string }

function appUrl() {
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

function crearContenidoBienvenida(params: BienvenidaParams) {
  const url = appUrl()
  const nombre = params.nombre.trim() || "bienvenida/o"
  const role = textoRol(params.role)
  const subtitulo =
    "Escuela Nodo para el THalento, el Entusiasmo y el Orden de los Sentidos"

  const text = [
    `Hola ${nombre},`,
    "",
    "Bienvenido/a a Entheos.",
    subtitulo,
    "",
    "Te damos la bienvenida a la plataforma.",
    "",
    `Acceso: ${url}/login`,
    `Usuario: ${params.email}`,
    `Contraseña inicial: ${params.password}`,
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
          <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a6a2f; font-weight: 700;">Entheos</p>
          <h1 style="margin: 0 0 10px; font-size: 32px; line-height: 1.15; color: #18202a;">Bienvenido/a a Entheos</h1>
          <p style="margin: 0; color: #6b7280; font-size: 16px; line-height: 1.5;">
            ${escapeHtml(subtitulo)}
          </p>
        </div>

        <div style="padding: 28px 32px 32px; line-height: 1.7;">
          <p style="margin: 0 0 14px;">Hola ${escapeHtml(nombre)},</p>
          <p style="margin: 0 0 16px;">
            Te damos la bienvenida a la plataforma. Ya podés ingresar con tus datos y comenzar tu recorrido dentro de Entheos.
          </p>

          <div style="margin: 24px 0 28px;">
            <a
              href="${url}/login"
              style="display: inline-block; padding: 14px 22px; border-radius: 999px; background: #c98b1b; color: #ffffff; font-weight: 700; text-decoration: none;"
            >
              Ingresar a Entheos
            </a>
          </div>

          <div style="border: 1px solid #e5dccb; border-radius: 18px; padding: 18px 20px; margin: 0 0 24px; background: #fffaf2;">
            <p style="margin: 0 0 10px;"><strong>Acceso:</strong> <a href="${url}/login">${url}/login</a></p>
            <p style="margin: 0 0 10px;"><strong>Usuario:</strong> ${escapeHtml(params.email)}</p>
            <p style="margin: 0 0 10px;"><strong>Contraseña inicial:</strong> ${escapeHtml(params.password)}</p>
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
    subject: "Bienvenido/a a Entheos",
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
  const subtituloCharla = charlaIntroSubtitulo()
  const fechaCharla = charlaIntroFechaTexto()
  const meetUrl = charlaIntroMeetUrl()

  const textoFecha = fechaCharla ? `Fecha y horario: ${fechaCharla}` : ""
  const textoMeet = meetUrl
    ? `Acceso directo a la videollamada: ${meetUrl}`
    : "El acceso a la videollamada estará disponible dentro de Campus."

  const bloqueMeet = meetUrl
    ? `
          <p style="margin: 0 0 10px;"><strong>Videollamada:</strong> <a href="${meetUrl}">${meetUrl}</a></p>
        `
    : `
          <p style="margin: 0 0 10px;"><strong>Videollamada:</strong> el acceso va a estar disponible dentro de Campus.</p>
        `

  const bloqueFecha = fechaCharla
    ? `
          <p style="margin: 0 0 10px;"><strong>Fecha y horario:</strong> ${escapeHtml(fechaCharla)}</p>
        `
    : ""

  const text = [
    `Hola ${nombre},`,
    "",
    "¡Bienvenido/a a Entheos!",
    subtitulo,
    "",
    "Si estás recibiendo este mail es porque te inscribiste a la charla introductoria gratuita:",
    "",
    tituloCharla,
    subtituloCharla,
    "",
    "¡Tu lugar ya está confirmado!",
    "",
    'Antes de ingresar, quiero que tengas algo presente: "el problema no es que te falte tiempo, es qué te sobra... que te falta tiempo"',
    "Lo profundizaremos con otras claves que te ayudarán a mover los hilos no evidentes que transforman todo en tu vida.",
    "",
    "Y una pregunta para desde antes ir resignificando la estructura:",
    "",
    "¿Qué es lo que hoy estás dejando de lado por sentir que no tenés tiempo?",
    "",
    "Para ingresar a la charla, entrá a la plataforma con tu usuario y tu clave de acceso. Una vez dentro de Campus vas a encontrar el acceso a la videollamada.",
    textoFecha,
    textoMeet,
    `Acceso: ${url}/login`,
    `Usuario: ${params.email}`,
    `Clave de acceso: ${params.password}`,
    "",
    "¡Nos vemos pronto!",
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
          <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a6a2f; font-weight: 700;">Entheos</p>
          <h1 style="margin: 0 0 10px; font-family: Georgia, 'Times New Roman', serif; font-size: 30px; font-weight: 600; line-height: 1.08; color: #18202a;">¡Bienvenido/a!</h1>
          <p style="margin: 0; color: #6b7280; font-size: 16px; line-height: 1.5;">
            ${escapeHtml(subtitulo)}
          </p>
        </div>

        <div style="padding: 28px 32px 32px; line-height: 1.75;">
          <p style="margin: 0 0 14px;">Hola ${escapeHtml(nombre)},</p>
          <p style="margin: 0 0 16px;">
            Si estás recibiendo este mail es porque te inscribiste a la charla introductoria gratuita:
          </p>

          <div style="margin: 0 0 22px; padding: 20px 22px; border-radius: 22px; background: #fff7ea; border: 1px solid #ead9b4;">
            <h2 style="margin: 0 0 10px; font-family: Georgia, 'Times New Roman', serif; font-size: 18px; font-weight: 600; line-height: 1.35; color: #18202a;">${escapeHtml(
              tituloCharla
            )}</h2>
            <p style="margin: 0; color: #7f5d1f; font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: 17px; line-height: 1.45;">${escapeHtml(
              subtituloCharla
            )}</p>
          </div>

          <p style="margin: 0 0 18px; font-weight: 700;">¡Tu lugar ya está confirmado!</p>

          <p style="margin: 0 0 16px;">
            Antes de ingresar, quiero que tengas algo presente:<br />
            <span style="display: inline-block; margin-top: 8px; font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: 14px; line-height: 1.7; color: #7a6540;">
              "el problema no es que te falte tiempo, es qué te sobra... que te falta tiempo"
            </span>
          </p>

          <p style="margin: 0 0 16px;">
            Lo profundizaremos con otras claves que te ayudarán a mover los hilos no evidentes que transforman todo en tu vida.
          </p>

          <p style="margin: 0 0 10px;">Y una pregunta para desde antes ir resignificando la estructura:</p>
          <p style="margin: 0 0 20px; font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: 21px; line-height: 1.45; color: #6a4d22;">
            ¿Qué es lo que hoy estás dejando de lado por sentir que no tenés tiempo?
          </p>

          <p style="margin: 0 0 18px;">
            Para ingresar a la charla, entrá a la plataforma con tu usuario y tu clave de acceso. Una vez dentro de Campus vas a encontrar el acceso a la videollamada.
          </p>

          <div style="border: 1px solid #e5dccb; border-radius: 18px; padding: 18px 20px; margin: 0 0 24px; background: #fffaf2;">
            <p style="margin: 0 0 10px;"><strong>Acceso:</strong> <a href="${url}/login">${url}/login</a></p>
            <p style="margin: 0 0 10px;"><strong>Usuario:</strong> ${escapeHtml(params.email)}</p>
            <p style="margin: 0 0 10px;"><strong>Clave de acceso:</strong> ${escapeHtml(
              params.password
            )}</p>
            ${bloqueFecha}
            ${bloqueMeet}
          </div>

          <div style="margin: 24px 0 28px;">
            <a
              href="${url}/login"
              style="display: inline-block; padding: 14px 22px; border-radius: 999px; background: #c98b1b; color: #ffffff; font-weight: 700; text-decoration: none;"
            >
              Ingresar a Entheos
            </a>
          </div>

          <p style="margin: 0 0 10px;">¡Nos vemos pronto!</p>
          <p style="margin: 0;">Atentamente,<br />Nicolás Busico.</p>
        </div>
      </div>
    </div>
  `

  return {
    subject: "Bienvenido/a a Entheos",
    text,
    html,
  }
}

async function enviarEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string
  subject: string
  text: string
  html: string
}): Promise<MailingResult> {
  const resendApiKey = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM || process.env.RESEND_FROM

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
    }),
  })

  if (!res.ok) {
    const detalle = await res.text().catch(() => "")

    return {
      enviado: false,
      motivo: `No se pudo enviar el email. ${detalle}`,
    }
  }

  return {
    enviado: true,
    proveedor: "resend",
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
