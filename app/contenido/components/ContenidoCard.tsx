'use client'

import Link from 'next/link'

import type { CatalogListItem } from '@/app/contenido/controllers'
import { contenidoTipoMeta } from '@/app/contenido/controllers/utils/contenidoTipoMeta'
import { formatDuracion } from '@/app/contenido/controllers/utils/formatDuracion'

import { ContenidoThumb } from './ContenidoThumb'
import { ContenidoTipoChip } from './ContenidoTipoChip'

interface ContenidoCardProps {
  readonly item: CatalogListItem
}

const ContenidoCard = ({ item }: ContenidoCardProps) => {
  const meta = contenidoTipoMeta(item.tab)

  return (
    <Link
      href={item.href}
      className="group flex flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card transition-all hover:-translate-y-[3px] hover:border-[color:var(--brand-primary-500)]"
    >
      <ContenidoThumb
        thumbKind={meta.thumbKind}
        duracion={formatDuracion(item.duracionSeg)}
      />

      <div className="flex flex-1 flex-col gap-[10px] px-4 pb-4 pt-[14px]">
        <div className="flex flex-wrap gap-[6px]">
          <ContenidoTipoChip tab={item.tab} />
        </div>

        <h3 className="m-0 font-[family-name:var(--font-display)] text-lg font-medium leading-[1.25] tracking-[-0.01em]">
          {item.nombre}
        </h3>
      </div>
    </Link>
  )
}

export { ContenidoCard }
export type { ContenidoCardProps }
