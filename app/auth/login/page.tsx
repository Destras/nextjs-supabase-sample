'use client'

import { Suspense } from 'react'
import { useLoginViewModel } from './controllers'
import { LoginView } from './LoginView'

function LoginContent() {
  const vm = useLoginViewModel()
  return <LoginView {...vm} />
}

// Suspense: el ViewModel lee `?error=` con useSearchParams.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}
