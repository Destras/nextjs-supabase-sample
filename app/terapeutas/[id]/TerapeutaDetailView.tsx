'use client'

import { AlertTriangle, Inbox } from 'lucide-react'
import type { TerapeutaDetailViewModel } from './controllers'
import { TerapeutaPacientesTable } from './components/TerapeutaPacientesTable'
import { EstadoTerapeutaBadge } from '../components/EstadoTerapeutaBadge'
import { EditarTerapeutaModal } from '../components/EditarTerapeutaModal'
import { DesactivarTerapeutaDialog } from '../components/DesactivarTerapeutaDialog'
import { Button } from '@/components/ui/button'
import { TERAPEUTA_STATE } from '@/app/controllers/Terapeuta'
import { AlertaRow, AlertaRowSkeleton } from '@/components/alertas'

const TerapeutaDetailView = (vm: TerapeutaDetailViewModel) => {
  if (vm.isLoading) {
    return (
      <main className="flex min-h-dvh flex-col p-8">
        <p className="text-sm text-muted-foreground">Cargando terapeuta...</p>
      </main>
    )
  }

  if (vm.notFound) {
    return (
      <main className="flex min-h-dvh flex-col p-8">
        <h1 className="mb-6 text-2xl font-semibold">Terapeuta no encontrado</h1>
        <p className="text-sm text-muted-foreground">
          El terapeuta que estás buscando no existe.
        </p>
      </main>
    )
  }

  if (vm.error || !vm.terapeuta) {
    return (
      <main className="flex min-h-dvh flex-col p-8">
        <p className="text-sm text-destructive">
          {vm.error ?? 'Error desconocido'}
        </p>
      </main>
    )
  }

  const t = vm.terapeuta

  return (
    <main className="flex min-h-dvh flex-col gap-8 p-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.profile.name}</h1>
          <p className="text-sm text-muted-foreground">{t.email}</p>
          {t.telefono && (
            <p className="text-sm text-muted-foreground">{t.telefono}</p>
          )}
          <div className="mt-2">
            <EstadoTerapeutaBadge estado={t.state} />
          </div>
        </div>
        {(t.state === TERAPEUTA_STATE.ACTIVO ||
          t.state === TERAPEUTA_STATE.INACTIVO) && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={vm.onOpenEditar}>
              Editar
            </Button>
            {t.state === TERAPEUTA_STATE.ACTIVO && (
              <Button variant="destructive" onClick={vm.onOpenDesactivar}>
                Desactivar
              </Button>
            )}
            {t.state === TERAPEUTA_STATE.INACTIVO && (
              <Button onClick={vm.onReactivar}>Reactivar</Button>
            )}
          </div>
        )}
      </header>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Pacientes a cargo</h2>
        <TerapeutaPacientesTable
          pacientes={vm.pacientes}
          onOpenPaciente={vm.onOpenPaciente}
        />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Alertas</h2>
        {vm.isLoadingAlertas ? (
          <div className="rounded-lg border border-border px-6">
            <AlertaRowSkeleton />
            <AlertaRowSkeleton />
          </div>
        ) : vm.alertasError ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border py-12 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive/70" />
            <p className="text-muted-foreground">{vm.alertasError}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          </div>
        ) : vm.alertas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border py-12 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Este terapeuta no tiene alertas activas
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border px-6">
            {vm.alertas.map((alerta) => (
              <AlertaRow
                key={`${alerta.tipo}:${alerta.eventoRef}:${alerta.pacienteId}`}
                alerta={alerta}
                onOpenPaciente={vm.onOpenPaciente}
              />
            ))}
          </div>
        )}
      </section>

      <EditarTerapeutaModal
        terapeuta={vm.editarOpen ? t : null}
        onClose={vm.onCloseEditar}
        onSuccess={vm.onEditarSuccess}
      />
      <DesactivarTerapeutaDialog
        terapeuta={vm.desactivarTarget}
        motivo={vm.desactivarMotivo}
        motivoError={vm.desactivarMotivoError}
        submitError={vm.desactivarSubmitError}
        isSubmitting={vm.isDeactivating}
        onMotivoChange={vm.onDesactivarMotivoChange}
        onConfirm={vm.onConfirmDesactivar}
        onClose={vm.onCloseDesactivar}
      />
    </main>
  )
}

export { TerapeutaDetailView }
