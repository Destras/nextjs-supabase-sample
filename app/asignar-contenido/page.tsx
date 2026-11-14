'use client'

import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsignarContenidoViewModel } from './controllers'
import { AsignarContenidoView } from './AsignarContenidoView'

const AsignarContenidoPageInner = () => {
  const vm = useAsignarContenidoViewModel()
  return <AsignarContenidoView {...vm} />
}

const AsignarContenidoPage = () => (
  <Suspense
    fallback={
      <main className="p-8">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="mt-5 h-64 w-full" />
      </main>
    }
  >
    <AsignarContenidoPageInner />
  </Suspense>
)

export default AsignarContenidoPage
