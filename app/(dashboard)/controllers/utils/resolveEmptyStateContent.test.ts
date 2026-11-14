import { resolveEmptyStateContent } from './resolveEmptyStateContent'

describe('resolveEmptyStateContent', () => {
  it('returns the onboarding copy for a plain terapeuta with no pacientes', () => {
    expect(resolveEmptyStateContent(false)).toEqual({
      title: 'Todavía no tenés',
      titleHighlight: 'pacientes',
      message:
        'Empezá cargando al primero para ver acá la salud de tus pacientes.',
      ctaLabel: 'Cargar tu primer paciente',
      ctaHref: '/pacientes/nuevo',
    })
  })

  it('returns non-onboarding copy for an admin with no pacientes propios (DAS-001)', () => {
    expect(resolveEmptyStateContent(true)).toEqual({
      title: 'No tenés pacientes',
      titleHighlight: 'asignados',
      message:
        'Tu vista general de la red está en «General». Acá vas a ver tus casos propios apenas tengas un paciente asignado.',
      ctaLabel: 'Cargar un paciente',
      ctaHref: '/pacientes/nuevo',
    })
  })
})
