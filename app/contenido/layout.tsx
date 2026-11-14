'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useContenidoLayoutViewModel } from './controllers'
import { ContenidoTabBar } from './components/ContenidoTabBar'

interface LayoutProps {
  readonly children: React.ReactNode
}

// The ViewModel reads useSearchParams (tab counters follow the ?q= query), so
// the header and tab bar live under their own Suspense boundary instead of
// pushing the client-render bailout up to the root layout.
const ContenidoLayoutContent = () => {
  const { isAdmin, isResolvingRole, nuevoHref, counts, tabs } =
    useContenidoLayoutViewModel()

  return (
    <>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <span className="eyebrow text-muted-foreground">
            Biblioteca · {counts.total} piezas
          </span>
          <h1 className="text-4xl font-medium tracking-tight">
            Contenido <em className="not-italic text-primary">del programa</em>
          </h1>
        </div>
        {!isResolvingRole && isAdmin && (
          <Button asChild>
            <Link href={nuevoHref}>
              <Plus className="h-4 w-4" />
              Crear contenido
            </Link>
          </Button>
        )}
      </div>
      <ContenidoTabBar tabs={tabs} />
    </>
  )
}

const ContenidoLayout = ({ children }: LayoutProps) => (
  <main className="flex min-h-dvh flex-col p-8">
    <Suspense fallback={null}>
      <ContenidoLayoutContent />
    </Suspense>
    {children}
  </main>
)

export default ContenidoLayout
