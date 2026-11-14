'use client'

import { Suspense } from 'react'
import { use } from 'react'
import { useSearchParams } from 'next/navigation'
import { NotAuthorizedPage } from '@/app/features/Auth/components/NotAuthorizedPage'
import { useContenidoFormViewModel } from '@/app/contenido/controllers'
import { ContenidoFormView } from '@/app/contenido/components/ContenidoFormView'
import type { TabKey } from '@/app/contenido/controllers'

const VALID_TABS: TabKey[] = ['videos', 'mantras', 'egregores', 'cma', 'ic']

const isTabKey = (value: string | null): value is TabKey =>
  VALID_TABS.includes(value as TabKey)

interface EditarContenidoPageProps {
  readonly params: Promise<{ id: string }>
}

function EditarContenidoContent({ id }: { readonly id: string }) {
  const searchParams = useSearchParams()
  const rawTipo = searchParams.get('tipo')
  const tipo: TabKey = isTabKey(rawTipo) ? rawTipo : 'videos'

  const vm = useContenidoFormViewModel({ mode: 'edit', initialTipo: tipo, id })

  if (!vm.isResolvingRole && !vm.isAdmin) {
    return <NotAuthorizedPage />
  }

  if (vm.isLoadingInitial) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Cargando…
      </div>
    )
  }

  if (vm.loadError) {
    return (
      <div className="py-12 text-center text-sm text-destructive">
        No pudimos cargar el contenido. Reintentá más tarde.
      </div>
    )
  }

  if (vm.notFound) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No encontrado
      </div>
    )
  }

  return <ContenidoFormView {...vm} />
}

export default function EditarContenidoPage({
  params,
}: EditarContenidoPageProps) {
  const { id } = use(params)

  return (
    <Suspense fallback={null}>
      <EditarContenidoContent id={id} />
    </Suspense>
  )
}
