'use client'

import { Suspense, use } from 'react'
import { notFound, useSearchParams } from 'next/navigation'
import {
  useContenidoDetailViewModel,
  isValidContenidoId,
} from '@/app/contenido/[id]/controllers'
import { ContenidoDetailView } from '@/app/contenido/[id]/ContenidoDetailView'
import type { TabKey } from '@/app/contenido/controllers'

const VALID_TABS: TabKey[] = ['videos', 'mantras', 'egregores', 'cma', 'ic']
const isTabKey = (value: string | null): value is TabKey =>
  VALID_TABS.includes(value as TabKey)

interface ContenidoDetailPageProps {
  readonly params: Promise<{ id: string }>
}

function ContenidoDetailContent({ id }: { readonly id: string }) {
  const searchParams = useSearchParams()
  const rawTipo = searchParams.get('tipo')
  const tipo: TabKey = isTabKey(rawTipo) ? rawTipo : 'videos'

  const vm = useContenidoDetailViewModel({ id, tipo })

  if (vm.isLoading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Cargando…
      </div>
    )
  }

  if (vm.notFound) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No encontramos el contenido. Puede que haya sido eliminado.
      </div>
    )
  }

  return <ContenidoDetailView {...vm} />
}

export default function ContenidoDetailPage({
  params,
}: ContenidoDetailPageProps) {
  const { id } = use(params)

  if (!isValidContenidoId(id)) {
    notFound()
  }

  return (
    <Suspense fallback={null}>
      <ContenidoDetailContent id={id} />
    </Suspense>
  )
}
