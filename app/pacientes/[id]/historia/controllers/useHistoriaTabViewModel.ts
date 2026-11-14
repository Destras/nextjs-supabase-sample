'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import {
  useFetchHistoriaDelPaciente,
  EtapaStatus,
} from '@/app/controllers/Tratamiento'
import type {
  EtapaHistoria,
  CentroEnergetico,
} from '@/app/controllers/Tratamiento'

interface CapituloVM {
  readonly etapa: EtapaHistoria
  readonly expandidoInicial: boolean
}

interface HistoriaTabViewModel {
  readonly capitulos: ReadonlyArray<CapituloVM>
  // Catálogo de centros (orden fijo), necesario para que la matriz de
  // mediciones (④, PR5) tenga el mismo orden de filas en todos los
  // capítulos — ver design §4.4/§5.5.
  readonly centros: ReadonlyArray<CentroEnergetico>
  readonly isLoading: boolean
  readonly error: string | null
  readonly isEmpty: boolean
  readonly refresh: () => void
}

const useHistoriaTabViewModel = (): HistoriaTabViewModel => {
  const params = useParams<{ id: string }>()
  const { etapas, centros, isLoading, error, refresh } =
    useFetchHistoriaDelPaciente(params.id)

  const isEmpty = etapas.length === 0

  const capitulos = useMemo<ReadonlyArray<CapituloVM>>(() => {
    if (etapas.length === 0) return []

    const hayEnCurso = etapas.some((e) => e.status === EtapaStatus.EN_CURSO)

    return etapas.map((etapa, idx) => ({
      etapa,
      expandidoInicial: hayEnCurso
        ? etapa.status === EtapaStatus.EN_CURSO
        : idx === 0,
    }))
  }, [etapas])

  return { capitulos, centros, isLoading, error, isEmpty, refresh }
}

export type { CapituloVM, HistoriaTabViewModel }
export { useHistoriaTabViewModel }
