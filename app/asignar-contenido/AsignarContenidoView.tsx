'use client'

import type { JSX } from 'react'
import { CalendarX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
import { GuardedLink } from '@/components/navigation'
import { IniciarTratamientoDialog } from '@/components/tratamiento'
import type { AsignarContenidoViewModel } from './controllers'
import { PacienteSelectorCard } from './components/PacienteSelectorCard'
import { PlanEnviosCard } from './components/PlanEnviosCard'

const AsignarContenidoView = (vm: AsignarContenidoViewModel): JSX.Element => {
  const {
    pacientes,
    contenidosBySlot,
    frasesPorSemana,
    selectedPacienteId,
    onSelectPaciente,
    pendingPacienteId,
    confirmSwitchPaciente,
    cancelSwitchPaciente,
    currentPlan,
    setSemana,
    canSave,
    onSave,
    isSaving,
    saveError,
    justSaved,
    semanasConContenido,
    totalSemanas,
    esSemanaPasada,
    puedeIniciar,
    isIniciarOpen,
    setIniciarOpen,
    avisoDeInicio,
    onIniciar,
    isIniciando,
    isDirty,
    weeks,
    etapaId,
    pacienteCtx,
    semanasPorNivel,
    isInitialLoading,
    isPlanLoading,
    error,
  } = vm

  const selectedPaciente = pacientes.find((p) => p.id === selectedPacienteId)

  // Full-page skeleton: only during initial page load (no pacientes yet)
  if (isInitialLoading) {
    return (
      <main className="p-8">
        {/* page-head skeleton */}
        <div className="mb-7 flex items-end justify-between border-b border-border pb-5">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="h-36 w-full" />
        <Skeleton className="mt-5 h-96 w-full" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-destructive">{error}</p>
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  // Determine if there is no plan to show for the selected patient:
  // either no active treatment, or an active treatment whose duration could not
  // be resolved (weeks === 0 → modality without cantidad_sesiones/niveles).
  // Without this second case the patient would land on PlanEnviosCard's empty
  // "Seleccioná un paciente…" message despite having a patient selected.
  const sinEtapaActiva =
    selectedPacienteId !== null && !isPlanLoading && etapaId === null
  const planSinDuracion =
    selectedPacienteId !== null &&
    !isPlanLoading &&
    etapaId !== null &&
    weeks === 0
  const sinPlanDisponible = sinEtapaActiva || planSinDuracion

  return (
    <main className="p-8">
      {/* page-head */}
      <header className="mb-7 flex items-end justify-between border-b border-border pb-5">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-accent-500">
            Contenido &middot; Plan de env&iacute;os
          </div>
          <h1 className="font-display mt-2 text-[40px] font-normal leading-[1.05] tracking-[-0.02em] text-foreground">
            Asignar <em className="font-display italic">contenido</em>
          </h1>
          <p className="mt-1.5 max-w-[600px] text-[14px] text-muted-foreground">
            Eleg&iacute; un paciente y arm&aacute; su recorrido semana a semana:
            vos eleg&iacute;s la meditaci&oacute;n, el mantra, el egregor, el
            CMA y el IC de cada semana, y las tres frases motivacionales se
            derivan solas del diagn&oacute;stico.
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <GuardedLink href="/pacientes">Volver a pacientes</GuardedLink>
        </Button>
      </header>

      {/* PacienteSelectorCard */}
      <PacienteSelectorCard
        pacientes={pacientes}
        selectedPacienteId={selectedPacienteId}
        onSelectPaciente={onSelectPaciente}
        weeks={weeks}
        pacienteCtx={pacienteCtx}
      />

      {/* No-plan state: patient selected but no active treatment, or one whose
          duration could not be resolved */}
      {sinPlanDisponible ? (
        <Card className="mt-5">
          <CardContent className="pt-5">
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CalendarX
                size={40}
                className="text-muted-foreground opacity-40"
                aria-hidden
              />
              <p className="text-[14px] text-muted-foreground">
                {sinEtapaActiva
                  ? 'Este paciente no tiene un tratamiento activo.'
                  : 'No se pudo determinar la duración del plan de este paciente.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* PlanEnviosCard — shows skeleton on patient switch (isPlanLoading) */
        <PlanEnviosCard
          weeks={weeks}
          currentPlan={currentPlan}
          contenidosBySlot={contenidosBySlot}
          frasesPorSemana={frasesPorSemana}
          semanasPorNivel={semanasPorNivel}
          semanasConContenido={semanasConContenido}
          totalSemanas={totalSemanas}
          canSave={canSave}
          puedeIniciar={puedeIniciar}
          esSemanaPasada={esSemanaPasada}
          onIniciar={() => setIniciarOpen(true)}
          isIniciando={isIniciando}
          isPlanLoading={isPlanLoading}
          currentWeek={pacienteCtx?.currentWeek ?? null}
          pacienteNombre={selectedPaciente?.nombre ?? null}
          justSaved={justSaved}
          isSaving={isSaving}
          saveError={saveError}
          onSave={onSave}
          setSemana={setSemana}
        />
      )}

      <IniciarTratamientoDialog
        open={isIniciarOpen}
        onOpenChange={setIniciarOpen}
        pacienteNombre={selectedPaciente?.nombre ?? ''}
        semanasConContenido={semanasConContenido}
        totalSemanas={weeks}
        aviso={avisoDeInicio}
        guardaCambios={isDirty}
        isSubmitting={isIniciando}
        onConfirm={onIniciar}
      />

      {/* Dirty-guard: confirm patient switch when there are unsaved changes */}
      <AlertDialog open={pendingPacienteId !== null}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Cambiar de paciente y descartar lo cargado?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelSwitchPaciente}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmSwitchPaciente}
            >
              Descartar y cambiar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

export { AsignarContenidoView }
