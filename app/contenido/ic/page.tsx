'use client'

import { Suspense } from 'react'
import { useIcTabViewModel } from './controllers'
import { IcView } from './IcView'

function IcContent() {
  const vm = useIcTabViewModel()
  return <IcView {...vm} />
}

export default function IcPage() {
  return (
    <Suspense fallback={null}>
      <IcContent />
    </Suspense>
  )
}
