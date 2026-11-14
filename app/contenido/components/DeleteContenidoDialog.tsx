'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { CatalogItem } from '@/app/contenido/controllers'

interface DeleteContenidoDialogProps {
  readonly item: CatalogItem | null
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onConfirm: () => void
  readonly isDeleting: boolean
  readonly error: string | null
}

const DeleteContenidoDialog = ({
  item,
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
  error,
}: DeleteContenidoDialogProps) => {
  if (item === null) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-[family-name:var(--font-display)] text-foreground">
            ¿Eliminar {item.nombre}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error !== null && <p className="text-sm text-destructive">{error}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeleting}
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
          >
            {isDeleting ? 'Eliminando…' : 'Eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { DeleteContenidoDialog }
export type { DeleteContenidoDialogProps }
