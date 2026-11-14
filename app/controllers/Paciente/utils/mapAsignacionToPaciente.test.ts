import type { AsignacionRaw } from './mapAsignacionToPaciente'
import { mapAsignacionToPaciente } from './mapAsignacionToPaciente'
import { PACIENTE_STATE } from '../PacienteTypes'
import type { Paciente } from '../PacienteTypes'

// Mediodía UTC para que el día calendario coincida en UTC y en local (UTC-3):
// mesActual/edad ahora leen el calendario LOCAL (fix bug_004), y a medianoche UTC
// '...T00:00:00Z' caía en el día anterior local, corriendo los fixtures.
const today = new Date('2026-06-01T12:00:00Z')

const buildRaw = (
  overrides: Partial<NonNullable<AsignacionRaw['pacientes']>> = {},
): AsignacionRaw => ({
  id: 'asig-1',
  pacientes: {
    id: 'p-1',
    nombre: 'Juan',
    telefono: null,
    email: null,
    fecha_nacimiento: null,
    fecha_alta: null,
    user_id: null,
    bienvenida_entregada_at: null,
    etapas_tratamiento: [],
    ...overrides,
  },
})

type EtapaRawFixture = NonNullable<
  AsignacionRaw['pacientes']
>['etapas_tratamiento'][number]

const buildEtapa = (
  overrides: Partial<EtapaRawFixture> = {},
): EtapaRawFixture => ({
  id: 'e-1',
  fecha_inicio: '2026-05-01',
  created_at: '2026-05-01T00:00:00+00:00',
  fecha_finalizacion: null,
  causas: null,
  modalidades: null,
  etapa_bloqueos: [],
  algoritmos: null,
  etapa_alfabetos: [],
  niveles: [],
  ...overrides,
})

const emptyGeneralInfo = {
  telefono: null,
  email: null,
  fechaNacimiento: null,
  edad: null,
  fechaAlta: null,
}

const baseExpected: Paciente = {
  id: 'p-1',
  nombre: 'Juan',
  // DEC-05 (refinado, code review): sin NINGUNA etapa (nunca arrancó) →
  // nivelFinalizado = false. "Finalizado" solo aplica a un ciclo realmente cerrado.
  nivelFinalizado: false,
  mesActual: null,
  etapaOrdinal: null,
  evaluaciones: [],
  semanaGlobal: null,
  semanasTotales: null,
  mesesTotales: null,
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
  generalInfo: emptyGeneralInfo,
  state: PACIENTE_STATE.ACTIVE,
}

describe('mapAsignacionToPaciente', () => {
  it('falls back to the asignacion id when pacientes is null', () => {
    const raw: AsignacionRaw = {
      id: 'asig-1',
      pacientes: null,
    }
    expect(mapAsignacionToPaciente(raw, today)).toEqual({
      ...baseExpected,
      id: 'asig-1',
      nombre: '',
    })
  })

  it('derives tieneCuenta from user_id and bienvenidaRecibida from bienvenida_entregada_at', () => {
    expect(
      mapAsignacionToPaciente(
        buildRaw({
          user_id: 'u-1',
          bienvenida_entregada_at: '2026-05-01T10:00:00Z',
        }),
        today,
      ),
    ).toEqual({ ...baseExpected, tieneCuenta: true, bienvenidaRecibida: true })
  })

  it('uses the pacientes.id (not the asignacion id) as Paciente.id', () => {
    expect(mapAsignacionToPaciente(buildRaw(), today).id).toBe('p-1')
  })

  it('returns default fields when there are no etapas', () => {
    expect(mapAsignacionToPaciente(buildRaw(), today)).toEqual(baseExpected)
  })

  it('flags nivelFinalizado=true (DEC-05) when every etapa is finalizada (cycle closed)', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2025-01-01',
          created_at: '2025-01-01T00:00:00+00:00',
          fecha_finalizacion: '2025-02-01',
          causas: {
            nombre: 'Causa vieja',
            definicion: null,
            emociones_esperadas: null,
          },
          modalidades: {
            cantidad_niveles: 8,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 3,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
          ],
        },
      ],
    })
    // etapa presente pero cerrada (fecha_finalizacion != null) → ciclo completado → true
    expect(mapAsignacionToPaciente(raw, today)).toEqual({
      ...baseExpected,
      inicioTratamiento: { estado: 'finalizado', fecha: null },
      nivelFinalizado: true,
    })
  })

  it('returns mesActual and evaluaciones for an active etapa with mixed nivel progress', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: {
            nombre: 'Ira',
            definicion: null,
            emociones_esperadas: null,
          },
          modalidades: {
            cantidad_niveles: 8,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: '2026-05-08',
              nivel_evaluacion: null,
            },
            {
              id: 'n-2',
              numero_nivel: 3,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
          ],
        },
      ],
    })
    // 2026-05-01 → 2026-06-01: día 31 → semana 5 → mesActual = ceil(5/4) = 2 (ADR 0011)
    // etapaOrdinal=1 (only etapa). evaluaciones: 8 slots, no nivel_evaluacion rows → all false
    expect(mapAsignacionToPaciente(raw, today)).toEqual({
      ...baseExpected,
      inicioTratamiento: { estado: 'en_curso', fecha: '2026-05-01' },
      nivelFinalizado: false,
      mesActual: 2,
      mesesTotales: 8,
      etapaOrdinal: 1,
      evaluaciones: Array.from({ length: 8 }, (_, i) => ({
        numeroNivel: i + 1,
        evaluada: false,
      })),
      semanaGlobal: 5,
      semanasTotales: 32,
      fechaInicioEtapaActiva: '2026-05-01',
      etapaActivaId: 'e-1',
      causaActual: {
        nombre: 'Ira',
        definicion: null,
        emocionesEsperadas: null,
      },
    })
  })

  it('returns the latest fecha_respuesta across all etapas as ultimaEvaluacion', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: {
            nombre: 'Ira',
            definicion: null,
            emociones_esperadas: null,
          },
          modalidades: {
            cantidad_niveles: 8,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-1',
                score: 4,
                fecha_respuesta: '2026-05-08',
              },
            },
            {
              id: 'n-2',
              numero_nivel: 2,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-2',
                score: 3,
                fecha_respuesta: '2026-05-20',
              },
            },
          ],
        },
        {
          id: 'e-2',
          fecha_inicio: '2025-01-01',
          created_at: '2025-01-01T00:00:00+00:00',
          fecha_finalizacion: '2025-04-01',
          causas: {
            nombre: 'Causa vieja',
            definicion: null,
            emociones_esperadas: null,
          },
          modalidades: {
            cantidad_niveles: 8,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-old',
              numero_nivel: 1,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-3',
                score: 2,
                fecha_respuesta: '2025-04-15',
              },
            },
          ],
        },
      ],
    })
    // e-2 (2025-01-01) sorts before e-1 (2026-05-01) → etapaOrdinal of active = 2
    // niveles 1 and 2 have nivel_evaluacion → evaluaciones=[true,true,false×6]
    expect(mapAsignacionToPaciente(raw, today)).toEqual({
      ...baseExpected,
      inicioTratamiento: { estado: 'en_curso', fecha: '2026-05-01' },
      nivelFinalizado: false,
      mesActual: 2,
      mesesTotales: 8,
      etapaOrdinal: 2,
      evaluaciones: [
        { numeroNivel: 1, evaluada: true },
        { numeroNivel: 2, evaluada: true },
        ...Array.from({ length: 6 }, (_, i) => ({
          numeroNivel: i + 3,
          evaluada: false,
        })),
      ],
      semanaGlobal: 5,
      semanasTotales: 32,
      fechaInicioEtapaActiva: '2026-05-01',
      etapaActivaId: 'e-1',
      causaActual: {
        nombre: 'Ira',
        definicion: null,
        emocionesEsperadas: null,
      },
      ultimoScore: 3,
      tieneAlerta: false,
      tendencia: 'down',
      ultimaEvaluacion: '2026-05-20',
    })
  })

  it('flags nivelFinalizado=true (DEC-05): all evaluaciones done and mesActual === cantidadNiveles', () => {
    // Apr 1 → Jun 1 = día 61 → semana 9 → mes=ceil(9/4)=3, topado en
    // cantidadNiveles=2 → min(3,2)=2
    // mesActual=2 === cantidadNiveles=2 ✓ and both evaluaciones done → nivelFinalizado=true
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-04-01',
          created_at: '2026-04-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 2,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-1',
                score: 5,
                fecha_respuesta: '2026-04-30',
              },
            },
            {
              id: 'n-2',
              numero_nivel: 2,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-2',
                score: 4,
                fecha_respuesta: '2026-05-30',
              },
            },
          ],
        },
      ],
    })
    const result = mapAsignacionToPaciente(raw, today)
    expect(result.nivelFinalizado).toBe(true)
  })

  it('returns nivelFinalizado=false (DEC-05) while at least one evaluacion is pending', () => {
    // Active etapa with cantidadNiveles=2, mesActual=2 (at end), but nivel 2 not evaluated
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-04-01',
          created_at: '2026-04-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 2,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-1',
                score: 5,
                fecha_respuesta: '2026-04-30',
              },
            },
            {
              id: 'n-2',
              numero_nivel: 2,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
          ],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).nivelFinalizado).toBe(false)
  })

  it('returns nivelFinalizado=false when the paciente never had any etapa', () => {
    // Refinamiento de DEC-05 (code review): un paciente sin NINGUNA etapa nunca
    // inició tratamiento, así que no está "Finalizado". Distinto de un ciclo
    // cerrado (etapas presentes, todas finalizadas) que sí da true.
    expect(mapAsignacionToPaciente(buildRaw(), today).nivelFinalizado).toBe(
      false,
    )
  })

  it('picks the latest-fecha_inicio open etapa as active (deterministic, matches SQL)', () => {
    // Anomalía de datos: dos etapas abiertas. La activa debe ser la de
    // fecha_inicio más reciente (como el RPC: order by fecha_inicio desc),
    // no la que aparezca primero en el array (orden de fetch no garantizado).
    const buildEtapa = (id: string, fechaInicio: string) => ({
      id,
      fecha_inicio: fechaInicio,
      created_at: `${fechaInicio}T00:00:00+00:00`,
      fecha_finalizacion: null,
      causas: null,
      modalidades: {
        cantidad_niveles: 4,
        cantidad_sesiones: null,
        tipos_disco: null,
      },
      etapa_bloqueos: [],
      algoritmos: null,
      etapa_alfabetos: [],
      niveles: [],
    })
    const raw = buildRaw({
      // primero en el array = la MÁS VIEJA (a propósito, para que find() falle)
      etapas_tratamiento: [
        buildEtapa('e-vieja', '2026-01-01'),
        buildEtapa('e-nueva', '2026-05-01'),
      ],
    })
    const result = mapAsignacionToPaciente(raw, today)
    // activa = e-nueva (2026-05-01): mesActual cuenta desde mayo (día 31 → semana 5 → mes 2),
    // y es la 2ª etapa por fecha_inicio → etapaOrdinal=2
    expect(result.fechaInicioEtapaActiva).toBe('2026-05-01')
    expect(result.mesActual).toBe(2)
    expect(result.etapaOrdinal).toBe(2)
  })

  // ─── Task 0.3: evaluaciones, mesActual, etapaOrdinal ───────────────────────

  it('builds evaluaciones array with fixed length = cantidad_niveles, evaluada from nivel_evaluacion presence', () => {
    // 3 niveles: 1 and 2 have nivel_evaluacion, 3 does not → [true, true, false]
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 3,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-1',
                score: 5,
                fecha_respuesta: '2026-05-08',
              },
            },
            {
              id: 'n-2',
              numero_nivel: 2,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-2',
                score: 4,
                fecha_respuesta: '2026-05-15',
              },
            },
            {
              id: 'n-3',
              numero_nivel: 3,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
          ],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).evaluaciones).toEqual([
      { numeroNivel: 1, evaluada: true },
      { numeroNivel: 2, evaluada: true },
      { numeroNivel: 3, evaluada: false },
    ])
  })

  it('fills evaluaciones slot as {evaluada:false} when the nivel row for that number is missing', () => {
    // cantidad_niveles=3 but only niveles for 1 and 3 in raw → slot 2 fills as false
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 3,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-1',
                score: 5,
                fecha_respuesta: '2026-05-08',
              },
            },
            {
              id: 'n-3',
              numero_nivel: 3,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
          ],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).evaluaciones).toEqual([
      { numeroNivel: 1, evaluada: true },
      { numeroNivel: 2, evaluada: false },
      { numeroNivel: 3, evaluada: false },
    ])
  })

  it('returns evaluaciones=[] when there is no active etapa', () => {
    expect(mapAsignacionToPaciente(buildRaw(), today).evaluaciones).toEqual([])
  })

  it('exposes mesActual, etapaOrdinal and evaluaciones for an active etapa', () => {
    // etapa starts 2026-04-01, today 2026-06-01 → día 61 → semana 9 → mes=ceil(9/4)=3 (tope 4) → mesActual=3
    // etapaOrdinal=1 (only etapa)
    // evaluaciones: length 4 (cantidad_niveles=4), one nivel without eval
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-04-01',
          created_at: '2026-04-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 4,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
          ],
        },
      ],
    })
    const result = mapAsignacionToPaciente(raw, today)
    expect(result.mesActual).toBe(3)
    expect(result.etapaOrdinal).toBe(1)
    expect(result.evaluaciones).toHaveLength(4)
  })

  it('computes etapaOrdinal correctly when there are multiple etapas', () => {
    // Two etapas: old finalized (2025-01-01) and active (2026-05-01) → ordinal=2
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-old',
          fecha_inicio: '2025-01-01',
          created_at: '2025-01-01T00:00:00+00:00',
          fecha_finalizacion: '2025-12-31',
          causas: null,
          modalidades: {
            cantidad_niveles: 4,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
        {
          id: 'e-active',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 4,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).etapaOrdinal).toBe(2)
  })

  it('returns mesActual=null and etapaOrdinal=null when there is no active etapa', () => {
    expect(mapAsignacionToPaciente(buildRaw(), today).mesActual).toBeNull()
    expect(mapAsignacionToPaciente(buildRaw(), today).etapaOrdinal).toBeNull()
  })

  // ─── Task 0.3: regression — semanaGlobal and proximaEvaluacion unchanged ───

  it('regression: semanaGlobal is still derived from weeks since etapa start (not affected by Task 0.3)', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 4,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    // today=2026-06-01, fecha_inicio=2026-05-01 → 31 days → floor(31/7)+1 = 4+1 = 5
    expect(mapAsignacionToPaciente(raw, today).semanaGlobal).toBe(5)
  })

  // ─── BETA-018 / ADR 0011: mes y semana salen de la misma fuente ────────────

  const buildEtapaSinNiveles = (fechaInicio: string) => ({
    id: 'e-1',
    fecha_inicio: fechaInicio,
    created_at: `${fechaInicio}T00:00:00+00:00`,
    fecha_finalizacion: null,
    causas: null,
    modalidades: {
      cantidad_niveles: 4,
      cantidad_sesiones: null,
      tipos_disco: null,
    },
    etapa_bloqueos: [],
    algoritmos: null,
    etapa_alfabetos: [],
    niveles: [],
  })

  it('a paciente on day 28 is in mesActual=2 (semana 5), though no calendar month has passed', () => {
    // 2026-05-04 → 2026-06-01: día 28. Por calendario seguiría en el mes 1.
    const raw = buildRaw({
      etapas_tratamiento: [buildEtapaSinNiveles('2026-05-04')],
    })
    expect(mapAsignacionToPaciente(raw, today).mesActual).toBe(2)
  })

  it('a paciente on day 28 is in semanaGlobal=5', () => {
    const raw = buildRaw({
      etapas_tratamiento: [buildEtapaSinNiveles('2026-05-04')],
    })
    expect(mapAsignacionToPaciente(raw, today).semanaGlobal).toBe(5)
  })

  it('a paciente on day 27 is still in mesActual=1', () => {
    const raw = buildRaw({
      etapas_tratamiento: [buildEtapaSinNiveles('2026-05-05')],
    })
    expect(mapAsignacionToPaciente(raw, today).mesActual).toBe(1)
  })

  it('semanaGlobal counts LOCAL days: late at night on day 6 it is still semana 1', () => {
    // 7-jun 23:30 LOCAL (UTC-3) = 8-jun 02:30 UTC: por UTC ya sería el día 7 → semana 2,
    // y la semana quedaría desalineada del mes (que cuenta días locales).
    const raw = buildRaw({
      etapas_tratamiento: [buildEtapaSinNiveles('2026-06-01')],
    })
    expect(
      mapAsignacionToPaciente(raw, new Date(2026, 5, 7, 23, 30, 0))
        .semanaGlobal,
    ).toBe(1)
  })

  it('regression: proximaEvaluacion is still the earliest future fecha_seguimiento_esperada (not affected by Task 0.3)', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 4,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: '2026-06-15',
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
            {
              id: 'n-2',
              numero_nivel: 2,
              fecha_seguimiento_esperada: '2026-07-15',
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
          ],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).proximaEvaluacion).toBe(
      '2026-06-15',
    )
  })

  it('derives semanaGlobal from days elapsed since fecha_inicio of active etapa', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 8,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
          ],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).semanaGlobal).toBe(5)
  })

  it('caps semanaGlobal at semanasTotales when plan is exceeded', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2025-01-01',
          created_at: '2025-01-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 8,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
          ],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).semanaGlobal).toBe(32)
  })

  it('returns semanaGlobal=null when there is no active etapa', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2025-01-01',
          created_at: '2025-01-01T00:00:00+00:00',
          fecha_finalizacion: '2025-04-01',
          causas: null,
          modalidades: {
            cantidad_niveles: 8,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).semanaGlobal).toBeNull()
  })

  it('semanasTotales = cantidad_niveles*4, independiente de cantidad_sesiones', () => {
    // Las "sesiones" (16/32) son trabajo clínico del equipo, NO las semanas de
    // contenido nuestras. semanasTotales = 4 meses × 4 semanas = cantidad_niveles*4,
    // sin importar cantidad_sesiones.
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 4,
            cantidad_sesiones: 24,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).semanasTotales).toBe(16)
  })

  it('falls back to cantidad_niveles*4 when both fecha_seguimiento and cantidad_sesiones are null', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 4,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).semanasTotales).toBe(16)
  })

  it('semanasTotales NO distingue por cantidad_sesiones (todas dan cantidad_niveles*4)', () => {
    // El nº de sesiones (16/32) ya no cambia las semanas de contenido: todas las
    // modalidades de 4 meses dan 16 semanas.
    const buildEtapa = (cantidad_sesiones: number) => ({
      id: 'e-1',
      fecha_inicio: '2026-05-01',
      created_at: '2026-05-01T00:00:00+00:00',
      fecha_finalizacion: null,
      causas: null,
      modalidades: {
        cantidad_niveles: 4,
        cantidad_sesiones,
        tipos_disco: null,
      },
      etapa_bloqueos: [],
      algoritmos: null,
      etapa_alfabetos: [],
      niveles: [],
    })
    expect(
      mapAsignacionToPaciente(
        buildRaw({ etapas_tratamiento: [buildEtapa(16)] }),
        today,
      ).semanasTotales,
    ).toBe(16)
    expect(
      mapAsignacionToPaciente(
        buildRaw({ etapas_tratamiento: [buildEtapa(32)] }),
        today,
      ).semanasTotales,
    ).toBe(16)
  })

  it('builds modalidadResumen from cantidad_sesiones + tipos_disco.nombre stripped', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 6,
            cantidad_sesiones: 32,
            tipos_disco: { nombre: 'Disco Río' },
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).modalidadResumen).toBe(
      '32 discos de Río',
    )
  })

  it('returns modalidadResumen=null when cantidad_sesiones is missing', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 6,
            cantidad_sesiones: null,
            tipos_disco: { nombre: 'Disco Río' },
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).modalidadResumen).toBeNull()
  })

  it('returns modalidadResumen=null when tipos_disco join is missing', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 6,
            cantidad_sesiones: 32,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).modalidadResumen).toBeNull()
  })

  it('returns modalidadResumen=null when there is no active etapa', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2025-01-01',
          created_at: '2025-01-01T00:00:00+00:00',
          fecha_finalizacion: '2025-04-01',
          causas: null,
          modalidades: {
            cantidad_niveles: 6,
            cantidad_sesiones: 32,
            tipos_disco: { nombre: 'Disco Río' },
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).modalidadResumen).toBeNull()
  })

  it('returns semanasTotales=null when modalidades join is missing on the active etapa', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).semanasTotales).toBeNull()
  })

  it('ignora las fechas de seguimiento; usa cantidad_niveles*4', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 4,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: '2026-06-01',
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
            {
              id: 'n-2',
              numero_nivel: 2,
              fecha_seguimiento_esperada: '2026-08-22',
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
          ],
        },
      ],
    })
    // Aunque hay fechas de seguimiento, semanasTotales = cantidad_niveles*4 = 16.
    expect(mapAsignacionToPaciente(raw, today).semanasTotales).toBe(16)
  })

  it('nunca muestra una semana menor a 1 cuando el tratamiento arrancó, aunque fecha_inicio sea futura (BETA-031)', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-07-01',
          created_at: '2026-07-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 4,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    // today es 2026-06-01 y fecha_inicio cae 30 días después. Pasa con filas
    // guardadas cuando la base contaba el día en UTC (ADR 0012): la ficha no
    // debe leer "Semana 0" ni una semana negativa.
    const paciente = mapAsignacionToPaciente(raw, today)
    expect(paciente.semanaGlobal).toBe(1)
    expect(paciente.mesActual).toBe(1)
  })

  it('muestra Semana 1 cuando fecha_inicio es mañana (plan completado después de las 21:00 con el día en UTC)', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-06-02',
          created_at: '2026-06-02T01:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 4,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).semanaGlobal).toBe(1)
  })

  it('exposes fechaInicioEtapaActiva from the active etapa', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-old',
          fecha_inicio: '2025-01-01',
          created_at: '2025-01-01T00:00:00+00:00',
          fecha_finalizacion: '2025-04-01',
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
        {
          id: 'e-active',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).fechaInicioEtapaActiva).toBe(
      '2026-05-01',
    )
  })

  it('returns fechaInicioEtapaActiva=null when there is no active etapa', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2025-01-01',
          created_at: '2025-01-01T00:00:00+00:00',
          fecha_finalizacion: '2025-04-01',
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(
      mapAsignacionToPaciente(raw, today).fechaInicioEtapaActiva,
    ).toBeNull()
  })

  it('returns the enriched causaActual of the active etapa', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: {
            nombre: 'Tristeza',
            definicion: 'Sensación de pérdida y desconexión.',
            emociones_esperadas: 'Vacío, melancolía, llanto',
          },
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).causaActual).toEqual({
      nombre: 'Tristeza',
      definicion: 'Sensación de pérdida y desconexión.',
      emocionesEsperadas: 'Vacío, melancolía, llanto',
    })
  })

  it('returns causaActual with null definicion and emocionesEsperadas when those columns are null', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: {
            nombre: 'Ira',
            definicion: null,
            emociones_esperadas: null,
          },
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).causaActual).toEqual({
      nombre: 'Ira',
      definicion: null,
      emocionesEsperadas: null,
    })
  })

  it('returns causaActual=null when the causas join is missing on the active etapa', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).causaActual).toBeNull()
  })

  it('ignores causa of finalized etapa when there is an active one', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-old',
          fecha_inicio: '2025-01-01',
          created_at: '2025-01-01T00:00:00+00:00',
          fecha_finalizacion: '2025-04-01',
          causas: {
            nombre: 'Causa vieja',
            definicion: 'vieja',
            emociones_esperadas: null,
          },
          modalidades: {
            cantidad_niveles: 8,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
        {
          id: 'e-active',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: {
            nombre: 'Causa nueva',
            definicion: 'nueva',
            emociones_esperadas: null,
          },
          modalidades: {
            cantidad_niveles: 4,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).causaActual).toEqual({
      nombre: 'Causa nueva',
      definicion: 'nueva',
      emocionesEsperadas: null,
    })
  })

  it('returns empty bloqueosIdentificados when active etapa has no etapa_bloqueos rows', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).bloqueosIdentificados).toEqual(
      [],
    )
  })

  it('returns bloqueosIdentificados from the active etapa', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          algoritmos: null,
          etapa_alfabetos: [],
          etapa_bloqueos: [
            { bloqueos: { id: 'b-1', nombre: 'Centro Sacral' } },
            { bloqueos: { id: 'b-2', nombre: 'Centro Plexo Solar' } },
          ],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).bloqueosIdentificados).toEqual([
      { id: 'b-1', nombre: 'Centro Sacral' },
      { id: 'b-2', nombre: 'Centro Plexo Solar' },
    ])
  })

  it('ignores bloqueos of finalized etapa when there is an active one', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-old',
          fecha_inicio: '2025-01-01',
          created_at: '2025-01-01T00:00:00+00:00',
          fecha_finalizacion: '2025-04-01',
          causas: null,
          modalidades: null,
          algoritmos: null,
          etapa_alfabetos: [],
          etapa_bloqueos: [
            { bloqueos: { id: 'b-old', nombre: 'Centro Raíz' } },
          ],
          niveles: [],
        },
        {
          id: 'e-active',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          algoritmos: null,
          etapa_alfabetos: [],
          etapa_bloqueos: [
            { bloqueos: { id: 'b-new', nombre: 'Centro Corazón' } },
          ],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).bloqueosIdentificados).toEqual([
      { id: 'b-new', nombre: 'Centro Corazón' },
    ])
  })

  it('skips etapa_bloqueos rows where the bloqueos join is null', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          algoritmos: null,
          etapa_alfabetos: [],
          etapa_bloqueos: [
            { bloqueos: { id: 'b-1', nombre: 'Centro Garganta' } },
            { bloqueos: null },
          ],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).bloqueosIdentificados).toEqual([
      { id: 'b-1', nombre: 'Centro Garganta' },
    ])
  })

  it('returns the score of the latest evaluation as ultimoScore', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-1',
                score: 4,
                fecha_respuesta: '2026-05-08',
              },
            },
            {
              id: 'n-2',
              numero_nivel: 2,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-2',
                score: 1,
                fecha_respuesta: '2026-05-20',
              },
            },
          ],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).ultimoScore).toBe(1)
  })

  it('returns ultimoScore=null when there are no evaluations', () => {
    expect(mapAsignacionToPaciente(buildRaw(), today).ultimoScore).toBeNull()
  })

  it('returns flat tendencia when there is no penultimate evaluation', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-1',
                score: 5,
                fecha_respuesta: '2026-05-08',
              },
            },
          ],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).tendencia).toBe('flat')
  })

  it('returns up tendencia when last score is greater than penultimate', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-1',
                score: 2,
                fecha_respuesta: '2026-05-08',
              },
            },
            {
              id: 'n-2',
              numero_nivel: 2,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-2',
                score: 4,
                fecha_respuesta: '2026-05-20',
              },
            },
          ],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).tendencia).toBe('up')
  })

  it('returns down tendencia when last score is less than penultimate', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-1',
                score: 4,
                fecha_respuesta: '2026-05-08',
              },
            },
            {
              id: 'n-2',
              numero_nivel: 2,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-2',
                score: 2,
                fecha_respuesta: '2026-05-20',
              },
            },
          ],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).tendencia).toBe('down')
  })

  it('returns flat tendencia when last score equals penultimate', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-1',
                score: 3,
                fecha_respuesta: '2026-05-08',
              },
            },
            {
              id: 'n-2',
              numero_nivel: 2,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-2',
                score: 3,
                fecha_respuesta: '2026-05-20',
              },
            },
          ],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).tendencia).toBe('flat')
  })

  it('NO marca tieneAlerta por score bajo: el motor de alertas es la única fuente (ver marcarAlertas)', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: null,
              fecha_seguimiento_real: null,
              nivel_evaluacion: {
                id: 'ev-1',
                score: 2,
                fecha_respuesta: '2026-05-20',
              },
            },
          ],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).tieneAlerta).toBe(false)
  })

  it('does not flag tieneAlerta when ultimoScore is null', () => {
    expect(mapAsignacionToPaciente(buildRaw(), today).tieneAlerta).toBe(false)
  })

  it('returns the earliest future fecha_seguimiento_esperada of active etapa as proximaEvaluacion', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: '2026-05-15',
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
            {
              id: 'n-2',
              numero_nivel: 2,
              fecha_seguimiento_esperada: '2026-07-15',
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
            {
              id: 'n-3',
              numero_nivel: 3,
              fecha_seguimiento_esperada: '2026-06-15',
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
          ],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).proximaEvaluacion).toBe(
      '2026-06-15',
    )
  })

  it('returns proximaEvaluacion=null when all fecha_seguimiento_esperada of active etapa are in the past', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: '2026-05-15',
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
          ],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).proximaEvaluacion).toBeNull()
  })

  it('ignores fecha_seguimiento_esperada of finalized etapa for proximaEvaluacion', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-old',
          fecha_inicio: '2025-01-01',
          created_at: '2025-01-01T00:00:00+00:00',
          fecha_finalizacion: '2025-04-01',
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-old',
              numero_nivel: 1,
              fecha_seguimiento_esperada: '2099-01-01',
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
          ],
        },
        {
          id: 'e-active',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [
            {
              id: 'n-active',
              numero_nivel: 1,
              fecha_seguimiento_esperada: '2026-06-15',
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
          ],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).proximaEvaluacion).toBe(
      '2026-06-15',
    )
  })

  it('returns an all-null generalInfo when raw has no general-info fields', () => {
    expect(mapAsignacionToPaciente(buildRaw(), today).generalInfo).toEqual(
      emptyGeneralInfo,
    )
  })

  it('passes raw general-info fields through to generalInfo', () => {
    const raw = buildRaw({
      telefono: '+54 9 11 5555 1234',
      email: 'juan@example.com',
      fecha_nacimiento: '1980-03-15',
      fecha_alta: '2024-12-01',
    })
    expect(mapAsignacionToPaciente(raw, today).generalInfo).toEqual({
      telefono: '+54 9 11 5555 1234',
      email: 'juan@example.com',
      fechaNacimiento: '1980-03-15',
      edad: 46,
      fechaAlta: '2024-12-01',
    })
  })

  it('derives edad when the birthday already passed this year', () => {
    const raw = buildRaw({ fecha_nacimiento: '1980-03-15' })
    expect(mapAsignacionToPaciente(raw, today).generalInfo.edad).toBe(46)
  })

  it("derives edad subtracting one when the birthday hasn't passed yet this year", () => {
    const raw = buildRaw({ fecha_nacimiento: '1980-09-15' })
    expect(mapAsignacionToPaciente(raw, today).generalInfo.edad).toBe(45)
  })

  it('derives edad as the full year difference when the birthday is exactly today', () => {
    const raw = buildRaw({ fecha_nacimiento: '1980-06-01' })
    expect(mapAsignacionToPaciente(raw, today).generalInfo.edad).toBe(46)
  })

  it('returns generalInfo.edad as null when fecha_nacimiento is null', () => {
    expect(
      mapAsignacionToPaciente(buildRaw(), today).generalInfo.edad,
    ).toBeNull()
  })

  // ─── Task 4.1: mesesTotales ────────────────────────────────────────────────

  it('returns mesesTotales = cantidad_niveles of the active etapa modalidad', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 6,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).mesesTotales).toBe(6)
  })

  it('returns mesesTotales = 4 (not hardcoded) when cantidad_niveles is 4', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 4,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).mesesTotales).toBe(4)
  })

  it('returns mesesTotales = null when there is no active etapa', () => {
    expect(mapAsignacionToPaciente(buildRaw(), today).mesesTotales).toBeNull()
  })

  it('returns mesesTotales = null when modalidades join is missing on the active etapa', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: '2026-05-01',
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).mesesTotales).toBeNull()
  })

  // ─── Task 0.3: etapa sin arrancar (fecha_inicio null) — mapper null-safe ──

  it('handles an active etapa with fecha_inicio=null without throwing, and reports it as sinIniciar', () => {
    // Etapa abierta creada pero sin arrancar: fecha_inicio=null (DEC-3/D-2).
    // Antes de Task 0.3 esto crasheaba (sort) y mentía (semanaGlobal/mesActual).
    // modalidades=null a propósito: aísla el caso a los campos que Task 0.3
    // toca (etapaOrdinal/etapaActivaId/sinIniciar/mesActual/semanaGlobal),
    // sin arrastrar evaluaciones/semanasTotales (que ya cubren otros tests).
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: null,
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today)).toEqual({
      ...baseExpected,
      inicioTratamiento: { estado: 'sin_iniciar', fecha: null },
      etapaOrdinal: 1,
      etapaActivaId: 'e-1',
      sinIniciar: true,
    })
  })

  it('regression: semanaGlobal is null (not a huge number) when the active etapa has fecha_inicio=null', () => {
    // Bug matado: new Date(null) es epoch 1970 → semanaGlobal ≈ 2900 →
    // Math.min(..., semanasTotales) lo capea al máximo → "última semana" falso.
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: null,
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 4,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).semanaGlobal).toBeNull()
  })

  it('pins nivelFinalizado=false for an active etapa without fecha_inicio (mesActual=null makes the condition false, no code change per action)', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-1',
          fecha_inicio: null,
          created_at: '2026-05-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 4,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).nivelFinalizado).toBe(false)
  })

  it('keeps ordinal 1 for a closed-never-started etapa created first, ranking the later-started active etapa as 2 (DEC-11, via created_at not the fecha_inicio stopgap)', () => {
    // e-closed nunca arrancó (fecha_inicio null) y está cerrada, pero fue
    // creada primero (created_at más viejo). Sin el created_at real (i.e. si
    // el stopgap de Task 0.2 siguiera pasando fecha_inicio como createdAt),
    // esto crashearía (createdAt.slice en null) o mentiría el orden.
    const raw = buildRaw({
      etapas_tratamiento: [
        {
          id: 'e-closed',
          fecha_inicio: null,
          created_at: '2025-01-01T00:00:00+00:00',
          fecha_finalizacion: '2025-06-01',
          causas: null,
          modalidades: null,
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
        {
          id: 'e-active',
          fecha_inicio: '2026-05-01',
          created_at: '2026-04-01T00:00:00+00:00',
          fecha_finalizacion: null,
          causas: null,
          modalidades: {
            cantidad_niveles: 4,
            cantidad_sesiones: null,
            tipos_disco: null,
          },
          etapa_bloqueos: [],
          algoritmos: null,
          etapa_alfabetos: [],
          niveles: [],
        },
      ],
    })
    // e-closed ordena primero (coalesce → 2025-01-01) → ordinal 1.
    // e-active (activa, 2026-05-01) ordena segundo → ordinal 2.
    expect(mapAsignacionToPaciente(raw, today).etapaOrdinal).toBe(2)
  })

  it('marca al paciente como activo cuando su estado en la base es activo', () => {
    const raw = buildRaw({ estados_paciente: { codigo: 'activo' } })
    expect(mapAsignacionToPaciente(raw, today).state).toBe(
      PACIENTE_STATE.ACTIVE,
    )
  })

  it('marca al paciente como pausado cuando su estado en la base es pausado', () => {
    const raw = buildRaw({ estados_paciente: { codigo: 'pausado' } })
    expect(mapAsignacionToPaciente(raw, today).state).toBe(
      PACIENTE_STATE.PAUSED,
    )
  })

  it('marca al paciente como dado de baja cuando su estado en la base es baja_voluntaria', () => {
    const raw = buildRaw({ estados_paciente: { codigo: 'baja_voluntaria' } })
    expect(mapAsignacionToPaciente(raw, today).state).toBe(PACIENTE_STATE.BAJA)
  })

  it('cae a activo cuando la base no devuelve estado', () => {
    const raw = buildRaw({ estados_paciente: null })
    expect(mapAsignacionToPaciente(raw, today).state).toBe(
      PACIENTE_STATE.ACTIVE,
    )
  })

  it('cae a activo cuando el código de estado es desconocido', () => {
    const raw = buildRaw({ estados_paciente: { codigo: 'constructor' } })
    expect(mapAsignacionToPaciente(raw, today).state).toBe(
      PACIENTE_STATE.ACTIVE,
    )
  })

  // ─── BETA-015: inicioTratamiento habla del tratamiento MÁS RECIENTE ───────

  it('inicioTratamiento es sin_tratamiento cuando el paciente no tiene ninguna etapa', () => {
    expect(
      mapAsignacionToPaciente(buildRaw(), today).inicioTratamiento,
    ).toEqual({ estado: 'sin_tratamiento', fecha: null })
  })

  it('inicioTratamiento es sin_iniciar cuando la etapa abierta todavía no arrancó', () => {
    const raw = buildRaw({
      etapas_tratamiento: [buildEtapa({ fecha_inicio: null })],
    })
    expect(mapAsignacionToPaciente(raw, today).inicioTratamiento).toEqual({
      estado: 'sin_iniciar',
      fecha: null,
    })
  })

  it('inicioTratamiento es en_curso con la fecha_inicio de la etapa abierta, no la fecha de la asignación', () => {
    const raw = buildRaw({
      etapas_tratamiento: [buildEtapa({ fecha_inicio: '2026-05-10' })],
    })
    expect(mapAsignacionToPaciente(raw, today).inicioTratamiento).toEqual({
      estado: 'en_curso',
      fecha: '2026-05-10',
    })
  })

  it('inicioTratamiento es finalizado cuando hay etapas y todas están cerradas', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        buildEtapa({
          fecha_inicio: '2025-02-01',
          fecha_finalizacion: '2025-06-01',
        }),
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).inicioTratamiento).toEqual({
      estado: 'finalizado',
      fecha: null,
    })
  })

  it('inicioTratamiento: un tratamiento nuevo sin arrancar le gana al cerrado', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        buildEtapa({
          id: 'e-cerrada',
          fecha_inicio: '2025-02-01',
          fecha_finalizacion: '2025-06-01',
        }),
        buildEtapa({
          id: 'e-nueva',
          fecha_inicio: null,
          created_at: '2026-05-20T00:00:00+00:00',
        }),
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).inicioTratamiento).toEqual({
      estado: 'sin_iniciar',
      fecha: null,
    })
  })

  // ─── BETA-017: "hoy" es el día LOCAL, no el UTC ───────────────────────────

  it('proximaEvaluacion sigue mostrando la evaluación de mañana a las 22:00 locales de la víspera', () => {
    // 1-jun 22:00 en Buenos Aires = 2-jun 01:00 UTC. La evaluación del 2-jun
    // todavía es futura para el terapeuta.
    const raw = buildRaw({
      etapas_tratamiento: [
        buildEtapa({
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: '2026-06-02',
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
          ],
        }),
      ],
    })
    expect(
      mapAsignacionToPaciente(raw, new Date(2026, 5, 1, 22, 0, 0))
        .proximaEvaluacion,
    ).toBe('2026-06-02')
  })

  it('proximaEvaluacion deja de mostrar la evaluación el mismo día en que vence', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        buildEtapa({
          niveles: [
            {
              id: 'n-1',
              numero_nivel: 1,
              fecha_seguimiento_esperada: '2026-06-02',
              fecha_seguimiento_real: null,
              nivel_evaluacion: null,
            },
          ],
        }),
      ],
    })
    expect(
      mapAsignacionToPaciente(raw, new Date(2026, 5, 2, 9, 0, 0))
        .proximaEvaluacion,
    ).toBeNull()
  })

  it('derives algoritmoActual from the active etapa', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        buildEtapa({
          algoritmos: { nombre: 'Algoritmo 7', definicion: 'Definición 7' },
        }),
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).algoritmoActual).toEqual({
      nombre: 'Algoritmo 7',
      definicion: 'Definición 7',
    })
  })

  it('returns algoritmoActual=null when the active etapa has no algoritmo', () => {
    const raw = buildRaw({ etapas_tratamiento: [buildEtapa()] })
    expect(mapAsignacionToPaciente(raw, today).algoritmoActual).toBeNull()
  })

  it('returns algoritmoActual=null and alfabetosActuales=[] without an active etapa', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        buildEtapa({
          fecha_finalizacion: '2026-05-20',
          algoritmos: { nombre: 'Algoritmo 7', definicion: null },
          etapa_alfabetos: [
            { numero: 3, alfabetos: { id: 'a-1', nombre: 'Uno', orden: 1 } },
          ],
        }),
      ],
    })
    const paciente = mapAsignacionToPaciente(raw, today)
    expect([paciente.algoritmoActual, paciente.alfabetosActuales]).toEqual([
      null,
      [],
    ])
  })

  it('groups the active etapa alfabetos by alfabeto, ordered by catalog orden with sorted numbers', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        buildEtapa({
          etapa_alfabetos: [
            {
              numero: 17,
              alfabetos: { id: 'a-2', nombre: 'Sigma', orden: 2 },
            },
            {
              numero: 32,
              alfabetos: { id: 'a-1', nombre: 'Iota', orden: 1 },
            },
            {
              numero: 15,
              alfabetos: { id: 'a-1', nombre: 'Iota', orden: 1 },
            },
          ],
        }),
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).alfabetosActuales).toEqual([
      { alfabetoId: 'a-1', nombre: 'Iota', numeros: [15, 32] },
      { alfabetoId: 'a-2', nombre: 'Sigma', numeros: [17] },
    ])
  })

  it('ignores etapa_alfabetos rows whose alfabeto is null', () => {
    const raw = buildRaw({
      etapas_tratamiento: [
        buildEtapa({ etapa_alfabetos: [{ numero: 5, alfabetos: null }] }),
      ],
    })
    expect(mapAsignacionToPaciente(raw, today).alfabetosActuales).toEqual([])
  })
})
