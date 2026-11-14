'use client'

import Link from 'next/link'

import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { CatalogListItem, TabKey } from '@/app/contenido/controllers'
import { contenidoTipoMeta } from '@/app/contenido/controllers/utils/contenidoTipoMeta'
import { formatDuracionCelda } from '@/app/contenido/controllers/utils/formatDuracion'

interface ContenidoTableProps {
  readonly items: ReadonlyArray<CatalogListItem>
  readonly tab: TabKey
}

const ContenidoTable = ({ items, tab }: ContenidoTableProps) => {
  const { tieneDuracion } = contenidoTipoMeta(tab)

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            {tieneDuracion && <TableHead>Duración</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="relative">
              <TableCell className="whitespace-normal font-medium">
                {/* Stretched link: the whole row is the click target while the
                    name stays the only (keyboard-focusable) interactive element. */}
                <Link
                  href={item.href}
                  className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                >
                  {item.nombre}
                </Link>
              </TableCell>
              {tieneDuracion && (
                <TableCell className="font-mono text-[11px] text-muted-foreground">
                  {formatDuracionCelda(item.duracionSeg)}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

export { ContenidoTable }
export type { ContenidoTableProps }
