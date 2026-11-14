'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { NotAuthorizedPage } from '@/app/features/Auth/components/NotAuthorizedPage'
import { useContenidoFormViewModel } from '@/app/contenido/controllers'
import { ContenidoFormView } from '@/app/contenido/components/ContenidoFormView'
import type { TabKey } from '@/app/contenido/controllers'

const VALID_TABS: TabKey[] = ['videos', 'mantras', 'egregores', 'cma', 'ic']

const isTabKey = (value: string | null): value is TabKey =>
  VALID_TABS.includes(value as TabKey)

function NuevoContenidoContent() {
  const searchParams = useSearchParams()
  const rawTipo = searchParams.get('tipo')
  const tipo: TabKey = isTabKey(rawTipo) ? rawTipo : 'videos'

  const vm = useContenidoFormViewModel({ mode: 'create', initialTipo: tipo })

  if (!vm.isResolvingRole && !vm.isAdmin) {
    return <NotAuthorizedPage />
  }

  return <ContenidoFormView {...vm} />
}

export default function NuevoContenidoPage() {
  return (
    <Suspense fallback={null}>
      <NuevoContenidoContent />
    </Suspense>
  )
}
