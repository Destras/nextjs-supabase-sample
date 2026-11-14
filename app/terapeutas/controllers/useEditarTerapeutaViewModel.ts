'use client'

import { useState, useEffect } from 'react'
import { useUpdateTerapeuta } from '@/app/controllers/Terapeuta'
import type { Terapeuta } from '@/app/controllers/Terapeuta'

interface EditarTerapeutaViewModel {
  readonly nombre: string
  readonly telefono: string
  readonly nombreError: string | null
  readonly submitError: string | null
  readonly isSubmitting: boolean
  readonly onNombreChange: (value: string) => void
  readonly onTelefonoChange: (value: string) => void
  readonly onSubmit: () => Promise<{ ok: boolean }>
  readonly onReset: (initial?: { nombre: string; telefono: string }) => void
}

const mapErrorToMessage = (error: string | null): string => {
  if (error === 'nombre_vacio') {
    return 'El nombre no puede estar vacío.'
  }
  return 'No se pudo actualizar el terapeuta. Intentá de nuevo.'
}

const useEditarTerapeutaViewModel = (
  target: Terapeuta | null,
): EditarTerapeutaViewModel => {
  const [nombre, setNombre] = useState(target?.profile.name ?? '')
  const [telefono, setTelefono] = useState(target?.telefono ?? '')
  const [nombreError, setNombreError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { mutate, error } = useUpdateTerapeuta()

  useEffect(() => {
    if (target) {
      setNombre(target.profile.name)
      setTelefono(target.telefono ?? '')
      setNombreError(null)
      setSubmitError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id])

  const onNombreChange = (value: string): void => {
    setNombre(value)
    setNombreError(null)
  }

  const onTelefonoChange = (value: string): void => {
    setTelefono(value)
  }

  const onReset = (initial?: { nombre: string; telefono: string }): void => {
    setNombre(initial?.nombre ?? '')
    setTelefono(initial?.telefono ?? '')
    setNombreError(null)
    setSubmitError(null)
    setIsSubmitting(false)
  }

  const onSubmit = async (): Promise<{ ok: boolean }> => {
    const trimmedNombre = nombre.trim()
    if (!trimmedNombre) {
      setNombreError('Ingresá un nombre.')
      return { ok: false }
    }

    setIsSubmitting(true)
    setSubmitError(null)

    const result = await mutate({
      terapeutaId: target!.id,
      nombre: trimmedNombre,
      telefono: telefono || null,
    })

    setIsSubmitting(false)

    if (!result.ok) {
      setSubmitError(mapErrorToMessage(error))
      return { ok: false }
    }

    return { ok: true }
  }

  return {
    nombre,
    telefono,
    nombreError,
    submitError,
    isSubmitting,
    onNombreChange,
    onTelefonoChange,
    onSubmit,
    onReset,
  }
}

export type { EditarTerapeutaViewModel }
export { useEditarTerapeutaViewModel }
