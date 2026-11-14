'use client'

import { useRef, useState } from 'react'

interface UseSubmitMutationResult<P, R> {
  readonly submit: (payload: P) => Promise<R>
  readonly isSubmitting: boolean
}

// Wraps an async mutation with an `isSubmitting` flag and a synchronous
// in-flight lock: two synchronous calls in the same React tick dedupe to a
// single mutation (the second caller receives the same in-flight promise), and
// `isSubmitting` always resets via `try/finally` even if the mutation throws.
// Shared by useRegisterPaciente / useUpdatePacienteIdentidad /
// useUpdateEtapaDiagnostico.
const useSubmitMutation = <P, R>(
  mutate: (payload: P) => Promise<R>,
): UseSubmitMutationResult<P, R> => {
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

export type { UseSubmitMutationResult }
export { useSubmitMutation }
