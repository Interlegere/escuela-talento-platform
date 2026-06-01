"use client"

import { Dispatch, SetStateAction, useEffect, useState } from "react"

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
  const [value, setValue] = useState<T>(() => {
    if (!enabled || !key || typeof window === "undefined") {
      return initialValue
    }

    try {
      const raw = window.localStorage.getItem(key)
      return raw !== null ? deserialize(raw) : initialValue
    } catch {
      return initialValue
    }
  })
  const [hydrated, setHydrated] = useState(
    !enabled || !key || typeof window !== "undefined"
  )

  useEffect(() => {
    if (!enabled || !key || typeof window === "undefined") return

    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) {
        setValue(deserialize(raw))
      }
    } catch {
      return
    } finally {
      setHydrated(true)
    }
  }, [deserialize, enabled, key])

  useEffect(() => {
    if (!enabled || !key || !hydrated || typeof window === "undefined") return

    try {
      window.localStorage.setItem(key, serialize(value))
    } catch {
      return
    }
  }, [enabled, hydrated, key, serialize, value])

  return [value, setValue]
}
