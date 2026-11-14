'use client'

import type { JSX } from 'react'
import { AlertCircle, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { GuardedLink } from '@/components/navigation'
import { EMAIL_EN_FICHA_DE } from '@/lib/identidadMessages'
import { DiagnosticoStep } from '@/app/pacientes/nuevo/components/DiagnosticoStep'
import { IdentidadStep } from '@/app/pacientes/nuevo/components/IdentidadStep'
import { PlanStep } from '@/app/pacientes/nuevo/components/PlanStep'
import { WizardStepper } from '@/app/pacientes/nuevo/components/WizardStepper'
import type { EditarPacienteViewModel } from './controllers'

const DiagnosticoLockedCartel = ({
  tieneEtapaActiva,
}: {
  readonly tieneEtapaActiva: boolean
}): JSX.Element => (
  <Card className="border-border bg-muted/40">
    <CardContent className="flex items-start gap-3 py-4">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          El diagnóstico no se puede corregir
        </p>
        <p className="mt-1">
          {tieneEtapaActiva
            ? 'El tratamiento de este paciente ya arrancó (tiene meses cursados, evaluaciones o contenido entregado). Cambiar el diagnóstico ahora sería un re-diagnóstico, un flujo distinto. Abajo se muestra el diagnóstico actual; solo los alfabetos se pueden editar.'
            : 'Este paciente no tiene una etapa de tratamiento activa para corregir.'}
        </p>
        {tieneEtapaActiva && (
          <p className="mt-1">
            Los alfabetos sí se pueden cargar y corregir: no cambian el
            tratamiento.
          </p>
        )}
      </div>
    </CardContent>
  </Card>
)

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

const EditarPacienteView = (props: EditarPacienteViewModel): JSX.Element => {
  const {
    isLoading,
    loadError,
    notFound,
    catalogos,
    isLoadingCatalogos,
    catalogosError,
    paso,
    pasos,
    jumpToStep,
    identidad,
    identidadErrors,
    identidadDirty,
    isSavingIdentidad,
    identidadSaveError,
    fichaDuplicada,
    avisoTelefono,
    emailBloqueado,
    setIdentidadField,
    onBlurIdentidad,
    fechaNacimientoDate,
    fechaNacimientoMin,
    fechaNacimientoMax,
    onSelectFechaNacimiento,
    saveIdentidad,
    etapaFresca,
    tieneEtapaActiva,
    alfabetosEditables,
    diagnostico,
    diagnosticoErrors,
    diagnosticoDirty,
    isSavingDiagnostico,
    diagnosticoSaveError,
    setCausa,
    setAlgoritmo,
    toggleBloqueo,
    setModalidad,
    setAlfabetos,
    saveDiagnostico,
    isSavingAlfabetos,
    saveAlfabetos,
    footerAction,
    cancel,
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

  const saveError = paso === 1 ? identidadSaveError : diagnosticoSaveError
  // La ficha duplicada es del error de identidad: solo se linkea en ese paso.
  const fichaDuplicadaVisible = paso === 1 ? fichaDuplicada : null

  const catalogosListos = !isLoadingCatalogos && !catalogosError && !!catalogos

  // `render` is a thunk so the step component (which dereferences `catalogos`)
  // is only built once we know the catalogs are loaded. Recibe `disabled` para
  // que cada control del paso quede deshabilitado de verdad (teclado incluido)
  // cuando la etapa no está fresca, en vez de solo un overlay pointer-events.
  const renderDiagnosticoSlot = (
    render: (disabled: boolean) => JSX.Element,
  ): JSX.Element => {
    if (!tieneEtapaActiva)
      return <DiagnosticoLockedCartel tieneEtapaActiva={false} />
    if (!catalogosListos)
      return (
        <p className="text-muted-foreground">
          {catalogosError
            ? `No se pudieron cargar los catálogos: ${catalogosError}`
            : 'Cargando catálogos…'}
        </p>
      )
    return (
      <div className="flex flex-col gap-6">
        {!etapaFresca && (
          <DiagnosticoLockedCartel tieneEtapaActiva={tieneEtapaActiva} />
        )}
        {render(!etapaFresca)}
      </div>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col p-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow text-muted-foreground">
            Editar paciente · Paso {paso} de 3
          </div>
          <h1 className="mt-1 text-4xl font-medium tracking-tight">
            Corrigiendo{' '}
            <em className="italic font-light text-muted-foreground">
              su camino
            </em>
          </h1>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Editá los datos que ya tenía el paciente. Podés moverte libremente
            entre los tres pasos y guardar cada sección por separado.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={cancel}>
          Volver al detalle
        </Button>
      </header>

      <WizardStepper pasos={pasos} onJumpToStep={jumpToStep} />

      {saveError && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive-bg px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="flex-1">
            {fichaDuplicadaVisible ? (
              <>
                {EMAIL_EN_FICHA_DE}{' '}
                {fichaDuplicadaVisible.accesible ? (
                  <GuardedLink
                    href={`/pacientes/${fichaDuplicadaVisible.id}/camino`}
                    className="font-medium underline underline-offset-4"
                  >
                    {fichaDuplicadaVisible.nombre}
                  </GuardedLink>
                ) : (
                  <span className="font-medium">
                    {fichaDuplicadaVisible.nombre}
                  </span>
                )}
                .
              </>
            ) : (
              saveError
            )}
          </p>
        </div>
      )}

      <div className="mt-8">
        {paso === 1 && (
          <IdentidadStep
            identidad={{
              nombre: identidad.nombre,
              fechaNacimiento: identidad.fechaNacimiento,
              email: identidad.email,
              telefono: identidad.telefono,
            }}
            errores={identidadErrors}
            avisoTelefono={avisoTelefono}
            onChange={setIdentidadField}
            onBlur={(field) => onBlurIdentidad(`identidad.${field}`)}
            fechaNacimientoDate={fechaNacimientoDate}
            fechaNacimientoMin={fechaNacimientoMin}
            fechaNacimientoMax={fechaNacimientoMax}
            onSelectFechaNacimiento={onSelectFechaNacimiento}
            emailBloqueado={emailBloqueado}
          />
        )}

        {paso === 2 &&
          renderDiagnosticoSlot((disabled) => (
            <DiagnosticoStep
              diagnostico={{
                causaId: diagnostico.causaId,
                bloqueoIds: diagnostico.bloqueoIds,
                algoritmoId: diagnostico.algoritmoId,
              }}
              errores={diagnosticoErrors}
              causas={catalogos!.causa}
              bloqueos={catalogos!.bloqueos}
              algoritmos={catalogos!.algoritmo}
              onSelectCausa={setCausa}
              onToggleBloqueo={toggleBloqueo}
              onSelectAlgoritmo={setAlgoritmo}
              disabled={disabled}
            />
          ))}

        {paso === 3 &&
          renderDiagnosticoSlot((disabled) => (
            <PlanStep
              plan={{
                modalidadId: diagnostico.modalidadId,
                alfabetos: diagnostico.alfabetos,
              }}
              errores={diagnosticoErrors}
              modalidades={catalogos!.modalidades}
              alfabetos={catalogos!.alfabetos}
              onSelectModalidad={setModalidad}
              onChangeAlfabetos={setAlfabetos}
              modalidadDisabled={disabled}
              alfabetosDisabled={!alfabetosEditables}
            />
          ))}
      </div>

      {/* Footer: solo el guardado de la sección. La navegación entre pasos
          vive en las tabs del stepper; "Volver al detalle" está en el header. */}
      {footerAction !== null && (
        <div className="mt-6 flex justify-end border-t border-border pt-6">
          {footerAction === 'identidad' && (
            <Button
              type="button"
              onClick={saveIdentidad}
              disabled={!identidadDirty || isSavingIdentidad}
            >
              {isSavingIdentidad ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          )}
          {footerAction === 'alfabetos' && (
            <Button
              type="button"
              onClick={saveAlfabetos}
              disabled={!diagnosticoDirty || isSavingAlfabetos}
            >
              {isSavingAlfabetos ? 'Guardando…' : 'Guardar alfabetos'}
            </Button>
          )}
          {footerAction === 'diagnostico' && (
            <Button
              type="button"
              onClick={saveDiagnostico}
              disabled={!diagnosticoDirty || isSavingDiagnostico}
            >
              {isSavingDiagnostico ? 'Guardando…' : 'Guardar diagnóstico'}
            </Button>
          )}
        </div>
      )}
    </main>
  )
}

export { EditarPacienteView }
