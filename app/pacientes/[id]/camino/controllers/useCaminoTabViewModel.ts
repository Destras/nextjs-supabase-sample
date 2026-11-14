'use client'

import { useParams } from 'next/navigation'
import { useFetchPacienteById } from '@/app/controllers/Paciente'
import type { Paciente } from '@/app/controllers/Paciente'

interface CaminoTabViewModel {
  readonly paciente: Paciente | null
  readonly isLoading: boolean
  readonly error: string | null
}

const useCaminoTabViewModel = (): CaminoTabViewModel => {
  const params = useParams<{ id: string }>()
  const { paciente, isLoading, error } = useFetchPacienteById(params.id)

  return {
    paciente,
    isLoading,
    error,
  }
}

export { useCaminoTabViewModel }
export type { CaminoTabViewModel }
