'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useAlertasCount } from '@/app/controllers/Alerta'

interface AlertasCountContextValue {
  readonly count: number
  readonly isLoading: boolean
  readonly error: string | null
  readonly adjust: (delta: number) => void
  // Reconciliación real contra el servidor. `adjust` sirve para el delta exacto
  // de marcar/desmarcar una alerta; `refetch` para las acciones donde no se
  // sabe cuántas alertas cambiaron (cerrar un tratamiento) y que además no
  // cambian de ruta, que es cuando el count se refrescaba solo.
  readonly refetch: () => void
}

const AlertasCountContext = createContext<AlertasCountContextValue | null>(null)

interface AlertasCountProviderProps {
  children: ReactNode
}

const AlertasCountProvider = ({ children }: AlertasCountProviderProps) => {
  const { count: fetched, isLoading, error, refetch } = useAlertasCount()
  const [count, setCount] = useState(fetched)

  useEffect(() => {
    setCount(fetched)
  }, [fetched])

  const adjust = useCallback((delta: number): void => {
    setCount((c) => Math.max(0, c + delta))
  }, [])

  return (
    <AlertasCountContext.Provider
      value={{ count, isLoading, error, adjust, refetch }}
    >
      {children}
    </AlertasCountContext.Provider>
  )
}

const useAlertasCountValue = (): AlertasCountContextValue => {
  const ctx = useContext(AlertasCountContext)
  if (!ctx) {
    throw new Error(
      'useAlertasCountValue must be used within an AlertasCountProvider',
    )
  }
  return ctx
}

export { AlertasCountProvider, useAlertasCountValue }
export type { AlertasCountContextValue }
