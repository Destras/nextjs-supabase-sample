'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type React from 'react'
import { mapAuthError, mapLoginUrlError } from '@/app/controllers/Auth'
import { removeQueryParam } from '@/app/utils/removeQueryParam'
import { createClient } from '@/lib/supabase/client'

interface LoginViewModel {
  readonly email: string
  readonly password: string
  readonly error: string | null
  readonly isLoading: boolean
  readonly onEmailChange: (value: string) => void
  readonly onPasswordChange: (value: string) => void
  readonly onSubmit: (e: React.FormEvent) => Promise<void>
  readonly onForgotPassword: () => void
}

const useLoginViewModel = (): LoginViewModel => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const searchParams = useSearchParams()
  // El proxy devuelve acá con `?error=sin_acceso` a quien no es de consola.
  // Solo se muestran códigos conocidos: el texto de la URL nunca se refleja.
  // Se deriva en cada render y no se guarda en el estado: el rechazo llega como
  // un redirect al mismo login, que ya está montado.
  const errorDeUrl = mapLoginUrlError(searchParams.get('error'))
  const [errorDeEnvio, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  // El rechazo de la URL habla de la cuenta ANTERIOR: mientras otra intenta
  // entrar no se muestra, y al enviar se saca de la URL (BETA-044). Si el proxy
  // rechaza también a la nueva, vuelve a redirigir acá con el parámetro.
  const error = errorDeEnvio ?? (isLoading ? null : errorDeUrl)
  const router = useRouter()

  const onEmailChange = (value: string): void => setEmail(value)
  const onPasswordChange = (value: string): void => setPassword(value)

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    if (searchParams.has('error')) {
      router.replace(removeQueryParam('/auth/login', searchParams, 'error'), {
        scroll: false,
      })
    }
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (authError) throw authError
      router.push('/')
    } catch (err: unknown) {
      setError(mapAuthError(err))
    } finally {
      setIsLoading(false)
    }
  }

  const onForgotPassword = (): void => router.push('/auth/forgot-password')

  return {
    email,
    password,
    error,
    isLoading,
    onEmailChange,
    onPasswordChange,
    onSubmit,
    onForgotPassword,
  }
}

export type { LoginViewModel }
export { useLoginViewModel }
