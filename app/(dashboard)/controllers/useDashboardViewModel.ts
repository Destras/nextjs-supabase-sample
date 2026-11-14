'use client'

import { useState } from 'react'
import { useCurrentUserProfile, ROLE } from '@/app/controllers/Auth'

// El admin también es terapeuta (tiene fila propia en `terapeutas` y su
// propio caseload). `vista` alterna entre la vista general de red y la vista
// de caseload personal, reusando `TerapeutaDashboardView` — ver DevSpec §14.
type DashboardVista = 'general' | 'caseload'

const VISTA_VALUES: ReadonlyArray<DashboardVista> = ['general', 'caseload']

const isDashboardVista = (raw: string): raw is DashboardVista =>
  (VISTA_VALUES as ReadonlyArray<string>).includes(raw)

interface DashboardViewModel {
  readonly role: ROLE | null
  readonly isLoading: boolean
  readonly error: string | null
  readonly isAuthorized: boolean
  readonly puedeAlternarVista: boolean
  readonly vista: DashboardVista
  readonly onVistaChange: (raw: string) => void
}

const useDashboardViewModel = (): DashboardViewModel => {
  const { profile, isLoading, error } = useCurrentUserProfile()
  const [vista, setVista] = useState<DashboardVista>('general')
  const role = profile?.role ?? null
  const isAuthorized = role === ROLE.ADMIN || role === ROLE.TERAPEUTA
  const puedeAlternarVista = role === ROLE.ADMIN

  // ToggleGroup (`type="single"`) emite el value crudo del item presionado, o
  // '' al deseleccionar (Radix no permite value vacío en un toggle single sin
  // deselect option) — se valida acá para que la View no necesite castear ni
  // ramificar (viewmodel-architecture.md).
  const onVistaChange = (raw: string): void => {
    if (isDashboardVista(raw)) setVista(raw)
  }

  return {
    role,
    isLoading,
    error,
    isAuthorized,
    puedeAlternarVista,
    vista,
    onVistaChange,
  }
}

export type { DashboardViewModel, DashboardVista }
export { useDashboardViewModel }
