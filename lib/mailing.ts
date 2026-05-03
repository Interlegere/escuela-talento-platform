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

  const text = [
    `Hola ${nombre},`,
    "",
    "Te damos la bienvenida a la plataforma de la Escuela.",
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
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2933;">
      <h1 style="font-size: 24px; margin: 0 0 16px;">Bienvenida/o a la Escuela</h1>
      <p>Hola ${escapeHtml(nombre)},</p>
      <p>Te damos la bienvenida a la plataforma de la Escuela.</p>
      <div style="border: 1px solid #e5dccb; border-radius: 16px; padding: 16px; margin: 20px 0; background: #fffaf2;">
        <p><strong>Acceso:</strong> <a href="${url}/login">${url}/login</a></p>
        <p><strong>Usuario:</strong> ${escapeHtml(params.email)}</p>
        <p><strong>Contraseña inicial:</strong> ${escapeHtml(params.password)}</p>
        <p><strong>Rol:</strong> ${escapeHtml(role)}</p>
      </div>
      <p>Por seguridad, conservá estas credenciales y avisá si necesitás cambiarlas.</p>
      <p>Nos encontramos dentro de la plataforma.</p>
    </div>
  `

  return {
    subject: "Bienvenida/o a la plataforma de la Escuela",
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

