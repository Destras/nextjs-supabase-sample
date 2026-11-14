'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { useCurrentUserId } from '@/app/controllers/Auth'
import { useTerapeutaDashboardViewModel } from './controllers'
import {
  DashboardLoadingState,
  DashboardErrorState,
  TerapeutaHeroStats,
  RequierenMiradaTable,
  SinIniciarCard,
  DistribucionesRow,
} from './components'

const NuevoPacienteButton = () => (
  <Button asChild>
    <Link href="/pacientes/nuevo">
      <Plus />
      Nuevo paciente
    </Link>
  </Button>
)

const buildSubtitulo = (activos: number, requierenMirada: number): string => {
  const base = `${activos} ${activos === 1 ? 'paciente activo' : 'pacientes activos'}.`
  if (requierenMirada > 0) {
    return `${base} ${requierenMirada} ${requierenMirada === 1 ? 'requiere' : 'requieren'} tu mirada.`
  }
  return base
}

const TerapeutaDashboardView = () => {
  const { userId } = useCurrentUserId()
  const vm = useTerapeutaDashboardViewModel(userId)

  if (vm.isLoading) {
    return <DashboardLoadingState />
  }

  if (vm.error) {
    return (
      <main className="flex min-h-dvh flex-col p-8">
        <DashboardErrorState onRetry={() => window.location.reload()} />
      </main>
    )
  }

  if (!vm.hasPacientes) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-8">
        <EmptyState {...vm.emptyState} ctaIcon={Plus} />
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col gap-6 p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow text-muted-foreground">{vm.saludo}</div>
          <h1 className="mt-1 text-4xl font-medium tracking-tight">
            Tu día{' '}
            <em className="font-light italic text-muted-foreground">
              empieza aquí
            </em>
          </h1>
          <p className="mt-2 max-w-prose text-muted-foreground">
            {buildSubtitulo(vm.stats.activos, vm.requierenMirada.length)}
          </p>
        </div>
        <NuevoPacienteButton />
      </div>

      <TerapeutaHeroStats stats={vm.stats} />

      {/* Dos columnas recién desde `lg`: el menú lateral se lleva 260 px, así
          que a ~900 px de ventana el contenido no llega a 600. `minmax(0, …)`
          deja que la tabla scrollee dentro de su card en vez de empujar a la
          card vecina fuera de la página (BETA-044). */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <RequierenMiradaTable
          pacientes={vm.requierenMirada}
          hasEvaluaciones={vm.hasEvaluaciones}
        />
        <SinIniciarCard pacientes={vm.sinIniciar} />
      </div>

      <DistribucionesRow
        distribucionEtapa={vm.distribucionEtapa}
        distribucionMes={vm.distribucionMes}
        distribucionMesSiguiente={vm.distribucionMesSiguiente}
        mesActualLabel={vm.mesActualLabel}
        mesSiguienteLabel={vm.mesSiguienteLabel}
      />
    </main>
  )
}

export { TerapeutaDashboardView }
