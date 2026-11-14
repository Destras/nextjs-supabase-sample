'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { hasEtapaActiva } from '@/app/controllers/Paciente'
import { removeQueryParam } from '@/app/utils/removeQueryParam'
import type { Paciente } from '@/app/controllers/Paciente'
import { FinalizarTratamientoDialog } from './FinalizarTratamientoDialog'

interface TratamientoActionsProps {
  readonly paciente: Paciente
  readonly onCerrada: () => void
}

// Único cluster de acciones del header del detalle (DEC-13). Absorbe lo que
// antes eran botones sueltos (Editar + "Mensaje"/"Sesión", estos últimos
// eliminados por estar fuera del MVP) en un DropdownMenu con trigger "⋯".
// El ítem "Nuevo tratamiento" (Epic 2, caso !hasEtapaActiva) se agrega acá
// mismo sin tocar HeaderBlock.
const TratamientoActions = ({
  paciente,
  onCerrada,
}: TratamientoActionsProps) => {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  // Deep link desde la alerta medicion_cierre_pendiente (`?finalizar=1`,
  // DEC-32/T5.1): abre el diálogo ya en el primer render si hay una etapa
  // activa para finalizar. Estado inicial perezoso, no un efecto — se lee
  // una sola vez al montar, así cerrar el diálogo no lo reabre solo.
  const [isFinalizarOpen, setIsFinalizarOpen] = useState(
    () => searchParams.get('finalizar') === '1' && hasEtapaActiva(paciente),
  )

  // El deep link es one-shot (MED-008): al cerrar el diálogo (cancelar o
  // confirmar, ambos pasan por onOpenChange(false)) se quita `finalizar` de
  // la URL con replace — sin entrada nueva en el historial — para que un
  // reload o el link compartido no lo reabran. Abrir desde el menu "⋯" no
  // toca la URL.
  const handleFinalizarOpenChange = (open: boolean) => {
    setIsFinalizarOpen(open)
    if (!open && searchParams.has('finalizar')) {
      router.replace(removeQueryParam(pathname, searchParams, 'finalizar'), {
        scroll: false,
      })
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Acciones del tratamiento"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/pacientes/${paciente.id}/editar`}>Editar</Link>
          </DropdownMenuItem>
          {hasEtapaActiva(paciente) && (
            <DropdownMenuItem onClick={() => setIsFinalizarOpen(true)}>
              Finalizar tratamiento
            </DropdownMenuItem>
          )}
          {!hasEtapaActiva(paciente) && (
            <DropdownMenuItem asChild>
              <Link href={`/pacientes/${paciente.id}/nuevo-tratamiento`}>
                Nuevo tratamiento
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <FinalizarTratamientoDialog
        pacienteId={paciente.id}
        open={isFinalizarOpen}
        onOpenChange={handleFinalizarOpenChange}
        onCerrada={onCerrada}
      />
    </>
  )
}

export { TratamientoActions }
export type { TratamientoActionsProps }
