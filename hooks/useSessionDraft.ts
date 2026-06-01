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
  isEmpty?: (value: T) => boolean
}

type DraftState<T> = {
  value: T
  setValue: Dispatch<SetStateAction<T>>
  dirty: boolean
  clearDraft: () => void
  hydrateFromServer: (serverValue: T) => void
}

export function useSessionDraft<T>(
  key: string,
  initialValue: T,
  options: Options<T> = {}
): DraftState<T> {
  const {
    enabled = true,
    serialize = JSON.stringify,
    deserialize = JSON.parse as (value: string) => T,
    isEmpty,
  } = options
  const [value, setValueState] = useState<T>(initialValue)
  const [dirty, setDirty] = useState(false)
  const initialValueRef = useRef(initialValue)
  const dirtyRef = useRef(dirty)

  useEffect(() => {
    initialValueRef.current = initialValue
  }, [initialValue])

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  useEffect(() => {
    if (!enabled || !key || typeof window === "undefined") return

    try {
      const raw = window.sessionStorage.getItem(key)
      if (raw !== null) {
        setValueState(deserialize(raw))
        dirtyRef.current = true
        setDirty(true)
        return
      }

      setValueState(initialValueRef.current)
      dirtyRef.current = false
      setDirty(false)
    } catch {
      setValueState(initialValueRef.current)
      dirtyRef.current = false
      setDirty(false)
    }
  }, [deserialize, enabled, key])

  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (next) => {
      setValueState((prev) => {
        const resolved =
          typeof next === "function"
            ? (next as (previous: T) => T)(prev)
            : next

        const empty = isEmpty ? isEmpty(resolved) : false
        dirtyRef.current = !empty
        setDirty(!empty)

        if (enabled && key && typeof window !== "undefined") {
          try {
            if (empty) {
              window.sessionStorage.removeItem(key)
            } else {
              window.sessionStorage.setItem(key, serialize(resolved))
            }
          } catch {
            return resolved
          }
        }

        return resolved
      })
    },
    [enabled, isEmpty, key, serialize]
  )

  const clearDraft = useCallback(() => {
    dirtyRef.current = false
    setDirty(false)

    if (!enabled || !key || typeof window === "undefined") return

    try {
      window.sessionStorage.removeItem(key)
    } catch {
      return
    }
  }, [enabled, key])

  const hydrateFromServer = useCallback(
    (serverValue: T) => {
      setValueState((current) => {
        if (dirtyRef.current) {
          return current
        }

        return serverValue
      })
    },
    []
  )

  return {
    value,
    setValue,
    dirty,
    clearDraft,
    hydrateFromServer,
  }
}
