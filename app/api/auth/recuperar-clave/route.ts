import { NextResponse } from "next/server"
import { appUrl, enviarRecuperacionClaveUsuario } from "@/lib/mailing"
import { solicitarRecuperacionClave } from "@/lib/usuarios-plataforma"

const MENSAJE_GENERICO =
  "Si el email corresponde a una cuenta activa, te mandamos un mail con el link para elegir una clave nueva."

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body?.email || "").trim()

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Ingresá un email válido." },
        { status: 400 }
      )
    }

    // Siempre se devuelve el mismo mensaje genérico, exista o no la cuenta —
    // así no se puede usar este endpoint para averiguar qué emails están
    // registrados en la plataforma.
    const resultado = await solicitarRecuperacionClave(email)

    if (resultado.generado) {
      const resetUrl = `${appUrl()}/recuperar-clave/confirmar?token=${resultado.token}`

      const envio = await enviarRecuperacionClaveUsuario({
        nombre: resultado.nombre,
        email: resultado.email,
        resetUrl,
      })

      if (!envio.enviado) {
        console.error("No se pudo enviar el mail de recuperación de clave:", envio.motivo)
      }
    }

    return NextResponse.json({ ok: true, mensaje: MENSAJE_GENERICO })
  } catch (error) {
    console.error("Error en /api/auth/recuperar-clave:", error)
    // Mismo mensaje genérico también ante un error interno, por la misma
    // razón: no dar ninguna señal distinta según lo que haya pasado del lado
    // del servidor.
    return NextResponse.json({ ok: true, mensaje: MENSAJE_GENERICO })
  }
}
