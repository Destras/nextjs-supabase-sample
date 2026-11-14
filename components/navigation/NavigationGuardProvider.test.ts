import { act, fireEvent, renderHook, screen } from '@testing-library/react'
import {
  NavigationGuardProvider,
  useNavigationGuard,
  useUnsavedChangesGuard,
  type NavigationGuard,
} from './NavigationGuardProvider'

interface ScreenProps {
  isDirty: boolean
}

// Una "pantalla" que declara su estado sucio y, a la vez, pide navegar.
const useScreen = ({ isDirty }: ScreenProps): NavigationGuard => {
  useUnsavedChangesGuard(isDirty)
  return useNavigationGuard()
}

const dispatchBeforeUnload = (): Event => {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event
}

describe('NavigationGuardProvider', () => {
  let proceed: jest.Mock

  beforeEach(() => {
    proceed = jest.fn()
  })

  describe('without unsaved changes', () => {
    it('runs the navigation right away', () => {
      const { result } = renderHook(useScreen, {
        wrapper: NavigationGuardProvider,
        initialProps: { isDirty: false },
      })
      act(() => {
        result.current.guardNavigation(proceed)
      })
      expect(proceed).toHaveBeenCalledTimes(1)
    })

    it('does not open the confirmation dialog', () => {
      const { result } = renderHook(useScreen, {
        wrapper: NavigationGuardProvider,
        initialProps: { isDirty: false },
      })
      act(() => {
        result.current.guardNavigation(proceed)
      })
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })

    it('reports no unsaved changes', () => {
      const { result } = renderHook(useScreen, {
        wrapper: NavigationGuardProvider,
        initialProps: { isDirty: false },
      })
      expect(result.current.hasUnsavedChanges()).toBe(false)
    })

    it('lets the tab close without a browser warning', () => {
      renderHook(useScreen, {
        wrapper: NavigationGuardProvider,
        initialProps: { isDirty: false },
      })
      expect(dispatchBeforeUnload().defaultPrevented).toBe(false)
    })
  })

  describe('with unsaved changes', () => {
    it('reports unsaved changes', () => {
      const { result } = renderHook(useScreen, {
        wrapper: NavigationGuardProvider,
        initialProps: { isDirty: true },
      })
      expect(result.current.hasUnsavedChanges()).toBe(true)
    })

    it('holds the navigation until the user decides', () => {
      const { result } = renderHook(useScreen, {
        wrapper: NavigationGuardProvider,
        initialProps: { isDirty: true },
      })
      act(() => {
        result.current.guardNavigation(proceed)
      })
      expect(proceed).not.toHaveBeenCalled()
    })

    it('asks for confirmation with the approved copy', () => {
      const { result } = renderHook(useScreen, {
        wrapper: NavigationGuardProvider,
        initialProps: { isDirty: true },
      })
      act(() => {
        result.current.guardNavigation(proceed)
      })
      expect(screen.getByRole('alertdialog')).toHaveTextContent(
        'Cambios sin guardar¿Salir y descartar lo cargado?CancelarDescartar y salir',
      )
    })

    it('runs the navigation once when the user confirms', () => {
      const { result } = renderHook(useScreen, {
        wrapper: NavigationGuardProvider,
        initialProps: { isDirty: true },
      })
      act(() => {
        result.current.guardNavigation(proceed)
      })
      fireEvent.click(screen.getByRole('button', { name: 'Descartar y salir' }))
      expect(proceed).toHaveBeenCalledTimes(1)
    })

    it('closes the dialog when the user confirms', () => {
      const { result } = renderHook(useScreen, {
        wrapper: NavigationGuardProvider,
        initialProps: { isDirty: true },
      })
      act(() => {
        result.current.guardNavigation(proceed)
      })
      fireEvent.click(screen.getByRole('button', { name: 'Descartar y salir' }))
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })

    it('drops the navigation when the user cancels', () => {
      const { result } = renderHook(useScreen, {
        wrapper: NavigationGuardProvider,
        initialProps: { isDirty: true },
      })
      act(() => {
        result.current.guardNavigation(proceed)
      })
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
      expect(proceed).not.toHaveBeenCalled()
    })

    it('closes the dialog when the user cancels', () => {
      const { result } = renderHook(useScreen, {
        wrapper: NavigationGuardProvider,
        initialProps: { isDirty: true },
      })
      act(() => {
        result.current.guardNavigation(proceed)
      })
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })

    it('warns before the tab closes', () => {
      renderHook(useScreen, {
        wrapper: NavigationGuardProvider,
        initialProps: { isDirty: true },
      })
      expect(dispatchBeforeUnload().defaultPrevented).toBe(true)
    })
  })

  describe('once the changes are saved or discarded', () => {
    it('navigates right away again', () => {
      const { result, rerender } = renderHook(useScreen, {
        wrapper: NavigationGuardProvider,
        initialProps: { isDirty: true },
      })
      rerender({ isDirty: false })
      act(() => {
        result.current.guardNavigation(proceed)
      })
      expect(proceed).toHaveBeenCalledTimes(1)
    })

    it('stops warning before the tab closes', () => {
      const { rerender } = renderHook(useScreen, {
        wrapper: NavigationGuardProvider,
        initialProps: { isDirty: true },
      })
      rerender({ isDirty: false })
      expect(dispatchBeforeUnload().defaultPrevented).toBe(false)
    })

    it('stops warning before the tab closes after the screen unmounts', () => {
      const { unmount } = renderHook(useScreen, {
        wrapper: NavigationGuardProvider,
        initialProps: { isDirty: true },
      })
      unmount()
      expect(dispatchBeforeUnload().defaultPrevented).toBe(false)
    })
  })

  describe('outside the provider', () => {
    it('runs the navigation right away even with unsaved changes', () => {
      const { result } = renderHook(useScreen, {
        initialProps: { isDirty: true },
      })
      act(() => {
        result.current.guardNavigation(proceed)
      })
      expect(proceed).toHaveBeenCalledTimes(1)
    })

    it('reports no unsaved changes', () => {
      const { result } = renderHook(useScreen, {
        initialProps: { isDirty: true },
      })
      expect(result.current.hasUnsavedChanges()).toBe(false)
    })

    it('still warns before the tab closes', () => {
      renderHook(useScreen, { initialProps: { isDirty: true } })
      expect(dispatchBeforeUnload().defaultPrevented).toBe(true)
    })
  })
})
