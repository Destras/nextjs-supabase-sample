import type { Paciente } from '@/app/controllers/Paciente'
import { PACIENTE_STATE } from '@/app/controllers/Paciente'
import {
  deriveDistribucionEtapa,
  deriveDistribucionMes,
} from './deriveDistribuciones'

const buildPaciente = (overrides: Partial<Paciente>): Paciente => ({
  id: 'p-x',
  nombre: 'Generic',
  nivelFinalizado: false,
  mesActual: null,
  mesesTotales: null,
  etapaOrdinal: null,
  evaluaciones: [],
  semanaGlobal: null,
  semanasTotales: null,
  fechaInicioEtapaActiva: null,
  etapaActivaId: null,
  sinIniciar: false,
  modalidadResumen: null,
  causaActual: null,
  bloqueosIdentificados: [],
  algoritmoActual: null,
  alfabetosActuales: [],
  ultimoScore: null,
  tendencia: 'flat',
  tieneAlerta: false,
  ultimaEvaluacion: null,
  proximaEvaluacion: null,
  inicioTratamiento: { estado: 'sin_tratamiento', fecha: null },
  tieneCuenta: false,
  bienvenidaRecibida: false,
  generalInfo: {
    telefono: null,
    email: null,
    fechaNacimiento: null,
    edad: null,
    fechaAlta: null,
  },
  state: PACIENTE_STATE.ACTIVE,
  ...overrides,
})

describe('deriveDistribucionEtapa', () => {
  it('returns an empty array for an empty caseload', () => {
    expect(deriveDistribucionEtapa([])).toEqual([])
  })

  it('groups by etapaOrdinal, computes pct and sorts numerically with "Sin etapa" last', () => {
    expect(
      deriveDistribucionEtapa([
        buildPaciente({ id: 'p-1', etapaOrdinal: 1 }),
        buildPaciente({ id: 'p-2', etapaOrdinal: 2 }),
        buildPaciente({ id: 'p-3', etapaOrdinal: 1 }),
        buildPaciente({ id: 'p-4', etapaOrdinal: null }),
      ]),
    ).toEqual([
      { label: '1', cantidad: 2, pct: 50 },
      { label: '2', cantidad: 1, pct: 25 },
      { label: 'Sin etapa', cantidad: 1, pct: 25 },
    ])
  })

  it('maps null etapaOrdinal to "Sin etapa" and places it last', () => {
    expect(
      deriveDistribucionEtapa([
        buildPaciente({ id: 'p-1', etapaOrdinal: null }),
        buildPaciente({ id: 'p-2', etapaOrdinal: 3 }),
      ]),
    ).toEqual([
      { label: '3', cantidad: 1, pct: 50 },
      { label: 'Sin etapa', cantidad: 1, pct: 50 },
    ])
  })
})

describe('deriveDistribucionMes', () => {
  it('returns an empty array for an empty caseload', () => {
    expect(deriveDistribucionMes([])).toEqual([])
  })

  // Regression: agrupar solo por mesActual (implementación vieja) hacía que
  // deriveProyeccionMesSiguiente confundiera el mes 3 (el más alto OCUPADO,
  // nadie en mes 4 todavía) con el último mes del tratamiento y perdiera esa
  // cohorte. El contrato ahora es: SIEMPRE 1..N (N = mesesTotales), 0 en los
  // meses sin pacientes.
  it('emits every month 1..N (mesesTotales) with 0 for months with no pacientes', () => {
    expect(
      deriveDistribucionMes([
        buildPaciente({ id: 'p-1', mesActual: 1, mesesTotales: 4 }),
        buildPaciente({ id: 'p-2', mesActual: 1, mesesTotales: 4 }),
        buildPaciente({ id: 'p-3', mesActual: 3, mesesTotales: 4 }),
      ]),
    ).toEqual([
      { label: '1', cantidad: 2, pct: 67 },
      { label: '2', cantidad: 0, pct: 0 },
      { label: '3', cantidad: 1, pct: 33 },
      { label: '4', cantidad: 0, pct: 0 },
    ])
  })

  it('maps null mesActual to "Sin etapa", keeps it last and out of the numeric series', () => {
    expect(
      deriveDistribucionMes([
        buildPaciente({ id: 'p-1', mesActual: null, mesesTotales: null }),
        buildPaciente({ id: 'p-2', mesActual: 2, mesesTotales: 4 }),
      ]),
    ).toEqual([
      { label: '1', cantidad: 0, pct: 0 },
      { label: '2', cantidad: 1, pct: 50 },
      { label: '3', cantidad: 0, pct: 0 },
      { label: '4', cantidad: 0, pct: 0 },
      { label: 'Sin etapa', cantidad: 1, pct: 50 },
    ])
  })

  it('returns only "Sin etapa" when nobody has a known mesesTotales', () => {
    expect(
      deriveDistribucionMes([
        buildPaciente({ id: 'p-1', mesActual: null, mesesTotales: null }),
        buildPaciente({ id: 'p-2', mesActual: null, mesesTotales: null }),
      ]),
    ).toEqual([{ label: 'Sin etapa', cantidad: 2, pct: 100 }])
  })
})
