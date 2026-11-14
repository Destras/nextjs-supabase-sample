'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { verificarSesionDeConsola } from './verificarSesionDeConsola'

interface UseExpulsarSesionInvalidaInput {
  // false en las pantallas de /auth/*: ahí no hay sesión que cuidar, y
  // verificarla desde el login sería un loop de redirects.
  readonly activo: boolean
  readonly pathname: string
}

interface UseExpulsarSesionInvalidaResult {
  // true desde que se decide expulsar hasta que el login toma la pantalla: el
  // shell no dibuja el panel en ese lapso.
  readonly expulsando: boolean
}

const RUTA_LOGIN = '/auth/login'

// Saca del panel a un navegador cuya sesión dejó de valer (pulidoBeta /
// BETA-045). Verifica al montar el shell y en cada cambio de pantalla; si la
// sesión ya no sirve o el usuario dejó de ser de consola, cierra la sesión de
// ESTE navegador y va al login con el motivo en `?error=`.
//
// Es una salida forzada: usa `router.replace` directo, sin pasar por el guard
// de cambios sin guardar (no hay nada que el usuario pueda guardar ya).
const useExpulsarSesionInvalida = ({
  activo,
  pathname,
}: UseExpulsarSesionInvalidaInput): UseExpulsarSesionInvalidaResult => {
  const router = useRouter()
  const [expulsando, setExpulsando] = useState(false)

  useEffect(() => {
    if (!activo) {
      setExpulsando(false)
      return
    }

    let vigente = true

    const verificar = async (): Promise<void> => {
      const supabase = createClient()
      const motivo = await verificarSesionDeConsola(supabase)
      if (motivo === null || !vigente) return

      setExpulsando(true)
      try {
        // `scope: 'local'`: el default ('global') cerraría también las otras
        // sesiones del usuario (igual que en lib/supabase/proxy.ts).
        await supabase.auth.signOut({ scope: 'local' })
      } catch {
        // Sin red el signOut puede fallar; se va al login igual.
      }
      router.replace(`${RUTA_LOGIN}?error=${motivo}`)
    }

    void verificar()

    return () => {
      vigente = false
    }
  }, [activo, pathname, router])

  return { expulsando: activo && expulsando }
}

export type { UseExpulsarSesionInvalidaInput, UseExpulsarSesionInvalidaResult }
export { useExpulsarSesionInvalida }
