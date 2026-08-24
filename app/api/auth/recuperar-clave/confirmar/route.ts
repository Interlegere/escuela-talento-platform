import { NextResponse } from "next/server"
import { confirmarRecuperacionClave } from "@/lib/usuarios-plataforma"

const CLAVE_MIN_LARGO = 6

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const token = String(body?.token || "").trim()
    const password = String(body?.password || "")

    if (!token) {
      return NextResponse.json(
        { error: "Falta el link de recuperación." },
        { status: 400 }
      )
    }

    if (password.length < CLAVE_MIN_LARGO) {
      return NextResponse.json(
        { error: `La clave nueva debe tener al menos ${CLAVE_MIN_LARGO} caracteres.` },
        { status: 400 }
      )
    }

    const resultado = await confirmarRecuperacionClave(token, password)

    if (!resultado.ok) {
      const mensaje =
        resultado.error === "token_vencido"
          ? "Este link venció. Pedí uno nuevo desde la pantalla de recuperar clave."
          : "Este link no es válido. Pedí uno nuevo desde la pantalla de recuperar clave."

      return NextResponse.json({ error: mensaje }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error en /api/auth/recuperar-clave/confirmar:", error)
    return NextResponse.json(
      { error: "No se pudo actualizar la clave. Probá de nuevo en un rato." },
      { status: 500 }
    )
  }
}
