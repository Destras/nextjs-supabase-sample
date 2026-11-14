'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { TabKey } from '@/app/contenido/controllers'

const EMPTY_COPY: Record<TabKey, string> = {
  videos: 'Todavía no hay videos cargados.',
  mantras: 'Todavía no hay mantras cargados.',
  egregores: 'Todavía no hay egregores cargados.',
  cma: 'Todavía no hay galerías de CMA cargadas.',
  ic: 'Todavía no hay galerías de IC cargadas.',
}

interface EmptyStateProps {
  readonly tab: TabKey
  readonly isAdmin: boolean
  readonly onNew?: () => void
}

const EmptyState = ({ tab, isAdmin, onNew }: EmptyStateProps) => {
  const copy = EMPTY_COPY[tab]
  const nuevoHref = `/contenido/nuevo?tipo=${tab}`

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <p className="text-muted-foreground">{copy}</p>
      {isAdmin && (
        <Button asChild size="sm" onClick={onNew}>
          <Link href={nuevoHref}>Nuevo contenido</Link>
        </Button>
      )}
    </div>
  )
}

export { EmptyState }
export type { EmptyStateProps }
