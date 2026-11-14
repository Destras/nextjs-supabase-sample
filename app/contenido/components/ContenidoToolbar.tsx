'use client'

import { LayoutGrid, List, Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { CatalogViewMode } from '@/app/contenido/controllers'

interface ContenidoToolbarProps {
  readonly searchInput: string
  readonly viewMode: CatalogViewMode
  readonly onSearchInputChange: (value: string) => void
  readonly onViewModeChange: (value: string) => void
  readonly onSearchBlur: () => void
}

const ContenidoToolbar = ({
  searchInput,
  viewMode,
  onSearchInputChange,
  onViewModeChange,
  onSearchBlur,
}: ContenidoToolbarProps) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={searchInput}
        onChange={(e) => onSearchInputChange(e.target.value)}
        onBlur={onSearchBlur}
        placeholder="Buscar contenido..."
        aria-label="Buscar contenido por nombre"
        className="bg-background pl-9"
      />
    </div>
    <ToggleGroup
      type="single"
      value={viewMode}
      onValueChange={onViewModeChange}
      variant="outline"
      size="sm"
      className="ml-auto"
    >
      <ToggleGroupItem value="cards" aria-label="Ver como tarjetas">
        <LayoutGrid />
      </ToggleGroupItem>
      <ToggleGroupItem value="tabla" aria-label="Ver como tabla">
        <List />
      </ToggleGroupItem>
    </ToggleGroup>
  </div>
)

export { ContenidoToolbar }
export type { ContenidoToolbarProps }
