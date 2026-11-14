'use client'

import { Suspense } from 'react'
import { useMantrasTabViewModel } from './controllers'
import { MantrasView } from './MantrasView'

function MantrasContent() {
  const vm = useMantrasTabViewModel()
  return <MantrasView {...vm} />
}

export default function MantrasPage() {
  return (
    <Suspense fallback={null}>
      <MantrasContent />
    </Suspense>
  )
}
