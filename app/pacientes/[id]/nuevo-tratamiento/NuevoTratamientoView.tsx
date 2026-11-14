'use client'

import type { JSX } from 'react'
import Link from 'next/link'
import { AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmationCard } from '@/app/pacientes/nuevo/components/ConfirmationCard'
import { DiagnosticoStep } from '@/app/pacientes/nuevo/components/DiagnosticoStep'
import { PlanStep } from '@/app/pacientes/nuevo/components/PlanStep'
import { WizardFooter } from '@/app/pacientes/nuevo/components/WizardFooter'
import { WizardStepper } from '@/app/pacientes/nuevo/components/WizardStepper'
import type { NuevoTratamientoViewModel } from './controllers'

const LoadingSkeleton = (): JSX.Element => (
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

const NuevoTratamientoView = (
  props: NuevoTratamientoViewModel,
): JSX.Element => {
  const {
    isLoading,
    loadError,
    notFound,
    tieneEtapaActiva,
    detailHref,
    catalogos,
    formState,
    errores,
    isSubmitting,
    submitError,
    puedeAvanzar,
    pasos,
    confirmationSummary,
    setCausa,
    toggleBloqueo,
    setAlgoritmo,
    setModalidad,
    setAlfabetos,
    goNext,
    goBack,
    jumpToStep,
    submit,
    cancel,
    dismissSubmitError,
  } = props

  if (isLoading) return <LoadingSkeleton />

  if (loadError) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-destructive">Error: {loadError}</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (notFound) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No se encontró el paciente o no tenés acceso.
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (tieneEtapaActiva) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
            <p className="text-foreground">
              Este paciente ya tiene un tratamiento en curso. Finalizalo antes
              de iniciar uno nuevo.
            </p>
            <Button asChild variant="outline">
              <Link href={detailHref}>Volver al detalle</Link>
            </Button>
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
            Nuevo tratamiento · Paso {formState.paso} de 2
          </div>
          <h1 className="mt-1 text-4xl font-medium tracking-tight">
            Renovando{' '}
            <em className="italic font-light text-muted-foreground">
              su camino
            </em>
          </h1>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Rediagnosticá al paciente para arrancar un ciclo de tratamiento
            nuevo, con los niveles reiniciados.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={cancel}>
          Volver al detalle
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
            <p className="font-medium">No se pudo iniciar el tratamiento</p>
            <p className="mt-0.5 text-destructive/80">{submitError}</p>
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
        {formState.paso === 2 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <PlanStep
              plan={formState.plan}
              errores={errores}
              modalidades={catalogos.modalidades}
              alfabetos={catalogos.alfabetos}
              onSelectModalidad={setModalidad}
              onChangeAlfabetos={setAlfabetos}
            />
            <ConfirmationCard
              summary={confirmationSummary}
              footerCopy="Al confirmar, se abre un tratamiento nuevo para este paciente con los niveles reiniciados. Después podés armar su plan e iniciarlo cuando quieras."
            />
          </div>
        )}
      </div>

      <WizardFooter
        paso={formState.paso}
        totalPasos={2}
        puedeAvanzar={puedeAvanzar}
        isSubmitting={isSubmitting}
        onBack={formState.paso === 1 ? cancel : goBack}
        onNext={formState.paso === 2 ? submit : goNext}
        confirmLabel="Confirmar e iniciar tratamiento"
        confirmingLabel="Iniciando..."
      />
    </main>
  )
}

export { NuevoTratamientoView }
