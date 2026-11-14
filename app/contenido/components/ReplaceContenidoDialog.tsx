'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { CatalogItem } from '@/app/contenido/controllers'
import { contenidoTipoMeta } from '@/app/contenido/controllers/utils/contenidoTipoMeta'

interface ReplaceContenidoDialogProps {
  readonly item: CatalogItem | null
  readonly affectedCount: number
  readonly candidates: ReadonlyArray<CatalogItem>
  readonly selectedId: string | null
  readonly onSelect: (id: string) => void
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onConfirm: () => void
  readonly isReplacing: boolean
  readonly error: string | null
}

const ReplaceContenidoDialog = ({
  item,
  affectedCount,
  candidates,
  selectedId,
  onSelect,
  open,
  onOpenChange,
  onConfirm,
  isReplacing,
  error,
}: ReplaceContenidoDialogProps) => {
  if (item === null) return null

  const hasCandidates = candidates.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-display)] text-foreground">
            Contenido en uso
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Este contenido está asignado a {affectedCount}{' '}
            {affectedCount === 1 ? 'paciente' : 'pacientes'} y no se puede
            eliminar directamente. Elegí un contenido del mismo tipo para
            reemplazarlo.
          </DialogDescription>
        </DialogHeader>

        {hasCandidates ? (
          <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
            <RadioGroup
              value={selectedId ?? ''}
              onValueChange={onSelect}
              className="flex flex-col gap-3"
            >
              {candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/50"
                >
                  <RadioGroupItem
                    value={candidate.id}
                    id={`candidate-${candidate.id}`}
                    className="mt-0.5 shrink-0"
                  />
                  <Label
                    htmlFor={`candidate-${candidate.id}`}
                    className="flex cursor-pointer flex-col gap-0.5"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {candidate.nombre}
                    </span>
                    {candidate.descripcion && (
                      <span className="text-xs text-muted-foreground">
                        {candidate.descripcion}
                      </span>
                    )}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {contenidoTipoMeta(item.tab).sinReemplazo}
          </p>
        )}

        {error !== null && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={isReplacing}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!hasCandidates || selectedId === null || isReplacing}
            onClick={onConfirm}
          >
            {isReplacing ? 'Reemplazando…' : 'Reemplazar y eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ReplaceContenidoDialog }
export type { ReplaceContenidoDialogProps }
