import type { Paciente } from '@/app/controllers/Paciente'
import { PACIENTE_STATE } from '@/app/controllers/Paciente'
import { deriveHeroStats } from './deriveHeroStats'

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

const withFechaAlta = (id: string, fechaAlta: string | null): Paciente =>
  buildPaciente({
    id,
    generalInfo: {
      telefono: null,
      email: null,
      fechaNacimiento: null,
      edad: null,
      fechaAlta,
    },
  })

describe('deriveHeroStats', () => {
  let now: Date

  beforeEach(() => {
    now = new Date('2026-06-15T12:00:00Z')
  })

  it('returns zeros and a null scorePromedio for an empty caseload', () => {
    expect(deriveHeroStats([], now)).toEqual({
      activos: 0,
      nuevosEsteMes: 0,
      scorePromedio: null,
    })
  })

  it('reports scorePromedio as null when no paciente has a score (Tier B sin data)', () => {
    expect(
      deriveHeroStats(
        [buildPaciente({ id: 'p-1' }), buildPaciente({ id: 'p-2' })],
        now,
      ),
    ).toEqual({
      activos: 2,
      nuevosEsteMes: 0,
      scorePromedio: null,
    })
  })

  it('averages ultimoScore across the caseload once there are evaluaciones', () => {
    expect(
      deriveHeroStats(
        [
          buildPaciente({ id: 'p-1', ultimoScore: 2 }),
          buildPaciente({ id: 'p-2', ultimoScore: 3 }),
          buildPaciente({ id: 'p-3', ultimoScore: 5 }),
        ],
        now,
      ),
    ).toEqual({
      activos: 3,
      nuevosEsteMes: 0,
      scorePromedio: 3.3,
    })
  })

  it('counts only pacientes dados de alta en el mes actual', () => {
    expect(
      deriveHeroStats(
        [
          withFechaAlta('p-1', '2026-06-01'),
          withFechaAlta('p-2', '2026-05-31'),
          withFechaAlta('p-3', null),
        ],
        now,
      ),
    ).toEqual({
      activos: 3,
      nuevosEsteMes: 1,
      scorePromedio: null,
    })
  })

  it('uses the LOCAL calendar month, not UTC, near a month boundary', () => {
    // 31 de mayo 23:30 hora local (constructor por componentes = local). En
    // UTC-3 ese instante ya es 1 de junio en UTC, así que un cálculo por UTC
    // contaría el mes equivocado. Con mes local el alta del 31/05 cuenta como
    // "este mes". El constructor + getMonth son ambos local → determinista en
    // cualquier zona del runner.
    const localMay31Night = new Date(2026, 4, 31, 23, 30, 0)
    expect(
      deriveHeroStats([withFechaAlta('p-1', '2026-05-31')], localMay31Night)
        .nuevosEsteMes,
    ).toBe(1)
  })

  it('counts only ACTIVE pacientes as activos', () => {
    expect(
      deriveHeroStats(
        [
          buildPaciente({ id: 'p-1', state: PACIENTE_STATE.ACTIVE }),
          buildPaciente({ id: 'p-2', state: PACIENTE_STATE.PAUSED }),
          buildPaciente({ id: 'p-3', state: PACIENTE_STATE.BAJA }),
        ],
        now,
      ),
    ).toEqual({
      activos: 1,
      nuevosEsteMes: 0,
      scorePromedio: null,
    })
  })
})
