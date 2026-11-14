import { mapEtapasToHistoria } from './mapEtapasToHistoria'
import { EtapaStatus } from '../TratamientoTypes'

// ---------------------------------------------------------------------------
// Shared raw-row fixtures
// ---------------------------------------------------------------------------

const baseCausa = {
  id: 'causa-1',
  codigo: 'C01',
  nombre: 'Causa 1',
  definicion: 'def causa',
  emociones_esperadas: 'emocion1',
  activo: true,
}

const baseAlgoritmo = {
  id: 'algo-1',
  codigo: 'A01',
  nombre: 'Algo 1',
  definicion: 'def algo',
  comportamiento: 'beh',
  activo: true,
}

const baseDiagnostico = {
  causa: {
    id: 'causa-1',
    codigo: 'C01',
    nombre: 'Causa 1',
    definicion: 'def causa',
    emocionesEsperadas: ['emocion1'],
    activo: true,
    etapas: [],
  },
  algoritmo: {
    id: 'algo-1',
    codigo: 'A01',
    nombre: 'Algo 1',
    definicion: 'def algo',
    comportamiento: 'beh',
    comportamientoBadge: 'beh',
    activo: true,
    etapas: [],
  },
  bloqueos: [],
}

const makeEtapa = (overrides: Record<string, unknown> = {}) => ({
  id: 'etapa-1',
  fecha_inicio: '2025-01-01' as string | null,
  fecha_finalizacion: null as string | null,
  motivo_cierre: null as string | null,
  estados_etapa: { codigo: 'activa' },
  created_at: '2025-01-01T00:00:00Z',
  causas: baseCausa,
  algoritmos: baseAlgoritmo,
  etapa_bloqueos: [] as Array<{
    bloqueos: {
      id: string
      codigo: string
      nombre: string
      descripcion: string | null
      activo: boolean
    } | null
  }>,
  etapa_alfabetos: [] as Array<{
    numero: number
    alfabetos: { id: string; nombre: string; orden: number } | null
  }>,
  niveles: [] as Array<{
    id: string
    numero_nivel: number
    fecha_seguimiento_esperada: string | null
    nivel_evaluacion: {
      id: string
      score: number
      fecha_respuesta: string
    } | null
  }>,
  modalidades: null as {
    nombre: string
    cantidad_niveles: number
    duracion_meses_estimada: number | null
  } | null,
  mediciones_estructura: [] as Array<{
    id: string
    momento: string
    estructura_general: number
    registrada_en: string
    registrada_por: string | null
    profiles: { nombre: string } | null
    medicion_valores: Array<{ centro_id: string; valor: number }>
  }>,
  ...overrides,
})

const makeMedicionEstructura = (overrides: Record<string, unknown> = {}) => ({
  id: 'med-1',
  momento: 'apertura',
  estructura_general: 50,
  registrada_en: '2025-01-01T12:00:00Z',
  registrada_por: 'terapeuta-1',
  profiles: { nombre: 'Ana Pérez' } as { nombre: string } | null,
  medicion_valores: [{ centro_id: 'centro-1', valor: 70 }],
  ...overrides,
})

const makeAsignacion = (overrides: Record<string, unknown> = {}) => ({
  id: 'asig-1',
  terapeuta_id: 'terapeuta-1',
  fecha_desde: '2025-01-01',
  fecha_hasta: null as string | null,
  motivo: null as string | null,
  terapeutas: {
    id: 'terapeuta-1',
    profiles: { nombre: 'Dr. Juan' } as { nombre: string } | null,
  } as { id: string; profiles: { nombre: string } | null } | null,
  ...overrides,
})

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('mapEtapasToHistoria', () => {
  let etapa: ReturnType<typeof makeEtapa>
  let asignacion: ReturnType<typeof makeAsignacion>
  let today: Date

  beforeEach(() => {
    etapa = makeEtapa()
    asignacion = makeAsignacion()
    // Mediodía local del 1-jun: "hoy" se lee en el calendario local (BETA-017).
    today = new Date(2025, 5, 1, 12, 0, 0)
  })

  // ── alfabetos por etapa ───────────────────────────────────────────────────

  it('maps alfabetos of the etapa grouped by alfabeto, numbers ascending', () => {
    etapa.etapa_alfabetos = [
      { numero: 7, alfabetos: { id: 'a-2', nombre: 'Beta', orden: 2 } },
      { numero: 3, alfabetos: { id: 'a-1', nombre: 'Sigma', orden: 1 } },
      { numero: 1, alfabetos: { id: 'a-2', nombre: 'Beta', orden: 2 } },
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].alfabetos).toEqual([
      { alfabetoId: 'a-1', nombre: 'Sigma', numeros: [3] },
      { alfabetoId: 'a-2', nombre: 'Beta', numeros: [1, 7] },
    ])
  })

  it('returns empty alfabetos when the etapa has none or a null embed', () => {
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].alfabetos).toEqual([])
    etapa.etapa_alfabetos = [{ numero: 1, alfabetos: null }]
    expect(mapEtapasToHistoria([etapa], [], today)[0].alfabetos).toEqual([])
  })

  it('keeps each etapa with its own alfabetos', () => {
    const otra = makeEtapa({
      id: 'etapa-2',
      fecha_inicio: '2024-01-01',
      estados_etapa: { codigo: 'finalizada' },
      fecha_finalizacion: '2024-06-01',
      etapa_alfabetos: [
        { numero: 5, alfabetos: { id: 'a-1', nombre: 'Sigma', orden: 1 } },
      ],
    })
    etapa.etapa_alfabetos = [
      { numero: 9, alfabetos: { id: 'a-2', nombre: 'Beta', orden: 2 } },
    ]
    const result = mapEtapasToHistoria([etapa, otra], [], today)
    expect(result.find((e) => e.id === 'etapa-1')?.alfabetos).toEqual([
      { alfabetoId: 'a-2', nombre: 'Beta', numeros: [9] },
    ])
    expect(result.find((e) => e.id === 'etapa-2')?.alfabetos).toEqual([
      { alfabetoId: 'a-1', nombre: 'Sigma', numeros: [5] },
    ])
  })

  // ── Status mapping ────────────────────────────────────────────────────────

  it('maps estados_etapa.codigo "activa" to EtapaStatus.EN_CURSO', () => {
    etapa.estados_etapa = { codigo: 'activa' }
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].status).toEqual(EtapaStatus.EN_CURSO)
  })

  it('maps estados_etapa.codigo "finalizada" to EtapaStatus.FINALIZADA', () => {
    etapa.estados_etapa = { codigo: 'finalizada' }
    etapa.fecha_finalizacion = '2025-05-01'
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].status).toEqual(EtapaStatus.FINALIZADA)
  })

  it('maps estados_etapa.codigo "abandonada" to EtapaStatus.ABANDONADA', () => {
    etapa.estados_etapa = { codigo: 'abandonada' }
    etapa.fecha_finalizacion = '2025-04-01'
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].status).toEqual(EtapaStatus.ABANDONADA)
  })

  it('maps estados_etapa.codigo "pendiente" to EtapaStatus.PENDIENTE', () => {
    etapa.estados_etapa = { codigo: 'pendiente' }
    etapa.fecha_inicio = null
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].status).toEqual(EtapaStatus.PENDIENTE)
  })

  // ── duracionMeses ─────────────────────────────────────────────────────────

  it('computes duracionMeses using fechaFin when present', () => {
    // 2025-01-01 → 2025-04-01 = 90 days / 30.44 ≈ 2.96 → rounded to 3
    etapa.fecha_inicio = '2025-01-01'
    etapa.fecha_finalizacion = '2025-04-01'
    etapa.estados_etapa = { codigo: 'finalizada' }
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].duracionMeses).toEqual(3)
  })

  it('computes duracionMeses using today when fechaFin is null', () => {
    // 2025-01-01 → 2025-06-01 = 151 days / 30.44 ≈ 4.96 → rounded to 5
    etapa.fecha_inicio = '2025-01-01'
    etapa.fecha_finalizacion = null
    const injectedToday = new Date('2025-06-01')
    const result = mapEtapasToHistoria([etapa], [], injectedToday)
    expect(result[0].duracionMeses).toEqual(5)
  })

  it('returns duracionMeses null when the etapa never started and is still open (fecha_inicio null, fecha_finalizacion null)', () => {
    etapa.fecha_inicio = null
    etapa.fecha_finalizacion = null
    etapa.estados_etapa = { codigo: 'pendiente' }
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].duracionMeses).toEqual(null)
  })

  it('returns duracionMeses null when the etapa closed without ever having started (fecha_inicio null, fecha_finalizacion set)', () => {
    etapa.fecha_inicio = null
    etapa.fecha_finalizacion = '2025-03-01'
    etapa.estados_etapa = { codigo: 'abandonada' }
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].duracionMeses).toEqual(null)
  })

  // ── deltaScoreEtapa ───────────────────────────────────────────────────────

  it('returns deltaScoreEtapa with primero and ultimo when etapa has >= 2 evaluated niveles', () => {
    etapa.niveles = [
      {
        id: 'niv-1',
        numero_nivel: 1,
        fecha_seguimiento_esperada: '2025-02-01',
        nivel_evaluacion: {
          id: 'eval-1',
          score: 60,
          fecha_respuesta: '2025-02-01',
        },
      },
      {
        id: 'niv-2',
        numero_nivel: 2,
        fecha_seguimiento_esperada: '2025-03-01',
        nivel_evaluacion: {
          id: 'eval-2',
          score: 80,
          fecha_respuesta: '2025-03-01',
        },
      },
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].deltaScoreEtapa).toEqual({ primero: 60, ultimo: 80 })
  })

  it('returns deltaScoreEtapa null when etapa has exactly 1 evaluated nivel', () => {
    etapa.niveles = [
      {
        id: 'niv-1',
        numero_nivel: 1,
        fecha_seguimiento_esperada: '2025-02-01',
        nivel_evaluacion: {
          id: 'eval-1',
          score: 70,
          fecha_respuesta: '2025-02-01',
        },
      },
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].deltaScoreEtapa).toEqual(null)
  })

  it('returns deltaScoreEtapa null when etapa has 0 evaluated niveles', () => {
    etapa.niveles = [
      {
        id: 'niv-1',
        numero_nivel: 1,
        fecha_seguimiento_esperada: '2025-02-01',
        nivel_evaluacion: null,
      },
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].deltaScoreEtapa).toEqual(null)
  })

  it('orders deltaScoreEtapa by fecha_respuesta asc (not by nivel number)', () => {
    // nivel 2 was evaluated before nivel 1 — primero should be score from nivel 2
    etapa.niveles = [
      {
        id: 'niv-1',
        numero_nivel: 1,
        fecha_seguimiento_esperada: '2025-03-01',
        nivel_evaluacion: {
          id: 'eval-1',
          score: 90,
          fecha_respuesta: '2025-03-15',
        },
      },
      {
        id: 'niv-2',
        numero_nivel: 2,
        fecha_seguimiento_esperada: '2025-02-01',
        nivel_evaluacion: {
          id: 'eval-2',
          score: 50,
          fecha_respuesta: '2025-02-10',
        },
      },
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].deltaScoreEtapa).toEqual({ primero: 50, ultimo: 90 })
  })

  // ── responsables ──────────────────────────────────────────────────────────

  it('includes terapeuta whose assignment overlaps the etapa range', () => {
    // assignment [2025-01-01, ∞) overlaps etapa [2025-01-01, null (today 2025-06-01))
    const result = mapEtapasToHistoria([etapa], [asignacion], today)
    expect(result[0].responsables).toEqual([
      { terapeutaId: 'terapeuta-1', nombre: 'Dr. Juan' },
    ])
  })

  it('excludes terapeuta whose assignment ended before etapa started', () => {
    asignacion.fecha_desde = '2024-01-01'
    asignacion.fecha_hasta = '2024-12-31'
    // etapa starts 2025-01-01 → no overlap
    const result = mapEtapasToHistoria([etapa], [asignacion], today)
    expect(result[0].responsables).toEqual([])
  })

  it('excludes terapeuta whose assignment started after etapa ended', () => {
    etapa.fecha_finalizacion = '2025-03-01'
    etapa.estados_etapa = { codigo: 'finalizada' }
    asignacion.fecha_desde = '2025-04-01'
    asignacion.fecha_hasta = null
    const result = mapEtapasToHistoria([etapa], [asignacion], today)
    expect(result[0].responsables).toEqual([])
  })

  it('dedups responsables by terapeutaId when same terapeuta has multiple assignments', () => {
    const asig2 = makeAsignacion({
      id: 'asig-2',
      terapeuta_id: 'terapeuta-1',
      fecha_desde: '2025-03-01',
      fecha_hasta: null,
    })
    const result = mapEtapasToHistoria([etapa], [asignacion, asig2], today)
    expect(result[0].responsables).toEqual([
      { terapeutaId: 'terapeuta-1', nombre: 'Dr. Juan' },
    ])
  })

  it('includes both terapeutas in responsables during a handoff where both assignments overlap', () => {
    // terapeuta-1 covered first half, terapeuta-2 took over mid-etapa, both overlap
    const asig1 = makeAsignacion({
      id: 'asig-1',
      terapeuta_id: 'terapeuta-1',
      fecha_desde: '2025-01-01',
      fecha_hasta: '2025-03-01',
      terapeutas: { id: 'terapeuta-1', profiles: { nombre: 'Dr. Juan' } },
    })
    const asig2 = makeAsignacion({
      id: 'asig-2',
      terapeuta_id: 'terapeuta-2',
      fecha_desde: '2025-03-01',
      fecha_hasta: null,
      terapeutas: { id: 'terapeuta-2', profiles: { nombre: 'Dra. Ana' } },
    })
    const result = mapEtapasToHistoria([etapa], [asig1, asig2], today)
    expect(result[0].responsables).toEqual([
      { terapeutaId: 'terapeuta-1', nombre: 'Dr. Juan' },
      { terapeutaId: 'terapeuta-2', nombre: 'Dra. Ana' },
    ])
  })

  it('collapses responsables to empty when the terapeutas embed is null (RLS-hidden, therapist case)', () => {
    // PostgREST returns terapeutas:null when RLS hides the embed (DEC-E0-4).
    asignacion.terapeutas = null
    const result = mapEtapasToHistoria([etapa], [asignacion], today)
    expect(result[0].responsables).toEqual([])
  })

  it('anchors the responsables window on created_at when the etapa never started (fecha_inicio null)', () => {
    etapa.fecha_inicio = null
    etapa.created_at = '2025-01-01T00:00:00Z'
    asignacion.fecha_desde = '2025-01-01'
    asignacion.fecha_hasta = null
    const result = mapEtapasToHistoria([etapa], [asignacion], today)
    expect(result[0].responsables).toEqual([
      { terapeutaId: 'terapeuta-1', nombre: 'Dr. Juan' },
    ])
  })

  // ── eventos ───────────────────────────────────────────────────────────────

  it('produces a nivel event using fecha_respuesta when nivel is evaluated', () => {
    etapa.niveles = [
      {
        id: 'niv-1',
        numero_nivel: 1,
        fecha_seguimiento_esperada: '2025-02-01',
        nivel_evaluacion: {
          id: 'eval-1',
          score: 70,
          fecha_respuesta: '2025-02-05',
        },
      },
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].eventos).toEqual([
      {
        tipo: 'nivel',
        fecha: '2025-02-05',
        numeroNivel: 1,
        score: 70,
        deltaScore: null,
      },
    ])
  })

  it('produces a nivel event using fecha_seguimiento_esperada when nivel is not evaluated', () => {
    etapa.niveles = [
      {
        id: 'niv-1',
        numero_nivel: 1,
        fecha_seguimiento_esperada: '2025-02-01',
        nivel_evaluacion: null,
      },
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].eventos).toEqual([
      {
        tipo: 'nivel',
        fecha: '2025-02-01',
        numeroNivel: 1,
        score: null,
        deltaScore: null,
      },
    ])
  })

  it('computes deltaScore on a nivel event relative to the previous evaluated nivel', () => {
    etapa.niveles = [
      {
        id: 'niv-1',
        numero_nivel: 1,
        fecha_seguimiento_esperada: '2025-02-01',
        nivel_evaluacion: {
          id: 'eval-1',
          score: 60,
          fecha_respuesta: '2025-02-01',
        },
      },
      {
        id: 'niv-2',
        numero_nivel: 2,
        fecha_seguimiento_esperada: '2025-03-01',
        nivel_evaluacion: {
          id: 'eval-2',
          score: 80,
          fecha_respuesta: '2025-03-01',
        },
      },
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].eventos).toEqual([
      {
        tipo: 'nivel',
        fecha: '2025-02-01',
        numeroNivel: 1,
        score: 60,
        deltaScore: null,
      },
      {
        tipo: 'nivel',
        fecha: '2025-03-01',
        numeroNivel: 2,
        score: 80,
        deltaScore: 20,
      },
    ])
  })

  it('produces no nivel event for a nivel with no evaluation and no fecha_seguimiento_esperada (unstarted etapa)', () => {
    etapa.niveles = [
      {
        id: 'niv-1',
        numero_nivel: 1,
        fecha_seguimiento_esperada: null,
        nivel_evaluacion: null,
      },
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].eventos).toEqual([])
  })

  it('produces no cambio_terapeuta event when there is only 1 visible assignment (baseline rule)', () => {
    // 1 assignment = baseline, no change event generated
    const result = mapEtapasToHistoria([etapa], [asignacion], today)
    expect(result[0].eventos).toEqual([])
  })

  it('produces a cambio_terapeuta event for the second visible assignment whose fecha_desde falls in the etapa range', () => {
    etapa.fecha_inicio = '2025-01-01'
    const asig1 = makeAsignacion({
      id: 'asig-1',
      terapeuta_id: 'terapeuta-1',
      fecha_desde: '2025-01-01',
      fecha_hasta: '2025-03-01',
      motivo: null,
      terapeutas: { id: 'terapeuta-1', profiles: { nombre: 'Dr. Juan' } },
    })
    const asig2 = makeAsignacion({
      id: 'asig-2',
      terapeuta_id: 'terapeuta-2',
      fecha_desde: '2025-03-01',
      fecha_hasta: null,
      motivo: 'vacaciones',
      terapeutas: { id: 'terapeuta-2', profiles: { nombre: 'Dra. Ana' } },
    })
    const result = mapEtapasToHistoria([etapa], [asig1, asig2], today)
    expect(result[0].eventos).toEqual([
      {
        tipo: 'cambio_terapeuta',
        fecha: '2025-03-01',
        de: 'Dr. Juan',
        a: 'Dra. Ana',
        motivo: 'vacaciones',
      },
    ])
  })

  it('produces no cambio_terapeuta event when the terapeutas embeds are null (RLS-hidden, therapist case)', () => {
    etapa.fecha_inicio = '2025-01-01'
    const asig1 = makeAsignacion({
      id: 'asig-1',
      terapeuta_id: 'terapeuta-1',
      fecha_desde: '2025-01-01',
      fecha_hasta: '2025-03-01',
      terapeutas: null,
    })
    const asig2 = makeAsignacion({
      id: 'asig-2',
      terapeuta_id: 'terapeuta-2',
      fecha_desde: '2025-03-01',
      fecha_hasta: null,
      terapeutas: null,
    })
    const result = mapEtapasToHistoria([etapa], [asig1, asig2], today)
    expect(result[0].eventos).toEqual([])
  })

  it('sorts eventos by fecha asc mixing nivel and cambio_terapeuta events', () => {
    etapa.fecha_inicio = '2025-01-01'
    etapa.niveles = [
      {
        id: 'niv-1',
        numero_nivel: 1,
        fecha_seguimiento_esperada: '2025-02-01',
        nivel_evaluacion: {
          id: 'eval-1',
          score: 60,
          fecha_respuesta: '2025-02-01',
        },
      },
      {
        id: 'niv-2',
        numero_nivel: 2,
        fecha_seguimiento_esperada: '2025-04-01',
        nivel_evaluacion: {
          id: 'eval-2',
          score: 75,
          fecha_respuesta: '2025-04-01',
        },
      },
    ]
    const asig1 = makeAsignacion({
      id: 'asig-1',
      terapeuta_id: 'terapeuta-1',
      fecha_desde: '2025-01-01',
      fecha_hasta: '2025-03-01',
      motivo: null,
      terapeutas: { id: 'terapeuta-1', profiles: { nombre: 'Dr. Juan' } },
    })
    const asig2 = makeAsignacion({
      id: 'asig-2',
      terapeuta_id: 'terapeuta-2',
      fecha_desde: '2025-03-01',
      fecha_hasta: null,
      motivo: null,
      terapeutas: { id: 'terapeuta-2', profiles: { nombre: 'Dra. Ana' } },
    })
    const result = mapEtapasToHistoria([etapa], [asig1, asig2], today)
    expect(result[0].eventos).toEqual([
      {
        tipo: 'nivel',
        fecha: '2025-02-01',
        numeroNivel: 1,
        score: 60,
        deltaScore: null,
      },
      {
        tipo: 'cambio_terapeuta',
        fecha: '2025-03-01',
        de: 'Dr. Juan',
        a: 'Dra. Ana',
        motivo: null,
      },
      {
        tipo: 'nivel',
        fecha: '2025-04-01',
        numeroNivel: 2,
        score: 75,
        deltaScore: 15,
      },
    ])
  })

  it('does not produce cambio_terapeuta event when assignment fecha_desde is before etapa started', () => {
    // asig2.fecha_desde = '2024-12-01' — before etapa start '2025-01-01' → no event
    etapa.fecha_inicio = '2025-01-01'
    const asig1 = makeAsignacion({
      id: 'asig-1',
      terapeuta_id: 'terapeuta-1',
      fecha_desde: '2024-06-01',
      fecha_hasta: '2024-12-01',
      motivo: null,
      terapeutas: { id: 'terapeuta-1', profiles: { nombre: 'Dr. Juan' } },
    })
    const asig2 = makeAsignacion({
      id: 'asig-2',
      terapeuta_id: 'terapeuta-2',
      fecha_desde: '2024-12-01',
      fecha_hasta: null,
      motivo: null,
      terapeutas: { id: 'terapeuta-2', profiles: { nombre: 'Dra. Ana' } },
    })
    const result = mapEtapasToHistoria([etapa], [asig1, asig2], today)
    expect(result[0].eventos).toEqual([])
  })

  it('anchors the cambio_terapeuta window on created_at when the etapa never started (fecha_inicio null)', () => {
    etapa.fecha_inicio = null
    etapa.created_at = '2025-01-01T00:00:00Z'
    const asig1 = makeAsignacion({
      id: 'asig-1',
      terapeuta_id: 'terapeuta-1',
      fecha_desde: '2025-01-01',
      fecha_hasta: '2025-03-01',
      terapeutas: { id: 'terapeuta-1', profiles: { nombre: 'Dr. Juan' } },
    })
    const asig2 = makeAsignacion({
      id: 'asig-2',
      terapeuta_id: 'terapeuta-2',
      fecha_desde: '2025-03-01',
      fecha_hasta: null,
      motivo: 'reasignación',
      terapeutas: { id: 'terapeuta-2', profiles: { nombre: 'Dra. Ana' } },
    })
    const result = mapEtapasToHistoria([etapa], [asig1, asig2], today)
    expect(result[0].eventos).toEqual([
      {
        tipo: 'cambio_terapeuta',
        fecha: '2025-03-01',
        de: 'Dr. Juan',
        a: 'Dra. Ana',
        motivo: 'reasignación',
      },
    ])
  })

  // ── proximaEvaluacion ─────────────────────────────────────────────────────

  it('returns proximaEvaluacion as the earliest future unevaluated nivel for EN_CURSO etapa', () => {
    etapa.estados_etapa = { codigo: 'activa' }
    etapa.fecha_finalizacion = null
    etapa.niveles = [
      {
        id: 'niv-1',
        numero_nivel: 1,
        fecha_seguimiento_esperada: '2025-02-01',
        nivel_evaluacion: {
          id: 'eval-1',
          score: 60,
          fecha_respuesta: '2025-02-01',
        },
      },
      {
        id: 'niv-2',
        numero_nivel: 2,
        fecha_seguimiento_esperada: '2025-07-01',
        nivel_evaluacion: null,
      },
      {
        id: 'niv-3',
        numero_nivel: 3,
        fecha_seguimiento_esperada: '2025-08-01',
        nivel_evaluacion: null,
      },
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].proximaEvaluacion).toEqual('2025-07-01')
  })

  it('BETA-017: a las 22:00 locales la evaluación de mañana sigue siendo la próxima ("hoy" es el día local, no el UTC)', () => {
    // 30-jun 22:00 en Buenos Aires = 1-jul 01:00 UTC.
    etapa.niveles = [
      {
        id: 'niv-1',
        numero_nivel: 1,
        fecha_seguimiento_esperada: '2025-07-01',
        nivel_evaluacion: null,
      },
    ]
    const result = mapEtapasToHistoria(
      [etapa],
      [],
      new Date(2025, 5, 30, 22, 0, 0),
    )
    expect(result[0].proximaEvaluacion).toEqual('2025-07-01')
  })

  it('returns proximaEvaluacion null for EN_CURSO etapa when all niveles are evaluated', () => {
    etapa.estados_etapa = { codigo: 'activa' }
    etapa.niveles = [
      {
        id: 'niv-1',
        numero_nivel: 1,
        fecha_seguimiento_esperada: '2025-02-01',
        nivel_evaluacion: {
          id: 'eval-1',
          score: 60,
          fecha_respuesta: '2025-02-01',
        },
      },
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].proximaEvaluacion).toEqual(null)
  })

  it('excludes a nivel with null fecha_seguimiento_esperada from proximaEvaluacion candidates', () => {
    etapa.estados_etapa = { codigo: 'activa' }
    etapa.niveles = [
      {
        id: 'niv-1',
        numero_nivel: 1,
        fecha_seguimiento_esperada: null,
        nivel_evaluacion: null,
      },
      {
        id: 'niv-2',
        numero_nivel: 2,
        fecha_seguimiento_esperada: '2025-07-01',
        nivel_evaluacion: null,
      },
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].proximaEvaluacion).toEqual('2025-07-01')
  })

  it('returns proximaEvaluacion null for FINALIZADA etapa even when unevaluated niveles exist', () => {
    etapa.estados_etapa = { codigo: 'finalizada' }
    etapa.fecha_finalizacion = '2025-04-01'
    etapa.niveles = [
      {
        id: 'niv-1',
        numero_nivel: 1,
        fecha_seguimiento_esperada: '2025-05-01',
        nivel_evaluacion: null,
      },
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].proximaEvaluacion).toEqual(null)
  })

  // ── motivoCierre ──────────────────────────────────────────────────────────

  it('returns motivoCierre null when etapa has no motivo_cierre', () => {
    etapa.motivo_cierre = null
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].motivoCierre).toEqual(null)
  })

  it('returns motivoCierre with the value when etapa has motivo_cierre set', () => {
    etapa.motivo_cierre = 'Alta terapéutica'
    etapa.estados_etapa = { codigo: 'finalizada' }
    etapa.fecha_finalizacion = '2025-05-01'
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].motivoCierre).toEqual('Alta terapéutica')
  })

  // ── output ordering ───────────────────────────────────────────────────────

  it('places the EN_CURSO etapa first regardless of fecha_inicio order', () => {
    const etapaActiva = makeEtapa({
      id: 'etapa-activa',
      fecha_inicio: '2024-01-01',
      estados_etapa: { codigo: 'activa' },
      fecha_finalizacion: null,
    })
    const etapaFinalizada = makeEtapa({
      id: 'etapa-finalizada',
      fecha_inicio: '2023-01-01',
      estados_etapa: { codigo: 'finalizada' },
      fecha_finalizacion: '2023-12-31',
    })
    const result = mapEtapasToHistoria(
      [etapaFinalizada, etapaActiva],
      [],
      today,
    )
    expect(result.map((e) => e.id)).toEqual([
      'etapa-activa',
      'etapa-finalizada',
    ])
  })

  it('orders non-EN_CURSO etapas by fechaInicio descending', () => {
    const etapa2023 = makeEtapa({
      id: 'etapa-2023',
      fecha_inicio: '2023-01-01',
      estados_etapa: { codigo: 'finalizada' },
      fecha_finalizacion: '2023-12-31',
    })
    const etapa2022 = makeEtapa({
      id: 'etapa-2022',
      fecha_inicio: '2022-01-01',
      estados_etapa: { codigo: 'abandonada' },
      fecha_finalizacion: '2022-06-01',
    })
    const etapa2024 = makeEtapa({
      id: 'etapa-2024',
      fecha_inicio: '2024-01-01',
      estados_etapa: { codigo: 'finalizada' },
      fecha_finalizacion: '2024-12-31',
    })
    const result = mapEtapasToHistoria(
      [etapa2022, etapa2023, etapa2024],
      [],
      today,
    )
    expect(result.map((e) => e.id)).toEqual([
      'etapa-2024',
      'etapa-2023',
      'etapa-2022',
    ])
  })

  it('sorts a closed-without-having-started etapa (fecha_inicio null) by created_at, keeping its chronological place', () => {
    const etapaSinArrancar = makeEtapa({
      id: 'etapa-sin-arrancar',
      fecha_inicio: null,
      fecha_finalizacion: '2023-06-01',
      estados_etapa: { codigo: 'abandonada' },
      created_at: '2023-01-01T00:00:00Z',
    })
    const etapa2023 = makeEtapa({
      id: 'etapa-2023',
      fecha_inicio: '2023-06-15',
      estados_etapa: { codigo: 'finalizada' },
      fecha_finalizacion: '2023-12-31',
    })
    const etapa2024 = makeEtapa({
      id: 'etapa-2024',
      fecha_inicio: '2024-01-01',
      estados_etapa: { codigo: 'finalizada' },
      fecha_finalizacion: '2024-12-31',
    })
    const result = mapEtapasToHistoria(
      [etapaSinArrancar, etapa2023, etapa2024],
      [],
      today,
    )
    expect(result.map((e) => e.id)).toEqual([
      'etapa-2024',
      'etapa-2023',
      'etapa-sin-arrancar',
    ])
  })

  // ── full EtapaHistoria shape (tracer bullet) ──────────────────────────────

  it('returns a complete EtapaHistoria object for a minimal EN_CURSO etapa', () => {
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0]).toEqual({
      id: 'etapa-1',
      status: EtapaStatus.EN_CURSO,
      fechaInicio: '2025-01-01',
      fechaFin: null,
      diagnostico: baseDiagnostico,
      modalidad: null,
      responsables: [],
      eventos: [],
      duracionMeses: 5,
      deltaScoreEtapa: null,
      motivoCierre: null,
      proximaEvaluacion: null,
      mediciones: [],
      alfabetos: [],
    })
  })

  it('returns a complete EtapaHistoria object for a FINALIZADA etapa with modalidad', () => {
    const etapaFinalizada = makeEtapa({
      id: 'etapa-fin',
      fecha_inicio: '2025-01-01',
      fecha_finalizacion: '2025-04-01',
      estados_etapa: { codigo: 'finalizada' },
      motivo_cierre: 'Alta',
      modalidades: {
        nombre: 'Programa A',
        cantidad_niveles: 8,
        duracion_meses_estimada: 6,
      },
    })
    const result = mapEtapasToHistoria([etapaFinalizada], [], today)
    expect(result[0]).toEqual({
      id: 'etapa-fin',
      status: EtapaStatus.FINALIZADA,
      fechaInicio: '2025-01-01',
      fechaFin: '2025-04-01',
      diagnostico: baseDiagnostico,
      modalidad: {
        nombre: 'Programa A',
        cantidadNiveles: 8,
        duracionMesesEstimada: 6,
      },
      responsables: [],
      eventos: [],
      duracionMeses: 3,
      deltaScoreEtapa: null,
      motivoCierre: 'Alta',
      proximaEvaluacion: null,
      mediciones: [],
      alfabetos: [],
    })
  })

  it('returns a complete EtapaHistoria object for an etapa abierta sin arrancar (pendiente)', () => {
    const etapaPendiente = makeEtapa({
      id: 'etapa-pendiente',
      fecha_inicio: null,
      fecha_finalizacion: null,
      estados_etapa: { codigo: 'pendiente' },
      created_at: '2025-05-01T00:00:00Z',
    })
    const result = mapEtapasToHistoria([etapaPendiente], [], today)
    expect(result[0]).toEqual({
      id: 'etapa-pendiente',
      status: EtapaStatus.PENDIENTE,
      fechaInicio: null,
      fechaFin: null,
      diagnostico: baseDiagnostico,
      modalidad: null,
      responsables: [],
      eventos: [],
      duracionMeses: null,
      deltaScoreEtapa: null,
      motivoCierre: null,
      proximaEvaluacion: null,
      mediciones: [],
      alfabetos: [],
    })
  })

  it('returns a complete EtapaHistoria object for an etapa cerrada sin haber arrancado nunca (abandonada)', () => {
    const etapaAbandonadaSinArrancar = makeEtapa({
      id: 'etapa-abandonada-sin-arrancar',
      fecha_inicio: null,
      fecha_finalizacion: '2025-05-10',
      estados_etapa: { codigo: 'abandonada' },
      motivo_cierre: 'El paciente no continuó',
      created_at: '2025-05-01T00:00:00Z',
    })
    const result = mapEtapasToHistoria([etapaAbandonadaSinArrancar], [], today)
    expect(result[0]).toEqual({
      id: 'etapa-abandonada-sin-arrancar',
      status: EtapaStatus.ABANDONADA,
      fechaInicio: null,
      fechaFin: '2025-05-10',
      diagnostico: baseDiagnostico,
      modalidad: null,
      responsables: [],
      eventos: [],
      duracionMeses: null,
      deltaScoreEtapa: null,
      motivoCierre: 'El paciente no continuó',
      proximaEvaluacion: null,
      mediciones: [],
      alfabetos: [],
    })
  })

  // ── mediciones de estructura (medir-chakras/PR2) ──────────────────────────

  it('maps a single medicion into EtapaHistoria.mediciones', () => {
    etapa.mediciones_estructura = [makeMedicionEstructura()]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].mediciones).toEqual([
      {
        id: 'med-1',
        momento: 'apertura',
        estructuraGeneral: 50,
        deltaEstructura: null,
        registradaEn: '2025-01-01',
        autorNombre: 'Ana Pérez',
        valores: [{ centroId: 'centro-1', valor: 70 }],
      },
    ])
  })

  it('maps autorNombre to null when registrada_por is null (cierre_automatico)', () => {
    etapa.mediciones_estructura = [
      makeMedicionEstructura({
        momento: 'cierre_automatico',
        registrada_por: null,
        profiles: null,
      }),
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].mediciones[0].autorNombre).toEqual(null)
  })

  it('computes deltaEstructura for a seguimiento against the previous medicion', () => {
    etapa.mediciones_estructura = [
      makeMedicionEstructura({
        id: 'med-1',
        momento: 'apertura',
        estructura_general: 50,
        registrada_en: '2025-01-01T00:00:00Z',
      }),
      makeMedicionEstructura({
        id: 'med-2',
        momento: 'seguimiento',
        estructura_general: 65,
        registrada_en: '2025-02-01T00:00:00Z',
      }),
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].mediciones[1].deltaEstructura).toEqual(15)
  })

  it('suppresses deltaEstructura for cierre_automatico even with a previous medicion', () => {
    etapa.mediciones_estructura = [
      makeMedicionEstructura({
        id: 'med-1',
        momento: 'apertura',
        estructura_general: 50,
        registrada_en: '2025-01-01T00:00:00Z',
      }),
      makeMedicionEstructura({
        id: 'med-2',
        momento: 'cierre_automatico',
        estructura_general: 50,
        registrada_en: '2025-03-01T00:00:00Z',
        registrada_por: null,
        profiles: null,
      }),
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].mediciones[1].deltaEstructura).toEqual(null)
  })

  it('sorts mediciones ascending by registrada_en regardless of input order', () => {
    etapa.mediciones_estructura = [
      makeMedicionEstructura({
        id: 'med-2',
        momento: 'seguimiento',
        registrada_en: '2025-02-01T00:00:00Z',
      }),
      makeMedicionEstructura({
        id: 'med-1',
        momento: 'apertura',
        registrada_en: '2025-01-01T00:00:00Z',
      }),
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].mediciones.map((m) => m.id)).toEqual(['med-1', 'med-2'])
  })

  it('emits a medicion EventoEvolucion for each medicion', () => {
    etapa.mediciones_estructura = [makeMedicionEstructura()]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].eventos).toEqual([
      {
        tipo: 'medicion',
        fecha: '2025-01-01',
        medicionId: 'med-1',
        momento: 'apertura',
        estructuraGeneral: 50,
        deltaEstructura: null,
      },
    ])
  })

  it('interleaves medicion events with nivel events by fecha asc', () => {
    etapa.mediciones_estructura = [
      makeMedicionEstructura({
        id: 'med-1',
        registrada_en: '2025-03-01T00:00:00Z',
      }),
    ]
    etapa.niveles = [
      {
        id: 'niv-1',
        numero_nivel: 1,
        fecha_seguimiento_esperada: '2025-02-01',
        nivel_evaluacion: {
          id: 'ev-1',
          score: 4,
          fecha_respuesta: '2025-02-01',
        },
      },
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].eventos.map((e) => e.tipo)).toEqual(['nivel', 'medicion'])
  })

  // MED-004 — the Historia renders medición dates as YYYY-MM-DD, like the
  // date-only fecha of nivel events, never the raw timestamptz.
  it('normalises a timestamptz registrada_en to YYYY-MM-DD in the event fecha and the matrix header', () => {
    etapa.mediciones_estructura = [
      makeMedicionEstructura({
        registrada_en: '2026-09-21T17:40:35.740526+00:00',
      }),
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].mediciones[0].registradaEn).toEqual('2026-09-21')
    expect(result[0].eventos[0].fecha).toEqual('2026-09-21')
  })

  // BETA-040 — el día de una medición es el de Argentina, no el de UTC.
  it('collapses a registrada_en at 02:30 UTC to the previous day (Argentina)', () => {
    etapa.mediciones_estructura = [
      makeMedicionEstructura({ registrada_en: '2026-06-10T02:30:00Z' }),
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].mediciones[0].registradaEn).toEqual('2026-06-09')
  })

  it('orders same-day events by the full registrada_en timestamp, not the normalised date', () => {
    etapa.mediciones_estructura = [
      makeMedicionEstructura({
        id: 'med-tarde',
        momento: 'seguimiento',
        registrada_en: '2025-02-01T17:00:00+00:00',
      }),
      makeMedicionEstructura({
        id: 'med-manana',
        momento: 'apertura',
        registrada_en: '2025-02-01T08:00:00+00:00',
      }),
    ]
    etapa.niveles = [
      {
        id: 'niv-1',
        numero_nivel: 1,
        fecha_seguimiento_esperada: '2025-02-01',
        nivel_evaluacion: {
          id: 'ev-1',
          score: 4,
          fecha_respuesta: '2025-02-01T09:30:00+00:00',
        },
      },
    ]
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(
      result[0].eventos.map((e) =>
        e.tipo === 'medicion' ? e.medicionId : e.tipo,
      ),
    ).toEqual(['med-manana', 'nivel', 'med-tarde'])
    expect(result[0].mediciones.map((m) => m.id)).toEqual([
      'med-manana',
      'med-tarde',
    ])
  })

  it('returns empty mediciones and no medicion events when mediciones_estructura is empty', () => {
    const result = mapEtapasToHistoria([etapa], [], today)
    expect(result[0].mediciones).toEqual([])
  })
})
