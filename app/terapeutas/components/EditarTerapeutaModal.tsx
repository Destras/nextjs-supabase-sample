'use client'

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { Terapeuta } from '@/app/controllers/Terapeuta'
import { useEditarTerapeutaViewModel } from '../controllers'

interface EditarTerapeutaModalProps {
  readonly terapeuta: Terapeuta | null
  readonly onClose: () => void
  readonly onSuccess: (mensaje: string) => void
}

const EditarTerapeutaModal = ({
  terapeuta,
  onClose,
  onSuccess,
}: EditarTerapeutaModalProps) => {
  const vm = useEditarTerapeutaViewModel(terapeuta)
  const isOpen = terapeuta !== null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await vm.onSubmit()
    if (result.ok) onSuccess('Terapeuta actualizado.')
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar terapeuta</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                value={terapeuta?.email ?? ''}
                disabled
                readOnly
              />
              <p className="text-xs text-muted-foreground">
                El email no se puede modificar.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-nombre">Nombre</Label>
              <Input
                id="edit-nombre"
                value={vm.nombre}
                onChange={(e) => vm.onNombreChange(e.target.value)}
                disabled={vm.isSubmitting}
                autoFocus
              />
              {vm.nombreError && (
                <p className="text-sm text-destructive">{vm.nombreError}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-telefono">Teléfono</Label>
              <Input
                id="edit-telefono"
                value={vm.telefono}
                onChange={(e) => vm.onTelefonoChange(e.target.value)}
                disabled={vm.isSubmitting}
              />
            </div>
            {vm.submitError && (
              <p className="text-sm text-destructive">{vm.submitError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={vm.isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={vm.isSubmitting}>
              {vm.isSubmitting ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { EditarTerapeutaModal }
export type { EditarTerapeutaModalProps }
