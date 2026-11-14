'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface UseAlertasCountResult {
  readonly count: number
  readonly isLoading: boolean
  readonly error: string | null
  readonly refetch: () => void
}

// Count personal para todos los roles (el admin cuenta su propio caseload,
// igual que un terapeuta) — consumido por la campana global del shell
// (Topbar). Consistencia eventual, no realtime: refetch on mount, on window
// focus, y on route change (usePathname en el deps array — re-corre cuando
// el componente consumidor re-renderiza tras una navegación, sin que el
// shell tenga que pasar ningún prop). Si el terapeuta marca una alerta en
// /alertas, el badge reconcilia recién en el próximo de estos fetches — o
// cuando alguien llama a `refetch()`, necesario para las acciones que cambian
// el count SIN cambiar de ruta (cerrar un tratamiento apaga unas alertas y
// puede encender otras, y el terapeuta se queda en la misma pantalla). Ante
// error del RPC no se resetea `count` (se conserva el último valor
// conocido) — la campana decide en base a `error`, no a `count`, si debe
// degradar a "sin badge".
const useAlertasCount = (): UseAlertasCountResult => {
  const pathname = usePathname()
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const refetch = useCallback((): void => setRefreshTick((t) => t + 1), [])

  useEffect(() => {
    const load = async (): Promise<void> => {
      setIsLoading(true)
      setError(null)

      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc(
        'count_alertas_terapeuta',
      )

      if (rpcError) {
        setError(rpcError.message)
        setIsLoading(false)
        return
      }

      setCount((data as unknown as number) ?? 0)
      setIsLoading(false)
    }

    load()

    window.addEventListener('focus', load)
    return () => {
      window.removeEventListener('focus', load)
    }
  }, [pathname, refreshTick])

  return { count, isLoading, error, refetch }
}

export type { UseAlertasCountResult }
export { useAlertasCount }
