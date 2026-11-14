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
import type { Terapeuta } from '@/app/controllers/Terapeuta'

interface RevocarInvitacionDialogProps {
  readonly terapeuta: Terapeuta | null
  readonly isSubmitting: boolean
  readonly errorMessage: string | null
  readonly onConfirm: () => Promise<void>
  readonly onClose: () => void
}

const RevocarInvitacionDialog = ({
  terapeuta,
  isSubmitting,
  errorMessage,
  onConfirm,
  onClose,
}: RevocarInvitacionDialogProps) => {
  const isOpen = terapeuta !== null
  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Revocar invitación?</AlertDialogTitle>
          <AlertDialogDescription>
            Vas a eliminar la invitación de{' '}
            <strong>{terapeuta?.profile.name || terapeuta?.email}</strong>. Esta
            acción es irreversible: el terapeuta y su invitación pendiente se
            borran del sistema.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Revocando…' : 'Revocar invitación'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { RevocarInvitacionDialog }
export type { RevocarInvitacionDialogProps }
