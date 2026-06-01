"use client"

import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

type Options<T> = {
  enabled?: boolean
  serialize?: (value: T) => string
  deserialize?: (value: string) => T
}

export function usePersistentState<T>(
  key: string,
  initialValue: T,
  options: Options<T> = {}
): [T, Dispatch<SetStateAction<T>>] {
  const {
    enabled = true,
    serialize = JSON.stringify,
    deserialize = JSON.parse as (value: string) => T,
  } = options
  const puedeEscribirRef = useRef(false)

  const [value, setValue] = useState<T>(() => {
    if (!enabled || !key || typeof window === "undefined") {
      puedeEscribirRef.current = false
      return initialValue
    }

    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) {
        const parsed = deserialize(raw)
        puedeEscribirRef.current = true
        return parsed
      }

      puedeEscribirRef.current = false
      return initialValue
    } catch {
      puedeEscribirRef.current = false
      if (process.env.NODE_ENV !== "production") {
        console.warn(`No se pudo leer localStorage para ${key}.`)
      }
      return initialValue
    }
  })
  const [hydrated, setHydrated] = useState(!enabled || !key)

  useEffect(() => {
    if (!enabled || !key || typeof window === "undefined") {
      puedeEscribirRef.current = false
      setHydrated(true)
      return
    }

    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) {
        setValue(deserialize(raw))
        puedeEscribirRef.current = true
      } else {
        setValue(initialValue)
        puedeEscribirRef.current = false
      }
    } catch {
      setValue(initialValue)
      puedeEscribirRef.current = false
      if (process.env.NODE_ENV !== "production") {
        console.warn(`No se pudo hidratar localStorage para ${key}.`)
      }
    } finally {
      setHydrated(true)
    }
  }, [deserialize, enabled, initialValue, key])

  const setPersistentValue: Dispatch<SetStateAction<T>> = useCallback((next) => {
    puedeEscribirRef.current = true
    setValue(next)
  }, [])

  useEffect(() => {
    if (
      !enabled ||
      !key ||
      !hydrated ||
      !puedeEscribirRef.current ||
      typeof window === "undefined"
    ) {
      return
    }

    try {
      window.localStorage.setItem(key, serialize(value))
    } catch {
      return
    }
  }, [enabled, hydrated, key, serialize, value])

  return [value, setPersistentValue]
}
