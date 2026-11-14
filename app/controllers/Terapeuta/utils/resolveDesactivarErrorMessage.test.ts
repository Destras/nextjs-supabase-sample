import { resolveDesactivarErrorMessage } from './resolveDesactivarErrorMessage'

describe('resolveDesactivarErrorMessage', () => {
  it('explains in singular that a terapeuta with 1 paciente a cargo cannot be deactivated', () => {
    expect(resolveDesactivarErrorMessage('tiene_pacientes_activos', 1)).toBe(
      'Este terapeuta tiene 1 paciente a cargo y no se puede desactivar mientras lo tenga. Todavía no se puede pasar a otro terapeuta desde el panel.',
    )
  })

  it('explains in plural that a terapeuta with several pacientes a cargo cannot be deactivated', () => {
    expect(resolveDesactivarErrorMessage('tiene_pacientes_activos', 7)).toBe(
      'Este terapeuta tiene 7 pacientes a cargo y no se puede desactivar mientras los tenga. Todavía no se pueden pasar a otro terapeuta desde el panel.',
    )
  })

  it('falls back to 0 pacientes in plural when the count is missing', () => {
    expect(resolveDesactivarErrorMessage('tiene_pacientes_activos', null)).toBe(
      'Este terapeuta tiene 0 pacientes a cargo y no se puede desactivar mientras los tenga. Todavía no se pueden pasar a otro terapeuta desde el panel.',
    )
  })

  it('tells the admin they cannot deactivate their own account', () => {
    expect(
      resolveDesactivarErrorMessage('no_puede_autodesactivarse', null),
    ).toBe('No podés desactivar tu propia cuenta.')
  })

  it('returns the generic message for an unknown code', () => {
    expect(resolveDesactivarErrorMessage('deactivate_failed', null)).toBe(
      'No pudimos desactivar al terapeuta. Intentá de nuevo.',
    )
  })

  it('returns the generic message when there is no code', () => {
    expect(resolveDesactivarErrorMessage(undefined, undefined)).toBe(
      'No pudimos desactivar al terapeuta. Intentá de nuevo.',
    )
  })

  it('returns the generic message for a code that only exists on Object.prototype', () => {
    expect(resolveDesactivarErrorMessage('toString', null)).toBe(
      'No pudimos desactivar al terapeuta. Intentá de nuevo.',
    )
  })
})
