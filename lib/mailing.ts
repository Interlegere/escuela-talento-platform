type BienvenidaParams = {
  nombre: string
  email: string
  password: string
  role: string
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

export async function enviarBienvenidaUsuario(
  params: BienvenidaParams
): Promise<MailingResult> {
  const resendApiKey = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM || process.env.RESEND_FROM

  if (!resendApiKey || !from) {
    return {
      enviado: false,
      motivo:
        "Mailing no configurado. Falta RESEND_API_KEY y/o MAIL_FROM en el entorno.",
    }
  }

  const contenido = crearContenidoBienvenida(params)

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.email],
      subject: contenido.subject,
      text: contenido.text,
      html: contenido.html,
    }),
  })

  if (!res.ok) {
    const detalle = await res.text().catch(() => "")

    return {
      enviado: false,
      motivo: `No se pudo enviar el email de bienvenida. ${detalle}`,
    }
  }

  return {
    enviado: true,
    proveedor: "resend",
  }
}
