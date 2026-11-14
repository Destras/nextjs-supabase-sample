'use client'

import { Suspense } from 'react'
import { usePacientesViewModel } from './controllers'
import { PacientesView } from './PacientesView'

function PacientesContent() {
  const vm = usePacientesViewModel()
  return <PacientesView {...vm} />
}

export default function PacientesPage() {
  return (
    <Suspense fallback={null}>
      <PacientesContent />
    </Suspense>
  )
}
