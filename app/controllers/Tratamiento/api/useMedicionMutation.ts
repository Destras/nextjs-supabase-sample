'use client'

import { useRef, useState } from 'react'

interface UseMedicionMutationResult<P, R> {
  readonly submit: (payload: P) => Promise<R>
  readonly isSubmitting: boolean
}

// Deliberate duplicate of Paciente/api/useSubmitMutation.ts: that hook is NOT
// exported from Paciente/index.ts, and reaching into another entity's
// internals violates controllers Rule 1/3 (design §4.3). Promoting it to a
// shared module is a cross-entity refactor, out of scope for this change.
//
// Wraps an async mutation with an `isSubmitting` flag and a synchronous
// in-flight lock: two synchronous calls in the same React tick dedupe to a
// single mutation (the second caller receives the same in-flight promise),
// and `isSubmitting` always resets via `try/finally` even if the mutation
// throws.
const useMedicionMutation = <P, R>(
  mutate: (payload: P) => Promise<R>,
): UseMedicionMutationResult<P, R> => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inFlightRef = useRef<Promise<R> | null>(null)

  const submit = (payload: P): Promise<R> => {
    if (inFlightRef.current) return inFlightRef.current

    setIsSubmitting(true)
    const promise = (async () => {
      try {
        return await mutate(payload)
      } finally {
        setIsSubmitting(false)
        inFlightRef.current = null
      }
    })()
    inFlightRef.current = promise
    return promise
  }

  return { submit, isSubmitting }
}

export type { UseMedicionMutationResult }
export { useMedicionMutation }
