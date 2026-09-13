import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/authz"
import { eliminarUsuarioPlataformaCompleto } from "@/lib/admin-eliminar-usuario"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

type Body = {
  id?: string
}

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("admin.access")

    if ("response" in auth) {
      return auth.response
    }

    const body: Body = await req.json()
    const id = String(body.id || "").trim()

    if (!id) {
      return NextResponse.json(
        { error: "Falta el id de la persona a eliminar." },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const { data: usuario, error: usuarioError } = await supabase
      .from("usuarios_plataforma")
      .select("id, email, role, activo")
      .eq("id", id)
      .maybeSingle<{ id: string; email: string; role: string; activo: boolean }>()

    if (usuarioError || !usuario) {
      return NextResponse.json({ error: "No se encontró a esa persona." }, { status: 404 })
    }

    if (usuario.activo) {
      return NextResponse.json(
        {
          error:
            "Solo se puede eliminar a alguien que ya está inactivo. Desactivalo primero.",
        },
        { status: 400 }
      )
    }

    if (usuario.role !== "participante") {
      return NextResponse.json(
        {
          error: "Esta acción es solo para participantes, no para admin/colaborador.",
        },
        { status: 400 }
      )
    }

    const resultado = await eliminarUsuarioPlataformaCompleto({
      id: usuario.id,
      email: usuario.email,
      eliminadoPorEmail: auth.actor.email,
    })

    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      conteos: resultado.conteos,
      archivosBorrados: resultado.archivosBorrados,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno eliminando a la persona.", detalle: String(error) },
      { status: 500 }
    )
  }
}
