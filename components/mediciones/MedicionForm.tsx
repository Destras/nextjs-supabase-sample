import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type {
  CampoMedicion,
  MomentoMedicion,
} from '@/app/controllers/Tratamiento'

interface MedicionFormProps {
  readonly campos: ReadonlyArray<CampoMedicion>
  readonly valores: Record<string, string>
  readonly errores: Record<string, string>
  readonly momento: MomentoMedicion
  readonly modo: 'crear' | 'editar'
  readonly readOnly?: boolean
  readonly motivoReadOnly?: string
  readonly isSubmitting: boolean
  readonly canSubmit: boolean
  readonly onChange: (key: string, value: string) => void
  // Opcional: el caller que muestra los errores recién al salir del campo
  // (FinalizarTratamientoDialog, BETA-049) se entera del blur por acá.
  readonly onBlur?: (key: string) => void
  readonly onSubmit: () => void
  readonly onCancel: () => void
  // Extensiones design §5.3 para el caller dual (tab + FinalizarTratamientoDialog, PR4).
  readonly columnas?: 'auto' | 2
  readonly acciones?: 'propias' | 'ninguna'
  readonly intro?: string | null
  readonly submitLabel?: string
}

// Molécula compartida (design §5.3, mock `d4c5ab46-…js:164-331`). Decisión
// de diseño central: NO renderiza `Card` (el tab pone la card, el diálogo de
// PR4 ya es una superficie) y es enteramente controlado — CERO `useState`
// propio. Todo el estado del form (valores, errores, confirmación) vive en el
// caller, lo que permite reusarlo sin pelear con superficies anidadas.
const MedicionForm = ({
  campos,
  valores,
  errores,
  readOnly = false,
  motivoReadOnly,
  isSubmitting,
  canSubmit,
  onChange,
  onBlur,
  onSubmit,
  onCancel,
  columnas = 'auto',
  acciones = 'propias',
  intro = null,
  submitLabel = 'Registrar medición',
}: MedicionFormProps) => {
  const gridClassName =
    columnas === 2
      ? 'grid grid-cols-1 gap-4 sm:grid-cols-2'
      : 'grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4'

  return (
    <div className="flex flex-col gap-4">
      {readOnly && motivoReadOnly !== undefined && (
        <Alert>
          <AlertDescription>{motivoReadOnly}</AlertDescription>
        </Alert>
      )}

      {intro !== null && intro !== undefined && (
        <p className="max-w-2xl text-sm text-muted-foreground">{intro}</p>
      )}

      <div className={gridClassName}>
        {campos.map((campo) => {
          const esGeneral = campo.centroId === null
          const error = errores[campo.key]
          const descriptionId = `medicion-campo-${campo.key}`

          return (
            <div
              key={campo.key}
              className={cn(
                'flex flex-col gap-1.5',
                esGeneral && 'col-span-full border-t border-border pt-4',
              )}
            >
              <Label htmlFor={campo.key}>{campo.label}</Label>
              <Input
                id={campo.key}
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                disabled={readOnly}
                value={valores[campo.key] ?? ''}
                onChange={(e) => onChange(campo.key, e.target.value)}
                onBlur={() => onBlur?.(campo.key)}
                aria-describedby={descriptionId}
                aria-invalid={error !== undefined}
                className={cn(
                  esGeneral && 'font-mono text-lg',
                  error !== undefined && 'border-destructive',
                )}
              />
              <span
                id={descriptionId}
                className={cn(
                  'text-xs',
                  error !== undefined
                    ? 'text-destructive'
                    : 'text-muted-foreground',
                )}
              >
                {error ??
                  (campo.valorAnterior !== null
                    ? `Medición anterior: ${campo.valorAnterior}%`
                    : 'Sin medición anterior')}
              </span>
            </div>
          )
        })}
      </div>

      {acciones === 'propias' && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={!canSubmit || readOnly || isSubmitting}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          {!canSubmit && !readOnly && (
            <span className="text-xs text-muted-foreground">
              Faltan centros por completar.
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export { MedicionForm }
export type { MedicionFormProps }
