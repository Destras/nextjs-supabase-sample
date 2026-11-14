import type { PacienteEditRaw } from './mapAsignacionToPacienteEditData'
import { mapAsignacionToPacienteEditData } from './mapAsignacionToPacienteEditData'
import type { PacienteEditData } from '../PacienteTypes'

type EtapaRaw = NonNullable<
  PacienteEditRaw['pacientes']
>['etapas_tratamiento'][number]

const buildEtapa = (overrides: Partial<EtapaRaw> = {}): EtapaRaw => ({
  id: 'etapa-activa',
  causa_id: 'causa-1',
  algoritmo_id: 'algo-1',
  modalidad_id: 'modalidad-1',
  fecha_inicio: '2026-01-01',
  created_at: '2026-01-01T00:00:00Z',
  fecha_finalizacion: null,
  etapa_bloqueos: [{ bloqueo_id: 'b-1' }, { bloqueo_id: 'b-2' }],
  etapa_alfabetos: [{ alfabeto_id: 'a-1', numero: 2, alfabetos: { orden: 1 } }],
  niveles: [{ fecha_seguimiento_real: null, nivel_evaluacion: null }],
  entregas_plan: [],
  ...overrides,
})

const buildRaw = (
  etapas: ReadonlyArray<EtapaRaw> = [buildEtapa()],
  userId: string | null = null,
): PacienteEditRaw => ({
  pacientes: {
    nombre: 'Juan',
    telefono: '111',
    email: 'j@example.com',
    fecha_nacimiento: '1990-05-01',
    user_id: userId,
    etapas_tratamiento: etapas,
  },
})

const baseIdentidad = {
  nombre: 'Juan',
  fechaNacimiento: '1990-05-01',
  email: 'j@example.com',
  telefono: '111',
}

describe('mapAsignacionToPacienteEditData', () => {
  it('returns empty editable data when pacientes is null', () => {
    const raw: PacienteEditRaw = { pacientes: null }
    const expected: PacienteEditData = {
      identidad: {
        nombre: '',
        fechaNacimiento: null,
        email: null,
        telefono: null,
      },
      diagnostico: {
        causaId: null,
        algoritmoId: null,
        modalidadId: null,
        bloqueoIds: [],
        alfabetos: [],
      },
      etapaId: null,
      etapaFresca: false,
      tieneCuenta: false,
    }
    expect(mapAsignacionToPacienteEditData(raw)).toEqual(expected)
  })

  it('marks tieneCuenta true once the paciente activated the account (user_id linked)', () => {
    const raw = buildRaw([buildEtapa()], 'user-1')
    const expected: PacienteEditData = {
      identidad: baseIdentidad,
      diagnostico: {
        causaId: 'causa-1',
        algoritmoId: 'algo-1',
        modalidadId: 'modalidad-1',
        bloqueoIds: ['b-1', 'b-2'],
        alfabetos: [{ alfabetoId: 'a-1', numeros: [2] }],
      },
      etapaId: 'etapa-activa',
      etapaFresca: true,
      tieneCuenta: true,
    }
    expect(mapAsignacionToPacienteEditData(raw)).toEqual(expected)
  })

  it('populates identidad but leaves diagnostico empty when there is no active etapa', () => {
    const raw = buildRaw([buildEtapa({ fecha_finalizacion: '2025-12-01' })])
    const expected: PacienteEditData = {
      identidad: baseIdentidad,
      diagnostico: {
        causaId: null,
        algoritmoId: null,
        modalidadId: null,
        bloqueoIds: [],
        alfabetos: [],
      },
      etapaId: null,
      etapaFresca: false,
      tieneCuenta: false,
    }
    expect(mapAsignacionToPacienteEditData(raw)).toEqual(expected)
  })

  it('maps a fresh active etapa with diagnostico ids and etapaFresca true', () => {
    const raw = buildRaw([buildEtapa()])
    const expected: PacienteEditData = {
      identidad: baseIdentidad,
      diagnostico: {
        causaId: 'causa-1',
        algoritmoId: 'algo-1',
        modalidadId: 'modalidad-1',
        bloqueoIds: ['b-1', 'b-2'],
        alfabetos: [{ alfabetoId: 'a-1', numeros: [2] }],
      },
      etapaId: 'etapa-activa',
      etapaFresca: true,
      tieneCuenta: false,
    }
    expect(mapAsignacionToPacienteEditData(raw)).toEqual(expected)
  })

  it('marks etapaFresca false when a nivel has been cursado (fecha_seguimiento_real set)', () => {
    const raw = buildRaw([
      buildEtapa({
        niveles: [
          { fecha_seguimiento_real: '2026-01-15', nivel_evaluacion: null },
        ],
      }),
    ])
    const expected: PacienteEditData = {
      identidad: baseIdentidad,
      diagnostico: {
        causaId: 'causa-1',
        algoritmoId: 'algo-1',
        modalidadId: 'modalidad-1',
        bloqueoIds: ['b-1', 'b-2'],
        alfabetos: [{ alfabetoId: 'a-1', numeros: [2] }],
      },
      etapaId: 'etapa-activa',
      etapaFresca: false,
      tieneCuenta: false,
    }
    expect(mapAsignacionToPacienteEditData(raw)).toEqual(expected)
  })

  it('marks etapaFresca false when content has already been delivered', () => {
    const raw = buildRaw([
      buildEtapa({
        entregas_plan: [
          { fecha_entregada: '2026-02-01' },
          { fecha_entregada: null },
        ],
      }),
    ])
    const expected: PacienteEditData = {
      identidad: baseIdentidad,
      diagnostico: {
        causaId: 'causa-1',
        algoritmoId: 'algo-1',
        modalidadId: 'modalidad-1',
        bloqueoIds: ['b-1', 'b-2'],
        alfabetos: [{ alfabetoId: 'a-1', numeros: [2] }],
      },
      etapaId: 'etapa-activa',
      etapaFresca: false,
      tieneCuenta: false,
    }
    expect(mapAsignacionToPacienteEditData(raw)).toEqual(expected)
  })

  it('stays fresca when entregas_plan exist but none has been delivered', () => {
    const raw = buildRaw([
      buildEtapa({ entregas_plan: [{ fecha_entregada: null }] }),
    ])
    const expected: PacienteEditData = {
      identidad: baseIdentidad,
      diagnostico: {
        causaId: 'causa-1',
        algoritmoId: 'algo-1',
        modalidadId: 'modalidad-1',
        bloqueoIds: ['b-1', 'b-2'],
        alfabetos: [{ alfabetoId: 'a-1', numeros: [2] }],
      },
      etapaId: 'etapa-activa',
      etapaFresca: true,
      tieneCuenta: false,
    }
    expect(mapAsignacionToPacienteEditData(raw)).toEqual(expected)
  })

  it('marks etapaFresca false when a nivel already has an evaluacion', () => {
    const raw = buildRaw([
      buildEtapa({
        niveles: [
          { fecha_seguimiento_real: null, nivel_evaluacion: { id: 'eval-1' } },
        ],
      }),
    ])
    const expected: PacienteEditData = {
      identidad: baseIdentidad,
      diagnostico: {
        causaId: 'causa-1',
        algoritmoId: 'algo-1',
        modalidadId: 'modalidad-1',
        bloqueoIds: ['b-1', 'b-2'],
        alfabetos: [{ alfabetoId: 'a-1', numeros: [2] }],
      },
      etapaId: 'etapa-activa',
      etapaFresca: false,
      tieneCuenta: false,
    }
    expect(mapAsignacionToPacienteEditData(raw)).toEqual(expected)
  })

  it('picks the latest active etapa (fecha_inicio desc, created_at desc) when more than one is unfinished — matching the RPC', () => {
    // Data anomaly: two unfinished etapas. The mapper must align with
    // update_etapa_diagnostico, which orders by fecha_inicio desc, created_at
    // desc and edits that one — otherwise the UI hydrates one etapa but the
    // save hits another.
    const older = buildEtapa({
      id: 'etapa-older',
      causa_id: 'causa-older',
      fecha_inicio: '2026-01-01',
      created_at: '2026-01-01T00:00:00Z',
    })
    const newer = buildEtapa({
      id: 'etapa-newer',
      causa_id: 'causa-newer',
      fecha_inicio: '2026-03-01',
      created_at: '2026-03-01T00:00:00Z',
    })
    // Provided out of order to prove it sorts rather than taking the first.
    const result = mapAsignacionToPacienteEditData(buildRaw([older, newer]))
    expect(result.etapaId).toBe('etapa-newer')
    expect(result.diagnostico.causaId).toBe('causa-newer')
  })

  it('coalesces a null fecha_inicio to created_at for the tie-break (mirrors mapAsignacionToPaciente), instead of sorting it last', () => {
    // Data anomaly: two unfinished etapas, one of which never started
    // (fecha_inicio null — DEC-11 escape hatch). The coalesce criterion says
    // the unstarted-but-more-recently-created etapa wins; a naive
    // "nulls sort last" comparator would wrongly pick the older, started one.
    const olderStarted = buildEtapa({
      id: 'etapa-older-started',
      causa_id: 'causa-older',
      fecha_inicio: '2026-01-01',
      created_at: '2026-01-01T00:00:00Z',
    })
    const newerUnstarted = buildEtapa({
      id: 'etapa-newer-unstarted',
      causa_id: 'causa-newer',
      fecha_inicio: null,
      created_at: '2026-03-01T00:00:00Z',
    })
    const result = mapAsignacionToPacienteEditData(
      buildRaw([olderStarted, newerUnstarted]),
    )
    expect(result.etapaId).toBe('etapa-newer-unstarted')
    expect(result.diagnostico.causaId).toBe('causa-newer')
  })

  it('breaks an equal-fecha_inicio tie by created_at desc', () => {
    const earlier = buildEtapa({
      id: 'etapa-earlier',
      causa_id: 'causa-earlier',
      fecha_inicio: '2026-02-01',
      created_at: '2026-02-01T08:00:00Z',
    })
    const later = buildEtapa({
      id: 'etapa-later',
      causa_id: 'causa-later',
      fecha_inicio: '2026-02-01',
      created_at: '2026-02-01T20:00:00Z',
    })
    const result = mapAsignacionToPacienteEditData(buildRaw([earlier, later]))
    expect(result.etapaId).toBe('etapa-later')
    expect(result.diagnostico.causaId).toBe('causa-later')
  })

  it('selects the active etapa and ignores finalized ones', () => {
    const finalizada = buildEtapa({
      id: 'etapa-vieja',
      causa_id: 'causa-vieja',
      algoritmo_id: 'algo-viejo',
      modalidad_id: 'modalidad-vieja',
      fecha_finalizacion: '2025-01-01',
      etapa_bloqueos: [{ bloqueo_id: 'b-old' }],
      etapa_alfabetos: [],
      niveles: [
        { fecha_seguimiento_real: '2025-02-01', nivel_evaluacion: null },
      ],
    })
    const raw = buildRaw([finalizada, buildEtapa()])
    const expected: PacienteEditData = {
      identidad: baseIdentidad,
      diagnostico: {
        causaId: 'causa-1',
        algoritmoId: 'algo-1',
        modalidadId: 'modalidad-1',
        bloqueoIds: ['b-1', 'b-2'],
        alfabetos: [{ alfabetoId: 'a-1', numeros: [2] }],
      },
      etapaId: 'etapa-activa',
      etapaFresca: true,
      tieneCuenta: false,
    }
    expect(mapAsignacionToPacienteEditData(raw)).toEqual(expected)
  })
  it('orders the alfabetos by catalog orden, not by the order the rows arrive', () => {
    const raw = buildRaw([
      buildEtapa({
        etapa_alfabetos: [
          { alfabeto_id: 'exorcistico', numero: 21, alfabetos: { orden: 3 } },
          { alfabeto_id: 'exorcistico', numero: 15, alfabetos: { orden: 3 } },
          { alfabeto_id: 'telurico', numero: 17, alfabetos: { orden: 2 } },
        ],
      }),
    ])
    expect(mapAsignacionToPacienteEditData(raw).diagnostico.alfabetos).toEqual([
      { alfabetoId: 'telurico', numeros: [17] },
      { alfabetoId: 'exorcistico', numeros: [15, 21] },
    ])
  })

  it('places alfabetos without a catalog orden after the ordered ones', () => {
    const raw = buildRaw([
      buildEtapa({
        etapa_alfabetos: [
          { alfabeto_id: 'sin-orden', numero: 4, alfabetos: null },
          { alfabeto_id: 'telurico', numero: 17, alfabetos: { orden: 2 } },
        ],
      }),
    ])
    expect(mapAsignacionToPacienteEditData(raw).diagnostico.alfabetos).toEqual([
      { alfabetoId: 'telurico', numeros: [17] },
      { alfabetoId: 'sin-orden', numeros: [4] },
    ])
  })
})
