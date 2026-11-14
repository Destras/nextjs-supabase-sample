type PasoNumero = 1 | 2 | 3
type PasoStatus = 'done' | 'active' | 'upcoming'

interface PasoDef {
  readonly n: PasoNumero
  readonly label: string
  readonly title: string
  readonly description: string
}

interface PasoView extends PasoDef {
  readonly status: PasoStatus
}

const PASOS_DEF: ReadonlyArray<PasoDef> = [
  {
    n: 1,
    label: 'PASO 01',
    title: 'Identidad',
    description: 'Datos básicos del paciente',
  },
  {
    n: 2,
    label: 'PASO 02',
    title: 'Diagnóstico',
    description: 'Causa raíz, bloqueos, algoritmo',
  },
  {
    n: 3,
    label: 'PASO 03',
    title: 'Plan',
    description: 'Modalidad y confirmación',
  },
]

const computePasos = (pasoActual: PasoNumero): ReadonlyArray<PasoView> =>
  PASOS_DEF.map((p) => ({
    ...p,
    status:
      p.n < pasoActual ? 'done' : p.n === pasoActual ? 'active' : 'upcoming',
  }))

export type { PasoNumero, PasoStatus, PasoView }
export { computePasos }
