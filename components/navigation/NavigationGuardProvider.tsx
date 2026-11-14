'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// Guard de navegación del shell (BETA-006). Una pantalla declara que tiene
// cambios sin guardar con `useUnsavedChangesGuard(isDirty)`; cualquier salida
// del shell pasa por `guardNavigation(proceed)` — los links vía `GuardedLink`,
// las navegaciones imperativas (logout, "cancelar") llamándola directo. Con
// cambios pendientes se abre un único diálogo compartido y `proceed` solo corre
// si el usuario confirma.
//
// No cubre el botón atrás/adelante del navegador: el App Router no ofrece una
// forma soportada de frenar un `popstate`.

interface NavigationGuard {
  /** `true` si alguna pantalla montada declaró cambios sin guardar. */
  readonly hasUnsavedChanges: () => boolean
  /**
   * Corre `proceed` ya mismo si no hay cambios sin guardar; si los hay, pide
   * confirmación y lo corre solo si el usuario elige descartar.
   */
  readonly guardNavigation: (proceed: () => void) => void
}

interface NavigationGuardContextValue extends NavigationGuard {
  readonly setDirty: (sourceId: string, isDirty: boolean) => void
}

const NavigationGuardContext =
  createContext<NavigationGuardContextValue | null>(null)

// Fuera del provider (auth, tests de pantallas sueltas) no hay a quién
// preguntarle: se navega directo en vez de tirar.
const UNGUARDED: NavigationGuard = {
  hasUnsavedChanges: () => false,
  guardNavigation: (proceed) => proceed(),
}

interface NavigationGuardProviderProps {
  children: ReactNode
}

const NavigationGuardProvider = ({
  children,
}: NavigationGuardProviderProps) => {
  // Ref y no estado: `guardNavigation` tiene que leer el valor del momento del
  // click, y registrar una pantalla sucia no debe re-renderizar todo el shell.
  const dirtySources = useRef<Set<string>>(new Set())
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null)

  const setDirty = useCallback((sourceId: string, isDirty: boolean): void => {
    if (isDirty) {
      dirtySources.current.add(sourceId)
    } else {
      dirtySources.current.delete(sourceId)
    }
  }, [])

  const hasUnsavedChanges = useCallback(
    (): boolean => dirtySources.current.size > 0,
    [],
  )

  const guardNavigation = useCallback((proceed: () => void): void => {
    if (dirtySources.current.size === 0) {
      proceed()
      return
    }
    setPendingNavigation(() => proceed)
  }, [])

  const cancelNavigation = (): void => {
    setPendingNavigation(null)
  }

  const confirmNavigation = (): void => {
    const proceed = pendingNavigation
    setPendingNavigation(null)
    proceed?.()
  }

  const value = useMemo(
    () => ({ hasUnsavedChanges, guardNavigation, setDirty }),
    [hasUnsavedChanges, guardNavigation, setDirty],
  )

  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
      <AlertDialog
        open={pendingNavigation !== null}
        onOpenChange={(open) => {
          if (!open) cancelNavigation()
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Salir y descartar lo cargado?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelNavigation}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmNavigation}
            >
              Descartar y salir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </NavigationGuardContext.Provider>
  )
}

const useNavigationGuard = (): NavigationGuard =>
  useContext(NavigationGuardContext) ?? UNGUARDED

/**
 * Declara que la pantalla que lo llama tiene (o no) cambios sin guardar.
 * Mientras `isDirty` sea `true`, salir por el shell pide confirmación y cerrar
 * o recargar la pestaña dispara el aviso nativo del navegador. Al desmontarse
 * la pantalla el registro se limpia solo.
 */
const useUnsavedChangesGuard = (isDirty: boolean): void => {
  const sourceId = useId()
  const setDirty = useContext(NavigationGuardContext)?.setDirty

  useEffect(() => {
    if (!setDirty) return
    setDirty(sourceId, isDirty)
    return () => {
      setDirty(sourceId, false)
    }
  }, [setDirty, sourceId, isDirty])

  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
      e.preventDefault()
      // Los navegadores modernos muestran su propio mensaje; `returnValue` es
      // el disparador legacy.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isDirty])
}

export { NavigationGuardProvider, useNavigationGuard, useUnsavedChangesGuard }
export type { NavigationGuard, NavigationGuardProviderProps }
