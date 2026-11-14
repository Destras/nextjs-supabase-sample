'use client'

import { useRouter } from 'next/navigation'
import { PackageOpen } from 'lucide-react'
import { UserAvatar } from '@/components/user-avatar'
import type { PacienteSinIniciar } from '@/app/controllers/Paciente'
import { DashboardCard } from './DashboardCard'

interface SinIniciarCardProps {
  readonly pacientes: ReadonlyArray<PacienteSinIniciar>
}

// Pacientes cuya etapa activa todavía no arrancó (per DEC-6c — "¿arrancó?",
// no "¿tiene cero entregas?"). Acción de onboarding: cada fila lleva al tab de
// contenido del paciente para armarle el plan e iniciar su tratamiento. Sin mockup en
// Aurora → reusa DashboardCard + el patrón de fila de "Requieren tu mirada".
const SinIniciarCard = ({ pacientes }: SinIniciarCardProps) => {
  const router = useRouter()

  return (
    <DashboardCard
      kicker="Mis pacientes"
      title="Sin iniciar"
      description="Esperan que inicies su tratamiento"
    >
      {pacientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <PackageOpen className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Todos tus pacientes activos ya arrancaron su tratamiento.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {pacientes.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => router.push(`/pacientes/${p.id}/contenido`)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50"
              >
                <UserAvatar name={p.nombre} size="sm" />
                <span className="text-sm font-medium">{p.nombre}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  )
}

export { SinIniciarCard }
export type { SinIniciarCardProps }
