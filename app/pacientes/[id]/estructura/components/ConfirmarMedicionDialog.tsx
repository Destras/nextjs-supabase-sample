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
import type { MomentoMedicion } from '@/app/controllers/Tratamiento'

interface ConfirmarMedicionDialogProps {
  readonly open: boolean
  readonly momento: MomentoMedicion
  readonly modo: 'crear' | 'editar'
  readonly isSubmitting: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

// Copy verbatim de DevSpec §7.2 (reemplaza al del mock, que menciona el
// aviso al paciente — §6.4/§9.8: esa entrega no existe).
const bodyFor = (
  momento: MomentoMedicion,
  modo: 'crear' | 'editar',
): string => {
  if (modo === 'editar') {
    return 'Vas a corregir los valores de esta medición. El cambio queda registrado.'
  }
  if (momento === 'apertura') {
    return 'Se va a guardar como la medición inicial de esta etapa. Después de confirmar no se puede borrar.'
  }
  if (momento === 'cierre') {
    return 'Se va a guardar como la medición de cierre y la etapa se va a finalizar. Después de confirmar no se puede borrar.'
  }
  return 'Se va a guardar como una medición nueva de esta etapa. Después de confirmar no se puede borrar.'
}

// `est-overlay`/`est-dialog` del mock → shadcn `alert-dialog` ya instalado
// (design §5.6, sin atoms nuevos acá).
const ConfirmarMedicionDialog = ({
  open,
  momento,
  modo,
  isSubmitting,
  onConfirm,
  onCancel,
}: ConfirmarMedicionDialogProps) => (
  <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>¿Registrar la medición?</AlertDialogTitle>
        <AlertDialogDescription>
          {bodyFor(momento, modo)}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel} disabled={isSubmitting}>
          Volver
        </AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} disabled={isSubmitting}>
          Confirmar medición
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)

export { ConfirmarMedicionDialog }
export type { ConfirmarMedicionDialogProps }
