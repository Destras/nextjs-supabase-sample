'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useInvitarTerapeutaViewModel } from '../controllers'

interface InvitarTerapeutaModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onSuccess: (mensaje: string) => void
}

const InvitarTerapeutaModal = ({
  isOpen,
  onClose,
  onSuccess,
}: InvitarTerapeutaModalProps) => {
  const vm = useInvitarTerapeutaViewModel()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await vm.onSubmit()
    if (result.ok) {
      onSuccess(`Invitación enviada a ${vm.email}.`)
      // VM hace onReset internamente en éxito
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      vm.onReset()
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Invitar nuevo terapeuta</DialogTitle>
            <DialogDescription>
              El terapeuta recibirá un email para definir su contraseña y
              empezar a trabajar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={vm.email}
                onChange={(e) => vm.onEmailChange(e.target.value)}
                disabled={vm.isSubmitting}
              />
              {vm.emailError && (
                <p className="text-sm text-destructive">{vm.emailError}</p>
              )}
            </div>
            {vm.submitError && (
              <p className="text-sm text-destructive">{vm.submitError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={vm.isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={vm.isSubmitting}>
              {vm.isSubmitting ? 'Enviando…' : 'Enviar invitación'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { InvitarTerapeutaModal }
export type { InvitarTerapeutaModalProps }
