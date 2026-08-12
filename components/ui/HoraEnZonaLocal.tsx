"use client"

import { useMemo } from "react"
import {
  convertirFechaHoraArgentinaAZona,
  nombreCortoZona,
  ZONA_ARGENTINA,
} from "@/lib/fechas"

type Props = {
  fecha: string
  hora: string
  className?: string
}

export default function HoraEnZonaLocal({ fecha, hora, className }: Props) {
  const zonaLocal = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || ZONA_ARGENTINA
    } catch {
      return ZONA_ARGENTINA
    }
  }, [])

  if (!fecha || !hora) {
    return null
  }

  if (zonaLocal === ZONA_ARGENTINA) {
    return <span className={className}>{hora} hs (Argentina)</span>
  }

  const convertido = convertirFechaHoraArgentinaAZona(fecha, hora, zonaLocal)

  if (!convertido) {
    return <span className={className}>{hora} hs (Argentina)</span>
  }

  return (
    <span className={className}>
      {convertido.hora} hs tu hora ({nombreCortoZona(zonaLocal)})
      <span className="ml-1 text-xs text-gray-500">({hora} hs Argentina)</span>
    </span>
  )
}
