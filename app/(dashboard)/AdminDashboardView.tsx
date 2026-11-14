'use client'

import { Plus } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { useAdminDashboardViewModel } from './controllers'
import {
  DashboardLoadingState,
  DashboardErrorState,
  AdminHeroStats,
  CargaPorTerapeutaTable,
  DistribucionesRow,
} from './components'

const AdminDashboardView = () => {
  const vm = useAdminDashboardViewModel()

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

  if (!vm.hasTerapeutas) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-8">
        <EmptyState
          title="Todavía no hay"
          titleHighlight="terapeutas"
          message="Invitá al primer terapeuta para empezar a ver la salud de la red."
          ctaLabel="Invitar terapeuta"
          ctaHref="/terapeutas"
          ctaIcon={Plus}
        />
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col gap-6 p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow text-muted-foreground">
            Vista general · Administración
          </div>
          <h1 className="mt-1 text-4xl font-medium tracking-tight">
            El sistema,{' '}
            <em className="font-light italic text-muted-foreground">
              en una sola vista
            </em>
          </h1>
          <p className="mt-2 max-w-prose text-muted-foreground">
            {vm.stats.terapeutasActivos} terapeutas activos ·{' '}
            {vm.stats.pacientesActivos} pacientes en la red.
          </p>
        </div>
      </div>

      <AdminHeroStats stats={vm.stats} />

      <CargaPorTerapeutaTable terapeutas={vm.cargaPorTerapeuta} />

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

export { AdminDashboardView }
