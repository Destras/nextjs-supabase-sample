import type { Paciente } from '@/app/controllers/Paciente'
import { PACIENTE_STATE } from '@/app/controllers/Paciente'
import { deriveRequierenMirada } from './deriveRequierenMirada'

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

describe('deriveRequierenMirada', () => {
  it('returns an empty array for an empty caseload', () => {
    expect(deriveRequierenMirada([], new Set())).toEqual([])
  })

  it('returns an empty array when no paciente has an active alerta', () => {
    expect(
      deriveRequierenMirada(
        [
          buildPaciente({ id: 'p-1', ultimoScore: 2 }),
          buildPaciente({ id: 'p-2', ultimoScore: 4 }),
        ],
        new Set(),
      ),
    ).toEqual([])
  })

  it('filters to only pacientes present in alertaPacienteIds', () => {
    const ordered = deriveRequierenMirada(
      [
        buildPaciente({ id: 'p-1', ultimoScore: 4 }),
        buildPaciente({ id: 'p-2', ultimoScore: 2 }),
        buildPaciente({ id: 'p-3', ultimoScore: 1 }),
      ],
      new Set(['p-2', 'p-3']),
    )
    expect(ordered.map((p) => p.id)).toEqual(['p-3', 'p-2'])
  })

  it('sorts by lowest score first among pacientes with alerta, nulls last', () => {
    const ordered = deriveRequierenMirada(
      [
        buildPaciente({ id: 'p-1', ultimoScore: null }),
        buildPaciente({ id: 'p-2', ultimoScore: 3 }),
        buildPaciente({ id: 'p-3', ultimoScore: 1 }),
      ],
      new Set(['p-1', 'p-2', 'p-3']),
    )
    expect(ordered.map((p) => p.id)).toEqual(['p-3', 'p-2', 'p-1'])
  })

  it('caps the result at the top 6', () => {
    const pacientes = [
      buildPaciente({ id: 'p-7', ultimoScore: 7 }),
      buildPaciente({ id: 'p-6', ultimoScore: 6 }),
      buildPaciente({ id: 'p-5', ultimoScore: 5 }),
      buildPaciente({ id: 'p-4', ultimoScore: 4 }),
      buildPaciente({ id: 'p-3', ultimoScore: 3 }),
      buildPaciente({ id: 'p-2', ultimoScore: 2 }),
      buildPaciente({ id: 'p-1', ultimoScore: 1 }),
    ]
    const alertaIds = new Set(pacientes.map((p) => p.id))
    const ordered = deriveRequierenMirada(pacientes, alertaIds)
    expect(ordered.map((p) => p.id)).toEqual([
      'p-1',
      'p-2',
      'p-3',
      'p-4',
      'p-5',
      'p-6',
    ])
  })
})
