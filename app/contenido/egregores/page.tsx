'use client'

import { Suspense } from 'react'
import { useEgregoresTabViewModel } from './controllers'
import { EgregoresView } from './EgregoresView'

function EgregoresContent() {
  const vm = useEgregoresTabViewModel()
  return <EgregoresView {...vm} />
}

export default function EgregoresPage() {
  return (
    <Suspense fallback={null}>
      <EgregoresContent />
    </Suspense>
  )
}
