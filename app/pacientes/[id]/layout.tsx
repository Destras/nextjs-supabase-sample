'use client'

import { useRouter, useSelectedLayoutSegment } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IniciarTratamientoDialog } from '@/components/tratamiento'
import { usePacienteLayoutViewModel } from './controllers'
import { AccessDeniedState } from './components/AccessDeniedState'
import { BienvenidaPendienteNotice } from './components/BienvenidaPendienteNotice'
import { HeaderBlock } from './components/HeaderBlock'
import { HeaderSkeleton } from './components/HeaderSkeleton'
import { InfoGeneralCard } from './components/InfoGeneralCard'
import { TabBar } from './components/TabBar'

interface LayoutProps {
  readonly children: React.ReactNode
}

const PacienteLayout = ({ children }: LayoutProps) => {
  const router = useRouter()
  const segment = useSelectedLayoutSegment()
  const isBareRoute = segment === 'editar' || segment === 'nuevo-tratamiento'
  const vm = usePacienteLayoutViewModel({ skip: isBareRoute })
  const { paciente, isLoading, error, refetch } = vm

  // The edit route (/pacientes/[id]/editar) and the nuevo-tratamiento route
  // (/pacientes/[id]/nuevo-tratamiento) are focused, full-screen forms that
  // bring their own chrome. Render them bare — without the detail header, the
  // read-only InfoGeneralCard (which shows data that either route is editing
  // or about to replace), or the TabBar (which highlights no tab on these
  // segments).
  if (isBareRoute) {
    return <>{children}</>
  }

  if (!isLoading && !error && paciente === null) {
    return <AccessDeniedState />
  }

  return (
    <main className="flex min-h-dvh flex-col p-8">
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.back()}
        className="mb-4 self-start"
      >
        <ChevronLeft />
        Volver
      </Button>

      {isLoading ? (
        <HeaderSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-destructive">Error: {error}</p>
        </div>
      ) : paciente === null ? null : (
        <>
          <HeaderBlock
            paciente={paciente}
            onCerrada={refetch}
            puedeIniciar={vm.puedeIniciar}
            onIniciar={() => vm.setIniciarOpen(true)}
          />
          {vm.bienvenidaPendiente && (
            <BienvenidaPendienteNotice
              nombre={paciente.nombre}
              isSending={vm.isReenviando}
              onReenviar={() => void vm.onReenviarBienvenida()}
            />
          )}
          <IniciarTratamientoDialog
            open={vm.isIniciarOpen}
            onOpenChange={vm.setIniciarOpen}
            pacienteNombre={paciente.nombre}
            semanasConContenido={vm.semanasConContenido}
            totalSemanas={vm.totalSemanas}
            aviso={vm.aviso}
            guardaCambios={false}
            isSubmitting={vm.isIniciando}
            onConfirm={vm.onIniciar}
          />
          <div className="mb-6">
            <InfoGeneralCard paciente={paciente} />
          </div>
          <TabBar />
          {children}
        </>
      )}
    </main>
  )
}

export default PacienteLayout
