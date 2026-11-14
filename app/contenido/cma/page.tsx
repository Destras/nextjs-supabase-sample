'use client'

import { Suspense } from 'react'
import { useCmaTabViewModel } from './controllers'
import { CmaView } from './CmaView'

function CmaContent() {
  const vm = useCmaTabViewModel()
  return <CmaView {...vm} />
}

export default function CmaPage() {
  return (
    <Suspense fallback={null}>
      <CmaContent />
    </Suspense>
  )
}
