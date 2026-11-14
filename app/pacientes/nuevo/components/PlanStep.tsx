'use client'

import type { JSX } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { AllDiagnosticos } from '@/app/controllers/Diagnostico'
import type { FormState } from '../controllers'
import { AlfabetosPicker } from './AlfabetosPicker'
import { SelectableCard } from './SelectableCard'

interface PlanStepProps {
  readonly plan: FormState['plan']
  readonly errores: Readonly<Record<string, string>>
  readonly modalidades: AllDiagnosticos['modalidades']
  readonly alfabetos: AllDiagnosticos['alfabetos']
  readonly onSelectModalidad: (id: string) => void
  readonly onChangeAlfabetos: (next: FormState['plan']['alfabetos']) => void
  readonly modalidadDisabled?: boolean
  readonly alfabetosDisabled?: boolean
}

const PlanStep = ({
  plan,
  errores,
  modalidades,
  alfabetos,
  onSelectModalidad,
  onChangeAlfabetos,
  modalidadDisabled = false,
  alfabetosDisabled = false,
}: PlanStepProps): JSX.Element => {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="eyebrow text-muted-foreground">
          Modalidad
        </CardDescription>
        <CardTitle className="mt-1 text-lg">
          Plan de <em className="italic font-light">seguimiento</em>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {/* Modalidad option-cards — grid 2 col, exclusive selection */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {modalidades.map((m) => {
              const isSelected = plan.modalidadId === m.id

              return (
                <SelectableCard
                  key={m.id}
                  role="radio"
                  selected={isSelected}
                  disabled={modalidadDisabled}
                  onSelect={() => onSelectModalidad(m.id)}
                  className="p-4"
                >
                  <div className="font-display text-[18px] font-medium text-foreground">
                    {m.nombre}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {m.descripcionCorta}
                  </div>
                </SelectableCard>
              )
            })}
          </div>

          {errores['plan.modalidadId'] && (
            <p className="text-sm text-destructive">
              {errores['plan.modalidadId']}
            </p>
          )}

          <Separator />

          {/* Alfabetos — varios números por alfabeto, vía grilla */}
          <div>
            <div className="eyebrow mb-1 text-muted-foreground">Alfabetos</div>
            <h3 className="mb-3 text-base font-medium text-foreground">
              Alfabetos{' '}
              <span className="text-sm font-normal text-muted-foreground">
                (opcional)
              </span>
            </h3>
            <AlfabetosPicker
              catalogo={alfabetos}
              value={plan.alfabetos}
              onChange={onChangeAlfabetos}
              disabled={alfabetosDisabled}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export { PlanStep }
export type { PlanStepProps }
