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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Terapeuta } from '@/app/controllers/Terapeuta'

interface DesactivarTerapeutaDialogProps {
  readonly terapeuta: Terapeuta | null
  readonly motivo: string
  readonly motivoError: string | null
  readonly submitError: string | null
  readonly isSubmitting: boolean
  readonly onMotivoChange: (value: string) => void
  readonly onConfirm: () => Promise<void>
  readonly onClose: () => void
}

const DesactivarTerapeutaDialog = ({
  terapeuta,
  motivo,
  motivoError,
  submitError,
  isSubmitting,
  onMotivoChange,
  onConfirm,
  onClose,
}: DesactivarTerapeutaDialogProps) => {
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
          <AlertDialogTitle>
            ¿Desactivar a {terapeuta?.profile.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            No podrá iniciar sesión hasta que lo reactives. La desactivación
            queda registrada en el log de auditoría.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-2 py-2">
          <Label htmlFor="motivo">Motivo de desactivación</Label>
          <Textarea
            id="motivo"
            value={motivo}
            onChange={(e) => onMotivoChange(e.target.value)}
            disabled={isSubmitting}
            placeholder="Ej: Terapeuta dejó la clínica el 15/06/2025."
            rows={3}
          />
          {motivoError && (
            <p className="text-sm text-destructive">{motivoError}</p>
          )}
        </div>

        {submitError && (
          <p className="text-sm text-destructive">{submitError}</p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(e) => {
              // Radix AlertDialogAction cierra el dialog por default al click.
              // Lo prevenimos para que el VM decida: en éxito llama onClose()
              // explícitamente; en error mantiene el dialog abierto con el
              // submitError inline. Fix TER-004.
              e.preventDefault()
              onConfirm()
            }}
            disabled={isSubmitting || !motivo.trim()}
          >
            {isSubmitting ? 'Desactivando…' : 'Desactivar terapeuta'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { DesactivarTerapeutaDialog }
export type { DesactivarTerapeutaDialogProps }
