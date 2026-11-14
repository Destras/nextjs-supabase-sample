'use client'

import { useRef } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { AvisoDeInicio } from '@/app/controllers/Paciente'

interface IniciarTratamientoDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly pacienteNombre: string
  readonly semanasConContenido: number
  readonly totalSemanas: number
  readonly aviso: AvisoDeInicio
  readonly guardaCambios: boolean
  readonly isSubmitting: boolean
  readonly onConfirm: () => Promise<void>
}

const AVISO_COPY = new Map<AvisoDeInicio, string>([
  ['bienvenida', 'Le vamos a enviar el mensaje de bienvenida por WhatsApp.'],
  ['con_app', 'El paciente ya tiene la app: no se le envía ningún mensaje.'],
  [
    'ya_recibida',
    'El paciente ya recibió la bienvenida: no se le envía ningún mensaje.',
  ],
])

const IniciarTratamientoDialog = ({
  open,
  onOpenChange,
  pacienteNombre,
  semanasConContenido,
  totalSemanas,
  aviso,
  guardaCambios,
  isSubmitting,
  onConfirm,
}: IniciarTratamientoDialogProps) => {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // El diálogo no se cierra mientras se inicia.
  const handleOpenChange = (next: boolean) => {
    if (isSubmitting && !next) return
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(event) => {
          // Acción irreversible: el foco arranca en "Cancelar".
          event.preventDefault()
          cancelRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-display)] text-foreground">
            ¿Iniciar el tratamiento de {pacienteNombre}?
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Arranca hoy. Desde hoy se cuentan las semanas, los meses y las
            evaluaciones. No se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 text-sm text-foreground">
          {semanasConContenido === 0 ? (
            <Alert>
              <AlertDescription>
                Vas a iniciar sin contenido asignado. El paciente va a recibir
                solo las frases de cada semana.
              </AlertDescription>
            </Alert>
          ) : (
            <p>
              Contenido en {semanasConContenido} de {totalSemanas} semanas.
            </p>
          )}
          {guardaCambios && <p>Se guardan los cambios del plan.</p>}
          <p>{AVISO_COPY.get(aviso)}</p>
        </div>

        <DialogFooter>
          <Button
            ref={cancelRef}
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button disabled={isSubmitting} onClick={() => void onConfirm()}>
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Iniciando…
              </>
            ) : (
              'Iniciar tratamiento'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { IniciarTratamientoDialog }
export type { IniciarTratamientoDialogProps }
