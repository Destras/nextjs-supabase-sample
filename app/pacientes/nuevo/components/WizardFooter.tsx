'use client'

import type { JSX } from 'react'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WizardFooterProps {
  readonly paso: 1 | 2 | 3
  // Total step count for the wizard this footer is driving. Defaults to 3
  // (the alta paciente wizard). The nuevo-tratamiento wizard (2 steps, no
  // identidad) passes 2 so the "last step" branch fires at paso 2.
  readonly totalPasos?: 1 | 2 | 3
  readonly puedeAvanzar: boolean
  readonly isSubmitting: boolean
  readonly onBack: () => void
  readonly onNext: () => void
  readonly confirmLabel?: string
  readonly confirmingLabel?: string
}

const WizardFooter = ({
  paso,
  totalPasos = 3,
  puedeAvanzar,
  isSubmitting,
  onBack,
  onNext,
  confirmLabel = 'Confirmar y cargar paciente',
  confirmingLabel = 'Cargando paciente...',
}: WizardFooterProps): JSX.Element => (
  <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-6">
    <Button type="button" variant="ghost" onClick={onBack}>
      <ArrowLeft />
      {paso === 1 ? 'Salir' : 'Anterior'}
    </Button>

    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] text-muted-foreground">
        Paso {paso} de {totalPasos}
      </span>

      {paso < totalPasos ? (
        <Button type="button" disabled={!puedeAvanzar} onClick={onNext}>
          Continuar
          <ArrowRight />
        </Button>
      ) : (
        <Button
          type="button"
          disabled={!puedeAvanzar || isSubmitting}
          onClick={onNext}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              {confirmingLabel}
            </>
          ) : (
            <>
              {confirmLabel}
              <Check />
            </>
          )}
        </Button>
      )}
    </div>
  </div>
)

export { WizardFooter }
export type { WizardFooterProps }
