'use client'

import type { JSX } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PasoNumero, PasoView } from '../controllers/utils/pasos'

interface WizardStepperProps {
  readonly pasos: ReadonlyArray<PasoView>
  readonly onJumpToStep: (paso: PasoNumero) => void
}

const WizardStepper = ({
  pasos,
  onJumpToStep,
}: WizardStepperProps): JSX.Element => (
  <div className="flex items-stretch border-b border-border">
    {pasos.map((step) => {
      const isDone = step.status === 'done'
      const isActive = step.status === 'active'

      return (
        <button
          key={step.n}
          type="button"
          onClick={() => {
            if (isDone) onJumpToStep(step.n)
          }}
          aria-current={isActive ? 'step' : undefined}
          disabled={!isDone && !isActive}
          className={cn(
            'flex flex-1 flex-col gap-1 border-r border-border px-5 py-4 text-left last:border-r-0',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isDone &&
              'cursor-pointer hover:bg-muted/50 disabled:pointer-events-auto',
            isActive && 'bg-primary/10 border-b-2 border-b-primary',
            !isDone && !isActive && 'cursor-default opacity-50',
          )}
        >
          <div className="flex items-center gap-2">
            <span className="eyebrow text-muted-foreground">{step.label}</span>
            {isDone && <Check className="size-3 text-primary" />}
          </div>
          <div
            className={cn(
              'text-sm font-medium',
              isActive ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {step.title}
          </div>
          <div className="text-xs text-muted-foreground">
            {step.description}
          </div>
        </button>
      )
    })}
  </div>
)

export { WizardStepper }
export type { WizardStepperProps }
