"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAppSession } from "@/components/auth/AppSessionProvider"
import type { ActivitySlug } from "@/lib/authz"
import { isDevelopmentPreviewEnabled } from "@/lib/dev-flags"

const DEFAULT_PREVIEW_RESOURCES: Recurso[] = []

type Recurso = {
  id: number
  slug: string
  nombre: string
  descripcion?: string | null
  tipo: string
  proveedor: string
  url?: string | null
  drive_file_id?: string | null
}

type UseActivityAccessOptions = {
  activitySlug: ActivitySlug
  previewEnabled?: boolean
  previewResources?: Recurso[]
}

async function leerRespuestaJson<T>(res: Response): Promise<T> {
  const raw = await res.text()

  if (!raw) {
    return {} as T
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return {
      error: `Respuesta no válida del servidor: ${raw}`,
    } as T
  }
}

export function useActivityAccess({
  activitySlug,
  previewEnabled = false,
  previewResources = DEFAULT_PREVIEW_RESOURCES,
}: UseActivityAccessOptions) {
  const { data: session, status, error } = useAppSession()
  const router = useRouter()

  const previewActivo = previewEnabled && isDevelopmentPreviewEnabled()
  const [acceso, setAcceso] = useState<boolean | null>(null)
  const [motivo, setMotivo] = useState<string | null>(null)
  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [cargandoAcceso, setCargandoAcceso] = useState(true)
  const [sesionDemorada, setSesionDemorada] = useState(false)

  const nombre = session?.user?.name || "Participante"
  const email = session?.user?.email || ""
  const sesionLista = status !== "loading" || previewActivo

  useEffect(() => {
    if (status !== "loading") {
      setSesionDemorada(false)
      return
    }

    const timeout = window.setTimeout(() => {
      setSesionDemorada(true)
    }, 4000)

    return () => window.clearTimeout(timeout)
  }, [status])

  useEffect(() => {
    if (status !== "unauthenticated") return
    if (previewActivo) return

    router.replace("/login")
  }, [previewActivo, router, status])

  useEffect(() => {
    const cargarAcceso = async () => {
      if (!email) {
        if (previewActivo) {
          setAcceso(true)
          setMotivo("modo_prueba_sin_sesion")
          setRecursos(previewResources)
        } else {
          setAcceso(false)
          setMotivo("sin_email")
          setRecursos([])
        }

        setCargandoAcceso(false)
        return
      }

      try {
        setCargandoAcceso(true)

        const res = await fetch("/api/actividades/recursos-disponibles", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            actividadSlug: activitySlug,
            participanteEmail: email,
          }),
        })

        const data = await leerRespuestaJson<{
          acceso?: boolean
          motivo?: string | null
          recursos?: Recurso[]
          error?: string
        }>(res)

        if (!res.ok) {
          if (previewActivo) {
            setAcceso(true)
            setMotivo("modo_prueba")
            setRecursos(previewResources)
            return
          }

          setAcceso(false)
          setMotivo(data.error || "error")
          setRecursos([])
          return
        }

        const recursosFinales = [...(data.recursos || [])]

        if (previewActivo) {
          for (const recurso of previewResources) {
            if (!recursosFinales.some((item) => item.slug === recurso.slug)) {
              recursosFinales.push(recurso)
            }
          }

          setAcceso(true)
          setMotivo("modo_prueba")
          setRecursos(recursosFinales)
          return
        }

        setAcceso(Boolean(data.acceso))
        setMotivo(data.motivo || null)
        setRecursos(recursosFinales)
      } catch {
        if (previewActivo) {
          setAcceso(true)
          setMotivo("modo_prueba")
          setRecursos(previewResources)
        } else {
          setAcceso(false)
          setMotivo("error")
          setRecursos([])
        }
      } finally {
        setCargandoAcceso(false)
      }
    }

    if (email) {
      void cargarAcceso()
    } else if (status !== "loading") {
      void cargarAcceso()
    }
  }, [activitySlug, email, previewActivo, previewResources, status])

  return {
    session,
    status,
    error,
    nombre,
    email,
    acceso,
    motivo,
    recursos,
    cargandoAcceso,
    sesionDemorada,
    sesionLista,
  }
}
