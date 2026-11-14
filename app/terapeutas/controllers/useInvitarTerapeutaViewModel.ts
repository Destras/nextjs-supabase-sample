'use client'

import { useState } from 'react'
import { useInviteTerapeuta } from '@/app/controllers/Terapeuta'

interface InvitarTerapeutaViewModel {
  readonly nombre: string
  readonly email: string
  readonly nombreError: string | null
  readonly emailError: string | null
  readonly submitError: string | null
  readonly isSubmitting: boolean
  readonly onNombreChange: (value: string) => void
  readonly onEmailChange: (value: string) => void
  readonly onSubmit: () => Promise<{ ok: boolean }>
  readonly onReset: () => void
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const mapErrorToMessage = (error: string | null): string => {
  if (error === 'email_duplicado') {
    return 'Ese email ya está registrado en el sistema.'
  }
  if (error === 'validacion_invalida') {
    return 'Datos inválidos. Revisá los campos.'
  }
  return 'No pudimos enviar la invitación. Intentá de nuevo.'
}

const useInvitarTerapeutaViewModel = (): InvitarTerapeutaViewModel => {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [nombreError, setNombreError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { mutate } = useInviteTerapeuta()

  // El error del envío habla de lo que se envió: al cambiar un campo deja de
  // ser cierto y se va (BETA-038).
  const onNombreChange = (value: string): void => {
    setNombre(value)
    setNombreError(null)
    setSubmitError(null)
  }

  const onEmailChange = (value: string): void => {
    setEmail(value)
    setEmailError(null)
    setSubmitError(null)
  }

  const onReset = (): void => {
    setNombre('')
    setEmail('')
    setNombreError(null)
    setEmailError(null)
    setSubmitError(null)
    setIsSubmitting(false)
  }

  const onSubmit = async (): Promise<{ ok: boolean }> => {
    const trimmedNombre = nombre.trim()
    const isNombreValid = trimmedNombre.length > 0
    const isEmailValid = EMAIL_REGEX.test(email)

    if (!isNombreValid || !isEmailValid) {
      setNombreError(isNombreValid ? null : 'Ingresá un nombre.')
      setEmailError(isEmailValid ? null : 'Ingresá un email válido.')
      return { ok: false }
    }

    setIsSubmitting(true)
    setSubmitError(null)

    const result = await mutate({ nombre: trimmedNombre, email })
    setIsSubmitting(false)

    if (!result.ok) {
      setSubmitError(mapErrorToMessage(result.error ?? null))
      return { ok: false }
    }

    onReset()
    return { ok: true }
  }

  return {
    nombre,
    email,
    nombreError,
    emailError,
    submitError,
    isSubmitting,
    onNombreChange,
    onEmailChange,
    onSubmit,
    onReset,
  }
}

export type { InvitarTerapeutaViewModel }
export { useInvitarTerapeutaViewModel }
