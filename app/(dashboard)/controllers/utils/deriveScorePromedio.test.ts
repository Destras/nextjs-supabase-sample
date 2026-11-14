import type { Paciente } from '@/app/controllers/Paciente'
import { PACIENTE_STATE } from '@/app/controllers/Paciente'
import { deriveScorePromedio } from './deriveScorePromedio'

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

describe('deriveScorePromedio', () => {
  it('returns null for an empty caseload', () => {
    expect(deriveScorePromedio([])).toBeNull()
  })

  it('ignores pacientes sin score', () => {
    expect(
      deriveScorePromedio([buildPaciente({ id: 'p-1', ultimoScore: null })]),
    ).toBeNull()
  })

  it('averages the scores of pacientes con score', () => {
    expect(
      deriveScorePromedio([
        buildPaciente({ id: 'p-1', ultimoScore: 2 }),
        buildPaciente({ id: 'p-2', ultimoScore: 4 }),
        buildPaciente({ id: 'p-3', ultimoScore: 3 }),
      ]),
    ).toBe(3)
  })

  it('rounds the promedio to one decimal', () => {
    expect(
      deriveScorePromedio([
        buildPaciente({ id: 'p-1', ultimoScore: 3 }),
        buildPaciente({ id: 'p-2', ultimoScore: 4 }),
        buildPaciente({ id: 'p-3', ultimoScore: 4 }),
      ]),
    ).toBe(3.7)
  })
})
