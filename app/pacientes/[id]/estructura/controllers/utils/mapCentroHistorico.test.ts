import { mapCentroHistorico } from './mapCentroHistorico'
import { EtapaStatus } from '@/app/controllers/Tratamiento'
import type {
  EtapaEstructura,
  Medicion,
  ValorCentro,
} from '@/app/controllers/Tratamiento'

const buildValor = (overrides: Partial<ValorCentro> = {}): ValorCentro => ({
  centroId: 'c1',
  codigo: 'CE-01',
  nombre: 'Corona',
  orden: 1,
  activo: true,
  valor: 50,
  delta: null,
  ...overrides,
})

const buildMedicion = (overrides: Partial<Medicion> = {}): Medicion => ({
  id: 'm1',
  etapaId: 'e1',
  momento: 'apertura',
  estructuraGeneral: 50,
  deltaEstructura: null,
  registradaEn: '2026-01-01T00:00:00Z',
  autor: { id: 'u1', nombre: 'Ana' },
  copiadaDe: null,
  esPropia: true,
  editable: true,
  motivoNoEditable: null,
  valores: [buildValor()],
  ...overrides,
})

const buildEtapa = (
  overrides: Partial<EtapaEstructura> = {},
): EtapaEstructura => ({
  id: 'e1',
  ordinal: 1,
  fechaInicio: '2026-01-01',
  fechaFin: null,
  estado: EtapaStatus.EN_CURSO,
  iniciada: true,
  mediciones: [],
  medicionActual: null,
  ...overrides,
})

describe('mapCentroHistorico', () => {
  it('groups a single etapa history for the requested centro, using the already-computed per-medición delta', () => {
    const etapa = buildEtapa({
      mediciones: [
        buildMedicion({
          id: 'm1',
          registradaEn: '2026-01-01T00:00:00Z',
          valores: [buildValor({ valor: 50, delta: null })],
        }),
        buildMedicion({
          id: 'm2',
          momento: 'seguimiento',
          registradaEn: '2026-02-01T00:00:00Z',
          valores: [buildValor({ valor: 60, delta: 10 })],
        }),
      ],
    })

    const historico = mapCentroHistorico([etapa], 'c1')

    expect(historico.etapas).toHaveLength(1)
    expect(historico.etapas[0].etapaLabel).toBe('Etapa 1')
    expect(historico.etapas[0].mediciones).toEqual([
      {
        fecha: '2026-01-01T00:00:00Z',
        valor: 50,
        momento: 'apertura',
        delta: null,
      },
      {
        fecha: '2026-02-01T00:00:00Z',
        valor: 60,
        momento: 'seguimiento',
        delta: 10,
      },
    ])
  })

  it('produces one separator index at each subsequent etapa boundary, for the Sparkline', () => {
    const etapa1 = buildEtapa({
      id: 'e1',
      ordinal: 1,
      mediciones: [
        buildMedicion({ id: 'm1', valores: [buildValor({ valor: 40 })] }),
        buildMedicion({
          id: 'm2',
          valores: [buildValor({ valor: 45, delta: 5 })],
        }),
      ],
    })
    const etapa2 = buildEtapa({
      id: 'e2',
      ordinal: 2,
      mediciones: [
        buildMedicion({
          id: 'm3',
          etapaId: 'e2',
          valores: [buildValor({ valor: 70 })],
        }),
      ],
    })

    const historico = mapCentroHistorico([etapa1, etapa2], 'c1')

    expect(historico.valoresPlanos).toEqual([40, 45, 70])
    expect(historico.separadores).toEqual([2])
    expect(historico.etapas).toHaveLength(2)
    expect(historico.etapas[1].etapaLabel).toBe('Etapa 2')
  })

  it('skips mediciones that do not carry a value for the requested centro (catalog changed)', () => {
    const etapa = buildEtapa({
      mediciones: [
        buildMedicion({
          id: 'm1',
          valores: [buildValor({ centroId: 'otro-centro', valor: 30 })],
        }),
        buildMedicion({
          id: 'm2',
          valores: [buildValor({ centroId: 'c1', valor: 55 })],
        }),
      ],
    })

    const historico = mapCentroHistorico([etapa], 'c1')

    expect(historico.etapas[0].mediciones).toHaveLength(1)
    expect(historico.etapas[0].mediciones[0].valor).toBe(55)
  })

  it('excludes an etapa entirely when none of its mediciones carry a value for the centro', () => {
    const etapaSinCentro = buildEtapa({
      id: 'e1',
      mediciones: [
        buildMedicion({ valores: [buildValor({ centroId: 'otro-centro' })] }),
      ],
    })
    const etapaConCentro = buildEtapa({
      id: 'e2',
      ordinal: 2,
      mediciones: [
        buildMedicion({
          id: 'm2',
          etapaId: 'e2',
          valores: [buildValor({ centroId: 'c1' })],
        }),
      ],
    })

    const historico = mapCentroHistorico([etapaSinCentro, etapaConCentro], 'c1')

    expect(historico.etapas).toHaveLength(1)
    expect(historico.etapas[0].etapaLabel).toBe('Etapa 2')
  })
})
