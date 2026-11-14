import type { Paciente } from '@/app/controllers/Paciente'
import { PACIENTE_STATE } from '@/app/controllers/Paciente'
import { hasEvaluaciones } from './hasEvaluaciones'

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

describe('hasEvaluaciones', () => {
  it('returns false for an empty caseload', () => {
    expect(hasEvaluaciones([])).toBe(false)
  })

  it('returns false when no paciente has a score (día-1)', () => {
    expect(
      hasEvaluaciones([
        buildPaciente({ id: 'p-1', ultimoScore: null }),
        buildPaciente({ id: 'p-2', ultimoScore: null }),
      ]),
    ).toBe(false)
  })

  it('returns true when at least one paciente has a score', () => {
    expect(
      hasEvaluaciones([
        buildPaciente({ id: 'p-1', ultimoScore: null }),
        buildPaciente({ id: 'p-2', ultimoScore: 4 }),
      ]),
    ).toBe(true)
  })
})
