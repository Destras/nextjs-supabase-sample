import type { EmptyStateContent } from '../dashboardTypes'

// DAS-001: el terapeuta "de a pie" con 0 pacientes ve copy de onboarding
// ("cargar tu primer paciente"). El admin mirando "Mis casos" con 0
// pacientes propios NO está arrancando de cero — supervisa toda la red desde
// "General" y solo carece de casos propios. Mismo signo (hasPacientes=false),
// dos situaciones distintas → dos copies distintas.
const resolveEmptyStateContent = (esAdmin: boolean): EmptyStateContent =>
  esAdmin
    ? {
        title: 'No tenés pacientes',
        titleHighlight: 'asignados',
        message:
          'Tu vista general de la red está en «General». Acá vas a ver tus casos propios apenas tengas un paciente asignado.',
        ctaLabel: 'Cargar un paciente',
        ctaHref: '/pacientes/nuevo',
      }
    : {
        title: 'Todavía no tenés',
        titleHighlight: 'pacientes',
        message:
          'Empezá cargando al primero para ver acá la salud de tus pacientes.',
        ctaLabel: 'Cargar tu primer paciente',
        ctaHref: '/pacientes/nuevo',
      }

export { resolveEmptyStateContent }
