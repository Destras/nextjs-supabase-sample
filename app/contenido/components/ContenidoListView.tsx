'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { ContenidoCard } from './ContenidoCard'
import { ContenidoSearchEmpty } from './ContenidoSearchEmpty'
import { ContenidoTable } from './ContenidoTable'
import { ContenidoToolbar } from './ContenidoToolbar'
import { EmptyState } from './EmptyState'
import type {
  CatalogListItem,
  CatalogStatus,
  CatalogViewMode,
  TabKey,
} from '@/app/contenido/controllers'

interface ContenidoListViewProps {
  readonly items: ReadonlyArray<CatalogListItem>
  readonly status: CatalogStatus
  readonly error: string | null
  readonly isAdmin: boolean
  readonly searchInput: string
  readonly viewMode: CatalogViewMode
  readonly onSearchInputChange: (value: string) => void
  readonly onViewModeChange: (value: string) => void
  readonly onSearchBlur: () => void
  readonly tab: TabKey
  readonly onNew?: () => void
}

const LoadingSkeletons = () => (
  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: 6 }, (_, i) => (
      <div
        key={i}
        className="overflow-hidden rounded-[var(--radius)] border border-border bg-card"
      >
        {/* thumbnail area */}
        <div className="aspect-[16/9]">
          <Skeleton className="h-full w-full rounded-none" />
        </div>
        {/* card body */}
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      </div>
    ))}
  </div>
)

const ContenidoListView = ({
  items,
  status,
  error,
  isAdmin,
  searchInput,
  viewMode,
  onSearchInputChange,
  onViewModeChange,
  onSearchBlur,
  tab,
  onNew,
}: ContenidoListViewProps) => (
  <div className="flex flex-col gap-5">
    {/* Rendered in every status so the input never unmounts while typing. */}
    <ContenidoToolbar
      searchInput={searchInput}
      viewMode={viewMode}
      onSearchInputChange={onSearchInputChange}
      onViewModeChange={onViewModeChange}
      onSearchBlur={onSearchBlur}
    />

    {status === 'loading' && <LoadingSkeletons />}

    {status === 'error' && (
      <div className="py-6 text-sm text-destructive">{error}</div>
    )}

    {status === 'catalog-empty' && (
      <EmptyState tab={tab} isAdmin={isAdmin} onNew={onNew} />
    )}

    {status === 'search-empty' && <ContenidoSearchEmpty />}

    {status === 'ready' &&
      (viewMode === 'tabla' ? (
        <ContenidoTable items={items} tab={tab} />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ContenidoCard key={item.id} item={item} />
          ))}
        </div>
      ))}
  </div>
)

export { ContenidoListView }
export type { ContenidoListViewProps }
