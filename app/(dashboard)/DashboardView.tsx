'use client'

import { useDashboardViewModel } from './controllers'
import type { DashboardVista } from './controllers'
import { ROLE } from '@/app/controllers/Auth'
import { NotAuthorizedPage } from '@/app/features/Auth/components/NotAuthorizedPage'
import { TerapeutaDashboardView } from './TerapeutaDashboardView'
import { AdminDashboardView } from './AdminDashboardView'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

// El admin también es terapeuta: alterna entre la vista general de red y su
// propio caseload personal. Sin equivalente en el mock (Aurora UI hatch #1 —
// UI nueva) — reusa el mismo patrón de ToggleGroup que PacientesView/
// AlertasView para consistencia visual. Vive en su propia barra angosta
// arriba de la vista renderizada para no pisar el header de cada una (p.ej.
// el botón "Nuevo paciente" de TerapeutaDashboardView).
// `onVistaChange` recibe el string crudo que emite ToggleGroup (incluido ''
// al deseleccionar) — la validación contra DashboardVista vive en el VM
// (viewmodel-architecture.md: sin cast ni condicional acá).
interface VistaToggleProps {
  readonly vista: DashboardVista
  readonly onVistaChange: (raw: string) => void
}

const VistaToggle = ({ vista, onVistaChange }: VistaToggleProps) => (
  <div className="flex justify-end px-8 pt-6">
    <ToggleGroup
      type="single"
      value={vista}
      onValueChange={onVistaChange}
      variant="outline"
      size="sm"
    >
      <ToggleGroupItem value="general">General</ToggleGroupItem>
      <ToggleGroupItem value="caseload">Mis casos</ToggleGroupItem>
    </ToggleGroup>
  </div>
)

const DashboardView = () => {
  const {
    role,
    isLoading,
    error,
    isAuthorized,
    puedeAlternarVista,
    vista,
    onVistaChange,
  } = useDashboardViewModel()

  if (isLoading) {
    return (
      <main className="flex min-h-dvh flex-col p-8">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-dvh flex-col p-8">
        <p className="text-sm text-destructive">{error}</p>
      </main>
    )
  }

  if (!isAuthorized) {
    return <NotAuthorizedPage />
  }

  if (role !== ROLE.ADMIN) {
    return <TerapeutaDashboardView />
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {puedeAlternarVista && (
        <VistaToggle vista={vista} onVistaChange={onVistaChange} />
      )}
      {vista === 'general' ? (
        <AdminDashboardView />
      ) : (
        <TerapeutaDashboardView />
      )}
    </div>
  )
}

export { DashboardView }
