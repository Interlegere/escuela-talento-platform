import { NextResponse } from "next/server"
import { sincronizarFechasDesdeGoogle } from "@/lib/agenda-reconciliacion"
import { enviarEmail } from "@/lib/mailing"

const INFORME_DESTINATARIO_EMAIL = "nicolasbusico@entheosescuela.com"

function crearInformeTexto(cambios: Awaited<ReturnType<typeof sincronizarFechasDesdeGoogle>>["cambios"]) {
  const lineas = cambios.map((c) => {
    const aviso =
      c.actividadSlug === "mentorias" || c.actividadSlug === "terapia"
        ? c.mailEnviado
          ? "aviso enviado al participante"
          : c.mailError
            ? `no se pudo avisar al participante: ${c.mailError}`
            : "sin participante para avisar"
        : "reunión grupal, sin aviso individual"

    return `- "${c.titulo}" (${c.actividadSlug || "sin actividad"}): ${c.fechaAnterior} ${c.horaAnterior} → ${c.fechaNueva} ${c.horaNueva} (${aviso})`
  })

  return [
    `Se reprogramaron ${cambios.length} encuentro(s) en la plataforma porque cambiaron de fecha u hora en Google Calendar:`,
    "",
    ...lineas,
  ].join("\n")
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = req.headers.get("authorization")

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const resultado = await sincronizarFechasDesdeGoogle()

    // Solo se avisa si hubo algo para avisar — un mail vacío todos los
    // días sería ruido, a diferencia del informe diario del agente de
    // Entusiasmento, que sí tiene sentido siempre (reporta también "no
    // tocaba" explícitamente). Acá "no hubo cambios" es el caso normal.
    let informeEnviado = false

    if (resultado.cambios.length > 0) {
      const envio = await enviarEmail({
        to: INFORME_DESTINATARIO_EMAIL,
        subject: `Agenda: ${resultado.cambios.length} encuentro(s) reprogramado(s) desde Google Calendar`,
        text: crearInformeTexto(resultado.cambios),
        html: `<pre style="font-family: inherit; white-space: pre-wrap;">${crearInformeTexto(
          resultado.cambios
        )}</pre>`,
      })
      informeEnviado = envio.enviado === true
    }

    return NextResponse.json({
      ok: true,
      rango: resultado.rango,
      cambios: resultado.cambios,
      informeEnviado,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno sincronizando la agenda desde Google Calendar",
        detalle: String(error),
      },
      { status: 500 }
    )
  }
}
