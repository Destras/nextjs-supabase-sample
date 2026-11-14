'use client'

import type { JSX } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { GuardedLink } from '@/components/navigation'
import { EMAIL_EN_FICHA_DE } from '@/lib/identidadMessages'
import type { NuevoPacienteViewModel } from './controllers'
import { ConfirmationCard } from './components/ConfirmationCard'
import { DiagnosticoStep } from './components/DiagnosticoStep'
import { IdentidadStep } from './components/IdentidadStep'
import { PlanStep } from './components/PlanStep'
import { WizardFooter } from './components/WizardFooter'
import { WizardStepper } from './components/WizardStepper'

const NuevoPacienteView = (props: NuevoPacienteViewModel): JSX.Element => {
  const {
    formState,
    errores,
    catalogos,
    isLoadingCatalogos,
    catalogosError,
    isSubmitting,
    submitError,
    fichaDuplicada,
    puedeAvanzar,
    pasos,
    confirmationSummary,
    avisoTelefono,
    fechaNacimientoDate,
    fechaNacimientoMin,
    fechaNacimientoMax,
    onSelectFechaNacimiento,
    setIdentidadField,
    setCausa,
    toggleBloqueo,
    setAlgoritmo,
    setModalidad,
    setAlfabetos,
    onBlurField,
    goNext,
    goBack,
    jumpToStep,
    submit,
    cancel,
    dismissSubmitError,
  } = props

  if (isLoadingCatalogos) {
    return (
      <main className="flex min-h-dvh flex-col p-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-20 w-full" />
        <div className="mt-8 flex flex-col gap-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </main>
    )
  }

  if (catalogosError) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-destructive">{catalogosError}</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!catalogos) return <></>

  return (
    <main className="flex min-h-dvh flex-col p-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow text-muted-foreground">
            Nuevo paciente · Paso {formState.paso} de 3
          </div>
          <h1 className="mt-1 text-4xl font-medium tracking-tight">
            Construyendo{' '}
            <em className="italic font-light text-muted-foreground">
              su camino
            </em>
          </h1>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Cada paciente arranca con un diagnóstico energético único. Lo que
            definamos aquí calibra los próximos meses de contenido.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={cancel}>
          Cancelar
        </Button>
      </header>

      <WizardStepper pasos={pasos} onJumpToStep={jumpToStep} />

      {submitError && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive-bg px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="font-medium">No se pudo cargar el paciente</p>
            <p className="mt-0.5 text-destructive/80">
              {fichaDuplicada ? (
                <>
                  {EMAIL_EN_FICHA_DE}{' '}
                  {fichaDuplicada.accesible ? (
                    <GuardedLink
                      href={`/pacientes/${fichaDuplicada.id}/camino`}
                      className="font-medium text-destructive underline underline-offset-4"
                    >
                      {fichaDuplicada.nombre}
                    </GuardedLink>
                  ) : (
                    <span className="font-medium text-destructive">
                      {fichaDuplicada.nombre}
                    </span>
                  )}
                  .
                </>
              ) : (
                submitError
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Descartar mensaje"
            onClick={dismissSubmitError}
            className="h-6 w-6 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      )}

      <div className="mt-8">
        {formState.paso === 1 && (
          <IdentidadStep
            identidad={formState.identidad}
            errores={errores}
            avisoTelefono={avisoTelefono}
            onChange={setIdentidadField}
            onBlur={(field) => onBlurField(`identidad.${field}`)}
            fechaNacimientoDate={fechaNacimientoDate}
            fechaNacimientoMin={fechaNacimientoMin}
            fechaNacimientoMax={fechaNacimientoMax}
            onSelectFechaNacimiento={onSelectFechaNacimiento}
          />
        )}
        {formState.paso === 2 && (
          <DiagnosticoStep
            diagnostico={formState.diagnostico}
            errores={errores}
            causas={catalogos.causa}
            bloqueos={catalogos.bloqueos}
            algoritmos={catalogos.algoritmo}
            onSelectCausa={setCausa}
            onToggleBloqueo={toggleBloqueo}
            onSelectAlgoritmo={setAlgoritmo}
          />
        )}
        {formState.paso === 3 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <PlanStep
              plan={formState.plan}
              errores={errores}
              modalidades={catalogos.modalidades}
              alfabetos={catalogos.alfabetos}
              onSelectModalidad={setModalidad}
              onChangeAlfabetos={setAlfabetos}
            />
            <ConfirmationCard summary={confirmationSummary} />
          </div>
        )}
      </div>

      <WizardFooter
        paso={formState.paso}
        puedeAvanzar={puedeAvanzar}
        isSubmitting={isSubmitting}
        onBack={formState.paso === 1 ? cancel : goBack}
        onNext={formState.paso === 3 ? submit : goNext}
      />
    </main>
  )
}

export { NuevoPacienteView }
